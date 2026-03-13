import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch, apiUpload, markAsRead } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar, formatTime } from '../utils/helpers';
import { COMMON_EMOJIS, REACTION_EMOJIS, SPARK_ICEBREAKERS } from '../constants';
import ImageViewer from '../components/common/ImageViewer';
import ReportModal from '../components/common/ReportModal';

export default function ChatConvo() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, socket } = useAuth();
    const { showToast } = useToast();

    const data = location.state;
    const matchId = data?.match_id;
    const chatName = data?.name;
    const chatPhoto = data?.photo;
    const chatUserId = data?.user_id;

    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [icebreakersOpen, setIcebreakersOpen] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [onlineStatus, setOnlineStatus] = useState('...');
    const [replyState, setReplyState] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [imageViewer, setImageViewer] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [msgAction, setMsgAction] = useState(null); // { id, text, isMine, sender }
    const messagesRef = useRef(null);
    const pollRef = useRef(null);
    const msgIdsRef = useRef(new Set());
    const typingTimeoutRef = useRef(null);
    const audioChunksRef = useRef([]);
    const fileInputRef = useRef(null);
    const lastTapRef = useRef({});
    const [reactions, setReactions] = useState({});
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    function scrollToBottom() {
        if (messagesRef.current) {
            messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
        }
    }

    async function loadMessages(silent = false) {
        try {
            const data = await apiFetch(`/api/messages/${matchId}`);
            const msgs = data.messages || [];
            if (silent && msgs.length === msgIdsRef.current.size && msgs.every(m => msgIdsRef.current.has(m.id))) return;
            msgIdsRef.current = new Set(msgs.map(m => m.id));
            setMessages(msgs);
            if (!silent) setTimeout(() => scrollToBottom(), 100);
        } catch (e) {
            if (!silent) showToast(e.message, 'error');
        } finally {
            if (!silent) setLoading(false);
        }
    }

    async function loadReactionsForMessage(msgId) {
        try {
            const data = await apiFetch(`/api/messages/${msgId}/reactions`);
            setReactions(prev => ({ ...prev, [msgId]: data.reactions || [] }));
        } catch { /* ignore */ }
    }

    useEffect(() => {
        if (!matchId) return navigate('/chat', { replace: true });
        loadMessages();
        markAsRead(matchId);

        // Check online status
        apiFetch(`/api/users/${chatUserId}/online`).then(r => {
            setOnlineStatus(r.online ? 'Online' : 'Offline');
        }).catch(() => setOnlineStatus('Tap for profile'));

        // Polling
        pollRef.current = window.setInterval(() => loadMessages(true), 10000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchId, chatUserId]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        const handleNewMsg = (msg) => {
            if (msg.match_id === matchId && !msgIdsRef.current.has(msg.id)) {
                setMessages(prev => [...prev, msg]);
                msgIdsRef.current.add(msg.id);
                setTimeout(() => scrollToBottom(), 50);
                markAsRead(matchId);
                // Emit read status back to sender
                socket.emit('message_read', { messageId: msg.id, fromUserId: msg.sender_id });
            }
        };

        const handleTypingStart = ({ fromUserId }) => {
            if (fromUserId == chatUserId) setIsTyping(true);
        };
        const handleTypingStop = ({ fromUserId }) => {
            if (fromUserId == chatUserId) setIsTyping(false);
        };

        socket.on('new_message', handleNewMsg);
        socket.on('typing_start', handleTypingStart);
        socket.on('typing_stop', handleTypingStop);

        const handleReaction = (data) => {
            if (data.match_id === matchId) {
                loadReactionsForMessage(data.message_id);
            }
        };
        socket.on('message_reaction', handleReaction);

        const handleMessageRead = ({ messageId, readerId }) => {
            if (readerId == chatUserId) {
                setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_read: 1 } : m));
            }
        };
        socket.on('message_read', handleMessageRead);

        return () => {
            socket.off('new_message', handleNewMsg);
            socket.off('typing_start', handleTypingStart);
            socket.off('typing_stop', handleTypingStop);
            socket.off('message_reaction', handleReaction);
            socket.off('message_read', handleMessageRead);
        };
    }, [socket, matchId, chatUserId]);



    const handleDoubleTap = async (msgId) => {
        try {
            await apiFetch(`/api/messages/${msgId}/react`, {
                method: 'POST',
                body: JSON.stringify({ reaction: '❤️' })
            });
            loadReactionsForMessage(msgId);
        } catch { /* ignore */ }
    };

    const handleTyping = () => {
        if (!socket || !chatUserId) return;
        socket.emit('typing_start', { toUserId: chatUserId });
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket?.emit('typing_stop', { toUserId: chatUserId });
        }, 1500);
    };

    const sendMsg = async () => {
        const msgText = text.trim();
        const file = selectedFile;
        if ((!msgText && !file) || sending) return;

        setSending(true);
        setText('');
        if (file) clearImgSelection();
        setEmojiOpen(false);
        setIcebreakersOpen(false);

        const replyData = replyState ? { ...replyState } : null;
        setReplyState(null);

        try {
            let result;
            if (file) {
                const fd = new FormData();
                fd.append('image', file);
                if (msgText) fd.append('text', msgText);
                if (replyData) fd.append('replyToId', replyData.id);
                result = await apiUpload(`/api/messages/${matchId}`, fd);
            } else {
                const payload = { text: msgText };
                if (replyData) payload.replyToId = replyData.id;
                result = await apiFetch(`/api/messages/${matchId}`, { method: 'POST', body: JSON.stringify(payload) });
            }
            if (result.message) {
                setMessages(prev => [...prev, result.message]);
                msgIdsRef.current.add(result.message.id);
                setTimeout(() => scrollToBottom(), 50);
            }
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setSending(false);
        }
    };

    const handleImgSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSelectedFile(file);
    };

    const clearImgSelection = () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const toggleRecording = async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const recorder = new MediaRecorder(stream, {
                    mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
                });
                audioChunksRef.current = [];
                recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
                recorder.onstop = async () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    stream.getTracks().forEach(t => t.stop());
                    try {
                        const fd = new FormData();
                        fd.append('audio', blob, 'voice.webm');
                        const result = await apiUpload(`/api/messages/${matchId}`, fd);
                        if (result.message) {
                            setMessages(prev => [...prev, result.message]);
                            msgIdsRef.current.add(result.message.id);
                            setTimeout(() => scrollToBottom(), 50);
                        }
                    } catch {
                        showToast('Failed to send voice message', 'error');
                    }
                };
                recorder.start();
                setMediaRecorder(recorder);
                setIsRecording(true);
                showToast('Recording... Tap mic to stop', 'info');
            } catch {
                showToast('Microphone access denied', 'error');
            }
        } else {
            mediaRecorder?.stop();
            setIsRecording(false);
            setMediaRecorder(null);
        }
    };

    const deleteMsg = async (id) => {
        try {
            await apiFetch(`/api/messages/${id}`, { method: 'DELETE' });
            setMessages(prev => prev.filter(m => m.id !== id));
            msgIdsRef.current.delete(id);
            showToast('Message deleted', 'success', 1500);
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const unmatch = async () => {
        if (!window.confirm('Unmatch this person? This cannot be undone.')) return;
        try {
            await apiFetch(`/api/matches/${matchId}`, { method: 'DELETE' });
            showToast('Unmatched', 'success');
            navigate('/chat', { replace: true });
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const renderMessage = (m) => {
        const isMine = m.sender_id === user?.id;
        return (
            <div key={m.id} id={`msg-${m.id}`}
                className={`msg-wrapper ${isMine ? 'msg-sent-container' : 'msg-received-container'}`}
                style={{ marginBottom: 8, alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                {m.reply_to_text && (
                    <div className="msg-context" onClick={() => document.getElementById(`msg-${m.reply_to_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                        <strong>{m.reply_to_sender || 'User'}</strong>: {(m.reply_to_text || '').substring(0, 60)}
                    </div>
                )}
                <div className={`msg-bubble ${m.image_url && !m.text && !m.voice_url ? 'msg-bubble-image-only' : m.voice_url && !m.text && !m.image_url ? `${isMine ? 'msg-sent' : 'msg-received'} msg-bubble-audio` : isMine ? 'msg-sent' : 'msg-received'}`}
                    onClick={() => {
                        const now = Date.now();
                        const lastTap = lastTapRef.current[m.id] || 0;
                        if (now - lastTap < 350) {
                            handleDoubleTap(m.id);
                            lastTapRef.current[m.id] = 0;
                            return;
                        }
                        lastTapRef.current[m.id] = now;
                        setTimeout(() => {
                            if (lastTapRef.current[m.id] !== 0 && Date.now() - lastTapRef.current[m.id] > 300) {
                                setMsgAction({ id: m.id, text: m.text, isMine, sender: isMine ? 'You' : chatName });
                            }
                        }, 400);
                    }}>

                    {m.image_url && (
                        <img src={m.image_url} className="msg-image" loading="lazy"
                            onClick={(e) => { e.stopPropagation(); setImageViewer(m.image_url); }}
                            onError={(e) => { e.target.style.display = 'none'; }} alt="shared" />
                    )}
                    {m.voice_url && <audio controls src={m.voice_url} className="msg-audio" preload="none" />}
                    {m.text && <div className="msg-text">{m.text}</div>}
                </div>
                <div className={`msg-time ${isMine ? 'sent' : ''}`}>
                    {formatTime(m.created_at)}{' '}
                    {isMine && (
                        <span className="msg-status" style={{ fontSize: 16, verticalAlign: 'middle', marginLeft: 4 }}>
                            {m.is_read ? (
                                <span className="material-symbols-rounded fill-icon" style={{ fontSize: 16, color: 'var(--primary)', fontWeight: 'bold' }}>done_all</span>
                            ) : (
                                <span className="material-symbols-rounded" style={{ fontSize: 16, opacity: 0.6 }}>done</span>
                            )}
                        </span>
                    )}
                </div>
                {/* Message Reactions */}
                {reactions[m.id] && reactions[m.id].length > 0 && (
                    <div className={`msg-reactions ${isMine ? 'sent' : ''}`}>
                        {reactions[m.id].map((r, i) => (
                            <span key={i} className="msg-reaction-badge" title={r.name}>{r.reaction}</span>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Date separators
    const renderMessages = () => {
        let lastDate = null;
        return messages.map(m => {
            const msgDate = new Date(m.created_at).toDateString();
            let dateSep = null;
            if (msgDate !== lastDate) {
                lastDate = msgDate;
                const today = new Date().toDateString();
                const label = msgDate === today ? 'Today' : new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
                dateSep = <div key={`date-${msgDate}`} className="date-separator"><span>{label}</span></div>;
            }
            return (
                <div key={m.id}>
                    {dateSep}
                    {renderMessage(m)}
                </div>
            );
        });
    };

    return (
        <div className="chat-convo-page view-animate" style={{
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-main)',
            position: 'relative'
        }}>
            {/* Celestial Header */}
            <div className="chat-convo-header glass-card" style={{
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                borderRadius: 0,
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(30px)'
            }}>
                <button className="btn-icon" onClick={() => navigate('/chat')} style={{ background: 'var(--bg-elevated)' }}>
                    <span className="material-symbols-rounded">arrow_back</span>
                </button>

                <div style={{ position: 'relative', cursor: 'pointer' }}
                    onClick={() => navigate('/profile/view', { state: { profile: { id: chatUserId, name: chatName, photo: chatPhoto, match_id: matchId } } })}>
                    <img className="chat-convo-avatar" src={chatPhoto || defaultAvatar(chatName)}
                        onError={(e) => { e.target.src = defaultAvatar(chatName); }}
                        style={{ width: '42px', height: '42px', borderRadius: '50%', border: '2px solid var(--border)' }}
                        alt={chatName} />
                    {onlineStatus === 'Online' && (
                        <span style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', background: '#22c55e', borderRadius: '50%', border: '2px solid var(--bg-main)' }} />
                    )}
                </div>

                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    onClick={() => navigate('/profile/view', { state: { profile: { id: chatUserId, name: chatName, photo: chatPhoto, match_id: matchId } } })}>
                    <div className="font-serif" style={{ fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chatName}</div>
                    <div style={{ fontSize: '0.75rem', color: onlineStatus === 'Online' ? '#22c55e' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {onlineStatus === 'Online' && <span className="pulse-dot" />}
                        {onlineStatus === 'Online' ? 'Alight' : 'Dimmed'}
                    </div>
                </div>

                <button className="btn-icon" onClick={() => setShowMenu(!showMenu)} style={{ background: 'none' }}>
                    <span className="material-symbols-rounded">more_vert</span>
                </button>
            </div>

            {/* Messages Area */}
            <div className="chat-messages" id="chat-msgs" ref={messagesRef} style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <div className="spinner" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="view-animate" style={{ textAlign: 'center', padding: '60px 20px', margin: 'auto' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.5 }}>🔥</div>
                        <h3 className="font-serif">The Flames Ignite</h3>
                        <p style={{ opacity: 0.6 }}>You've sparked a fusion with {chatName}. Send the first whisper.</p>
                    </div>
                ) : renderMessages()}

                {isTyping && (
                    <div className="typing-indicator-spark" style={{ alignSelf: 'flex-start', margin: '10px 0', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7 }}>
                        <div className="typing-dots"><span /><span /><span /></div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--primary-light)' }}>{chatName} is igniting...</span>
                    </div>
                )}
            </div>

            {/* Floating Input Area */}
            <div className="chat-input-container-spark" style={{
                padding: '10px 20px 30px',
                background: 'linear-gradient(to top, var(--bg-main) 60%, transparent)'
            }}>
                {replyState && (
                    <div className="reply-bar glass-card view-animate" style={{
                        padding: '10px 15px',
                        marginBottom: '10px',
                        borderRadius: '15px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.05)',
                        borderLeft: '4px solid var(--primary)'
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-light)' }}>Replying to {replyState.sender}</div>
                            <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.7 }}>
                                {replyState.text || 'Media Message'}
                            </div>
                        </div>
                        <button className="btn-icon" onClick={() => setReplyState(null)} style={{ background: 'none', padding: 0 }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>close</span>
                        </button>
                    </div>
                )}

                {icebreakersOpen && (
                    <div className="icebreaker-drawer view-animate" style={{
                        padding: '15px',
                        marginBottom: '10px',
                        background: 'var(--bg-glass)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '20px',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SPARK Icebreakers</div>
                        <div className="icebreaker-chips" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                            {SPARK_ICEBREAKERS.map((prompt, i) => (
                                <button key={i} className="icebreaker-chip glass-card" onClick={() => { setText(prompt); setIcebreakersOpen(false); }}
                                    style={{ padding: '8px 16px', borderRadius: '30px', whiteSpace: 'nowrap', fontSize: '0.85rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Emoji Picker */}
                {emojiOpen && (
                    <div className="view-animate" style={{
                        padding: '12px',
                        marginBottom: '10px',
                        background: 'var(--bg-glass)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(8, 1fr)',
                        gap: '4px'
                    }}>
                        {COMMON_EMOJIS.map((emoji, i) => (
                            <button
                                key={i}
                                onClick={() => { setText(t => t + emoji); setEmojiOpen(false); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.3rem',
                                    padding: '6px 4px',
                                    borderRadius: '8px',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                <div className="chat-input-pill" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 15px',
                    borderRadius: '30px'
                }}>
                    <button className="btn-icon" onClick={() => setIcebreakersOpen(!icebreakersOpen)} style={{ color: icebreakersOpen ? 'var(--primary)' : 'inherit', background: 'none' }}>
                        <span className="material-symbols-rounded">auto_awesome</span>
                    </button>

                    <button className="btn-icon" onClick={() => fileInputRef.current?.click()} style={{ color: selectedFile ? 'var(--primary)' : 'inherit', background: 'none' }}>
                        <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleImgSelect} />
                        <span className="material-symbols-rounded">{selectedFile ? 'check_circle' : 'add_photo_alternate'}</span>
                    </button>

                    <textarea
                        id="chat-input"
                        placeholder={sending ? "Transmitting..." : "Whisper something seductive..."}
                        value={text}
                        disabled={sending}
                        onChange={(e) => { setText(e.target.value); handleTyping(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                        style={{
                            flex: 1,
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            fontSize: '0.95rem',
                            maxHeight: '100px',
                            resize: 'none',
                            padding: '10px 0',
                            outline: 'none',
                            opacity: sending ? 0.6 : 1
                        }}
                    />

                    <button className="btn-icon" onClick={toggleRecording} style={{ color: isRecording ? 'var(--danger)' : 'inherit', background: 'none' }}>
                        <span className="material-symbols-rounded">{isRecording ? 'stop_circle' : 'mic'}</span>
                    </button>

                    <button className="chat-send-btn holographic" onClick={sendMsg} disabled={(!text.trim() && !selectedFile) || sending}
                        style={{
                            padding: '10px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--gradient-primary)',
                            opacity: ( (!text.trim() && !selectedFile) || sending ) ? 0.5 : 1
                        }}>
                        {sending ? (
                            <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                        ) : (
                            <span className="material-symbols-rounded" style={{ color: 'white', fontSize: '20px' }}>send</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Overlays */}
            {imageViewer && <ImageViewer url={imageViewer} onClose={() => setImageViewer(null)} />}
            {showReport && <ReportModal userId={chatUserId} userName={chatName} onClose={() => setShowReport(false)} />}

            {/* Menu Overlay */}
            {showMenu && (
                <div className="modal-overlay" onClick={() => setShowMenu(false)}>
                    <div className="msg-action-sheet-spark view-animate">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                            <img src={chatPhoto || defaultAvatar(chatName)} style={{ width: '50px', height: '50px', borderRadius: '50%' }} alt="" />
                            <div>
                                <div className="font-serif" style={{ fontSize: '1.2rem' }}>{chatName}</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Connection Settings</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '15px' }}
                                onClick={() => { setShowMenu(false); navigate('/profile/view', { state: { profile: { id: chatUserId, name: chatName, photo: chatPhoto, match_id: matchId } } }); }}>
                                <span className="material-symbols-rounded" style={{ marginRight: '15px' }}>person</span> View Soul Profile
                            </button>
                            <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '15px' }} onClick={() => { setShowMenu(false); setShowReport(true); }}>
                                <span className="material-symbols-rounded" style={{ marginRight: '15px' }}>flag</span> Report Interference
                            </button>
                            <button className="btn-secondary danger" style={{ justifyContent: 'flex-start', padding: '15px', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={() => { setShowMenu(false); unmatch(); }}>
                                <span className="material-symbols-rounded" style={{ marginRight: '15px' }}>heart_broken</span> Extinguish Flame
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Action Sheet */}
            {msgAction && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMsgAction(null); }}>
                    <div className="msg-action-sheet-spark view-animate">
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '15px' }}>Reflect on Transmission</div>
                            <div className="msg-action-reactions" style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                                {REACTION_EMOJIS.map(emoji => (
                                    <button key={emoji} className="reaction-pick-btn" style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
                                        onClick={() => { handleDoubleTap(msgAction.id); setMsgAction(null); }}>
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '15px' }}
                                onClick={() => { setReplyState({ id: msgAction.id, text: msgAction.text, sender: msgAction.sender }); setMsgAction(null); }}>
                                <span className="material-symbols-rounded" style={{ marginRight: '15px' }}>reply</span> Echo Whisper
                            </button>
                            {msgAction.text && (
                                <button className="btn-secondary" style={{ justifyContent: 'flex-start', padding: '15px' }}
                                    onClick={() => { navigator.clipboard?.writeText(msgAction.text); showToast('Sampled!', 'success'); setMsgAction(null); }}>
                                    <span className="material-symbols-rounded" style={{ marginRight: '15px' }}>content_copy</span> Capture Text
                                </button>
                            )}
                            {msgAction.isMine ? (
                                <button className="btn-secondary danger" style={{ justifyContent: 'flex-start', padding: '15px' }}
                                    onClick={() => { deleteMsg(msgAction.id); setMsgAction(null); }}>
                                    <span className="material-symbols-rounded" style={{ marginRight: '15px' }}>delete</span> Extinguish Whisper
                                </button>
                            ) : (
                                <button className="btn-secondary danger" style={{ justifyContent: 'flex-start', padding: '15px' }}
                                    onClick={() => { setShowReport(true); setMsgAction(null); }}>
                                    <span className="material-symbols-rounded" style={{ marginRight: '15px' }}>flag</span> Flag Transmission
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
