import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar, formatTime } from '../utils/helpers';

export default function ChatList() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [allChats, setAllChats] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [typingUsers, setTypingUsers] = useState(new Set());

    async function loadChats() {
        setLoading(true);
        try {
            const data = await apiFetch('/api/matches');
            const chats = data.matches || [];
            setAllChats(chats);
            setFiltered(chats);
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    }

    useEffect(() => {
        if (!isAuthenticated) return navigate('/', { replace: true });
        loadChats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    // Live Socket Listeners for Online Status and Typing
    const { socket } = useAuth();
    useEffect(() => {
        if (!socket) return;

        const handleOnline = ({ userId, online }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (online) next.add(userId.toString());
                else next.delete(userId.toString());
                return next;
            });
        };

        const handleTypingStart = ({ fromUserId }) => {
            setTypingUsers(prev => new Set(prev).add(fromUserId.toString()));
        };
        const handleTypingStop = ({ fromUserId }) => {
            setTypingUsers(prev => {
                const next = new Set(prev);
                next.delete(fromUserId.toString());
                return next;
            });
        };

        socket.on('online_status', handleOnline);
        socket.on('typing_start', handleTypingStart);
        socket.on('typing_stop', handleTypingStop);

        return () => {
            socket.off('online_status', handleOnline);
            socket.off('typing_start', handleTypingStart);
            socket.off('typing_stop', handleTypingStop);
        };
    }, [socket]);

    const handleSearch = (q) => {
        setSearch(q);
        if (!q) return setFiltered(allChats);
        setFiltered(allChats.filter(m => m.name.toLowerCase().includes(q.toLowerCase())));
    };

    const getPreview = (m) => {
        const msg = m.last_message;
        if (!msg) return <span style={{ color: 'var(--primary)', fontWeight: 600 }}>New match! Say hi 👋</span>;
        if ((msg.startsWith('/uploads/') || (msg.startsWith('http') && msg.includes('/aura-')))) {
            const isVoice = msg.includes('voice') || msg.includes('webm');
            const isImg = msg.includes('image') || msg.includes('jpg') || msg.includes('png');
            const prefix = m.last_message_mine ? 'You: ' : '';
            return prefix + (isVoice ? '🎤 Voice message' : isImg ? '📷 Photo' : '📎 Attachment');
        }
        return (m.last_message_mine ? 'You: ' : '') + msg;
    };

    return (
        <div className="profile-page view-animate" style={{ paddingBottom: '90px' }}>
            {/* Header Area */}
            <div className="page-header" style={{ padding: '30px 20px 10px' }}>
                <h1 className="font-serif" style={{ fontSize: '2.4rem', margin: 0 }}>Echoes</h1>
                <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Your cosmic connections</p>
            </div>

            {/* Futuristic Search */}
            <div style={{ padding: '0 20px', marginBottom: '20px' }}>
                <div className="glass-card" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 20px',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border)',
                    borderRadius: '15px'
                }}>
                    <span className="material-symbols-rounded" style={{ opacity: 0.5 }}>search</span>
                    <input
                        placeholder="Seek a connection..."
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        style={{ background: 'none', border: 'none', color: 'white', fontSize: '1rem', width: '100%', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Connection List */}
            <div className="chat-list" id="chat-list-content" style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loading ? (
                    <div className="view-animate" style={{ textAlign: 'center', padding: '100px 0' }}>
                        <div className="spinner" style={{ margin: '0 auto 20px' }} />
                        <p style={{ opacity: 0.5 }}>Tuning signals...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', padding: '0 20px' }}>
                        <div className="glass-card holographic" style={{ padding: '60px 40px', textAlign: 'center', borderRadius: '32px', maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ background: 'rgba(139,92,246,0.15)', width: '96px', height: '96px', borderRadius: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', boxShadow: '0 0 30px rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.3)' }}>
                                <span className="material-symbols-rounded" style={{ color: 'var(--primary-light)', fontSize: '3rem' }}>auto_awesome</span>
                            </div>
                            <h3 className="font-serif" style={{ fontSize: '1.8rem', marginBottom: '12px' }}>No Resonance Yet</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '32px', fontSize: '0.95rem' }}>Match with someone to start a cosmic transmission!</p>
                            <button className="btn-primary" onClick={() => navigate('/discover')} style={{ width: '100%', padding: '14px', borderRadius: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>radar</span> Begin Discovery
                            </button>
                        </div>
                    </div>
                ) : (
                    filtered.map(m => {
                        const hasUnread = m.unread_count > 0;
                        const isTyping = typingUsers.has(m.user_id.toString());
                        const isOnline = onlineUsers.has(m.user_id.toString());

                        return (
                            <div
                                key={m.match_id}
                                className={`chat-item-aura glass-card ${hasUnread ? 'holographic unread' : ''}`}
                                onClick={() => navigate('/chat/convo', { state: { match_id: m.match_id, name: m.name, photo: m.photo, user_id: m.user_id } })}
                                style={{
                                    padding: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    transition: 'transform 0.3s ease, background 0.3s ease',
                                    cursor: 'pointer',
                                    border: hasUnread ? '1px solid var(--primary)' : '1px solid var(--border)'
                                }}
                            >
                                <div style={{ position: 'relative' }}>
                                    <img
                                        src={m.photo || defaultAvatar(m.name)}
                                        alt=""
                                        style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid' + (hasUnread ? 'var(--primary)' : 'rgba(255,255,255,0.1)') }}
                                    />
                                    {isOnline && (
                                        <span style={{
                                            position: 'absolute',
                                            bottom: '2px',
                                            right: '2px',
                                            width: '14px',
                                            height: '14px',
                                            background: '#22c55e',
                                            borderRadius: '50%',
                                            border: '3px solid var(--bg-main)',
                                            boxShadow: '0 0 10px rgba(34, 197, 94, 0.5)'
                                        }} />
                                    )}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                                        <h3 className="font-serif" style={{ margin: 0, fontSize: '1.15rem' }}>{m.name}</h3>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{m.last_message_time ? formatTime(m.last_message_time) : 'Recent'}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.9rem',
                                            opacity: hasUnread ? 1 : 0.6,
                                            fontWeight: hasUnread ? 600 : 400,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            color: isTyping ? 'var(--primary-light)' : 'inherit'
                                        }}>
                                            {isTyping ? (
                                                <span className="typing-aura">pulsing signal...</span>
                                            ) : getPreview(m)}
                                        </p>

                                        {hasUnread && (
                                            <span className="unread-dot-glow" style={{
                                                width: '10px',
                                                height: '10px',
                                                background: 'var(--primary)',
                                                borderRadius: '50%',
                                                boxShadow: '0 0 10px var(--primary)'
                                            }} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
