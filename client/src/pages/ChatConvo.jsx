import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch, apiUpload, markAsRead } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar, formatTime } from '../utils/helpers';
import { COMMON_EMOJIS, REACTION_EMOJIS } from '../constants';
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

    useEffect(() => {
        if (!matchId) return navigate('/chat', { replace: true });
        loadMessages();
        markAsRead(matchId);

        // Check online status
        apiFetch(`/api/users/${chatUserId}/online`).then(r => {
            setOnlineStatus(r.online ? 'Online' : 'Offline');
        }).catch(() => setOnlineStatus('Tap for profile'));

        // Polling
        pollRef.current = setInterval(() => loadMessages(true), 10000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [matchId]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        const handleNewMsg = (msg) => {
            if (msg.match_id === matchId && !msgIdsRef.current.has(msg.id)) {
                setMessages(prev => [...prev, msg]);
                msgIdsRef.current.add(msg.id);
                setTimeout(() => scrollToBottom(), 50);
                markAsRead(matchId);
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

        return () => {
            socket.off('new_message', handleNewMsg);
            socket.off('typing_start', handleTypingStart);
            socket.off('typing_stop', handleTypingStop);
            socket.off('message_reaction', handleReaction);
        };
    }, [socket, matchId, chatUserId]);

    const scrollToBottom = () => {
        messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
    };

    const loadMessages = async (silent = false) => {
        try {
            const data = await apiFetch(`/api/messages/${matchId}`);
            const msgs = data.messages || [];
            if (silent && msgs.length === msgIdsRef.current.size && msgs.every(m => msgIdsRef.current.has(m.id))) return;
            msgIdsRef.current = new Set(msgs.map(m => m.id));
            setMessages(msgs);
            if (!silent) setTimeout(() => scrollToBottom(), 100);
        } catch (e) {
            if (!silent) showToast(e.message, 'error');
        }
    };

    const loadReactionsForMessage = async (msgId) => {
        try {
            const data = await apiFetch(`/api/messages/${msgId}/reactions`);
            setReactions(prev => ({ ...prev, [msgId]: data.reactions || [] }));
        } catch { /* ignore */ }
    };

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
        if (!msgText && !file) return;

        setText('');
        if (file) clearImgSelection();
        setEmojiOpen(false);

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
                    } catch (e) {
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
                    onClick={(e) => {
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
                    {isMine && <span className="msg-status" style={m.is_read ? { color: '#34b7f1' } : {}}>{m.is_read ? '✓✓' : '✓'}</span>}
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
        <div className="chat-convo-page view-animate">
            <div className="chat-convo-header">
                <button className="btn-icon" style={{ width: 38, height: 38, flexShrink: 0 }}
                    onClick={() => navigate('/chat')}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
                </button>
                <img className="chat-convo-avatar" src={chatPhoto || defaultAvatar(chatName)}
                    onError={(e) => { e.target.src = defaultAvatar(chatName); }}
                    onClick={() => navigate('/profile/view', { state: { profile: { id: chatUserId, name: chatName, photo: chatPhoto, match_id: matchId } } })}
                    alt={chatName} />
                <div style={{ flex: 1, marginLeft: 4, minWidth: 0 }}>
                    <div className="chat-convo-name">{chatName}</div>
                    <div className="chat-convo-status" style={{ color: onlineStatus === 'Online' ? 'var(--success)' : 'var(--text-muted)' }}>
                        {onlineStatus}
                    </div>
                </div>
                <button className="chat-options-btn" onClick={() => setShowMenu(!showMenu)}>
                    <span className="material-symbols-outlined">more_vert</span>
                </button>
            </div>

            {showMenu && (
                <div className="msg-actions-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowMenu(false); }}>
                    <div className="msg-actions-sheet">
                        <button className="msg-action-btn" onClick={() => {
                            setShowMenu(false);
                            navigate('/profile/view', { state: { profile: { id: chatUserId, name: chatName, photo: chatPhoto, match_id: matchId } } });
                        }}>
                            <span className="material-symbols-outlined">person</span>View Profile
                        </button>
                        <button className="msg-action-btn" onClick={() => { setShowMenu(false); setShowReport(true); }}>
                            <span className="material-symbols-outlined">flag</span>Report User
                        </button>
                        <button className="msg-action-btn delete" onClick={() => { setShowMenu(false); unmatch(); }}>
                            <span className="material-symbols-outlined">heart_broken</span>Unmatch
                        </button>
                    </div>
                </div>
            )}

            <div className="chat-messages" id="chat-msgs" ref={messagesRef}>
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>💕</div>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            You matched with <strong>{chatName}</strong>!<br />Say something nice!
                        </p>
                    </div>
                ) : renderMessages()}
            </div>

            {isTyping && (
                <div className="typing-indicator">
                    <span>{chatName} is typing</span>
                    <div className="typing-dots"><span /><span /><span /></div>
                </div>
            )}

            <div className="chat-input-container">
                {replyState && (
                    <div className="reply-bar">
                        <div className="reply-info">
                            <span className="reply-to-name">Replying to {replyState.sender}</span>
                            <span className="reply-text-preview">{(replyState.text || '').substring(0, 60)}</span>
                        </div>
                        <span className="material-symbols-outlined close-reply" onClick={() => setReplyState(null)}>close</span>
                    </div>
                )}
                {emojiOpen && (
                    <div className="emoji-area">
                        {COMMON_EMOJIS.map(e => (
                            <button key={e} className="emoji-btn" onClick={() => {
                                setText(prev => prev + e);
                                setEmojiOpen(false);
                            }}>{e}</button>
                        ))}
                    </div>
                )}
                <div className="chat-input-bar">
                    <button className="btn-icon" style={{ width: 38, height: 38, background: 'none', border: 'none' }}
                        onClick={() => setEmojiOpen(!emojiOpen)}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--text-secondary)' }}>sentiment_satisfied</span>
                    </button>
                    <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleImgSelect} />
                    <button className="btn-icon" style={{ width: 38, height: 38, background: 'none', border: 'none' }}
                        onClick={() => fileInputRef.current?.click()}>
                        <span className="material-symbols-outlined" style={{ color: selectedFile ? 'var(--primary)' : 'var(--text-secondary)' }}>
                            {selectedFile ? 'check_circle' : 'add_photo_alternate'}
                        </span>
                    </button>
                    <button className="btn-icon" style={{ width: 38, height: 38, background: 'none', border: 'none' }}
                        onClick={toggleRecording}>
                        <span className="material-symbols-outlined" style={{ color: isRecording ? 'var(--danger)' : 'var(--text-secondary)' }}>
                            {isRecording ? 'stop_circle' : 'mic'}
                        </span>
                    </button>
                    <input id="chat-input" type="text" placeholder={`Message ${chatName}...`}
                        value={text} onChange={(e) => { setText(e.target.value); handleTyping(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }} />
                    <button className="chat-send-btn" onClick={sendMsg}>
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </div>
                {selectedFile && (
                    <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)' }}>
                        <img src={URL.createObjectURL(selectedFile)} className="img-preview-thumb" alt="preview" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>Image ready to send</span>
                        <button onClick={clearImgSelection} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
                    </div>
                )}
            </div>

            {imageViewer && <ImageViewer url={imageViewer} onClose={() => setImageViewer(null)} />}
            {showReport && <ReportModal userId={chatUserId} userName={chatName} onClose={() => setShowReport(false)} />}

            {/* Message Action Bottom Sheet */}
            {msgAction && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMsgAction(null); }}>
                    <div className="msg-action-sheet">
                        <div className="msg-action-header">
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {msgAction.text ? `"${msgAction.text.slice(0, 50)}${msgAction.text.length > 50 ? '...' : ''}"` : 'Media message'}
                            </span>
                            <button className="btn-icon" onClick={() => setMsgAction(null)} style={{ width: 28, height: 28, minWidth: 28 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                            </button>
                        </div>
                        {/* Quick Reactions */}
                        <div className="msg-action-reactions">
                            {REACTION_EMOJIS.map(emoji => (
                                <button key={emoji} className="reaction-pick-btn"
                                    onClick={() => { handleDoubleTap(msgAction.id); setMsgAction(null); }}>
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <div className="msg-action-list">
                            <button className="msg-action-item" onClick={() => {
                                setReplyState({ id: msgAction.id, text: msgAction.text, sender: msgAction.sender });
                                setMsgAction(null);
                            }}>
                                <span className="material-symbols-outlined">reply</span>Reply
                            </button>
                            {msgAction.text && (
                                <button className="msg-action-item" onClick={() => {
                                    navigator.clipboard?.writeText(msgAction.text);
                                    showToast('Copied!', 'success');
                                    setMsgAction(null);
                                }}>
                                    <span className="material-symbols-outlined">content_copy</span>Copy Text
                                </button>
                            )}
                            {msgAction.isMine ? (
                                <button className="msg-action-item danger" onClick={() => {
                                    deleteMsg(msgAction.id);
                                    setMsgAction(null);
                                }}>
                                    <span className="material-symbols-outlined">delete</span>Delete Message
                                </button>
                            ) : (
                                <button className="msg-action-item danger" onClick={() => {
                                    setShowReport(true);
                                    setMsgAction(null);
                                }}>
                                    <span className="material-symbols-outlined">flag</span>Report User
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
