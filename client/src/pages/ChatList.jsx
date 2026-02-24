import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar, formatTime, escapeHtml } from '../utils/helpers';

export default function ChatList() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [allChats, setAllChats] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!isAuthenticated) return navigate('/', { replace: true });
        loadChats();
    }, [isAuthenticated]);

    const loadChats = async () => {
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
    };

    const handleSearch = (q) => {
        setSearch(q);
        if (!q) return setFiltered(allChats);
        setFiltered(allChats.filter(m => m.name.toLowerCase().includes(q.toLowerCase())));
    };

    const getPreview = (m) => {
        const msg = m.last_message;
        if (!msg) return <span style={{ color: 'var(--primary)', fontWeight: 600 }}>New match! Say hi 👋</span>;
        if ((msg.startsWith('/uploads/') || (msg.startsWith('http') && msg.includes('/nitknot-')))) {
            const isVoice = msg.includes('voice') || msg.includes('webm');
            const isImg = msg.includes('image') || msg.includes('jpg') || msg.includes('png');
            const prefix = m.last_message_mine ? 'You: ' : '';
            return prefix + (isVoice ? '🎤 Voice message' : isImg ? '📷 Photo' : '📎 Attachment');
        }
        return (m.last_message_mine ? 'You: ' : '') + msg;
    };

    return (
        <div className="chat-list-page view-animate">
            <div className="page-header"><h1 className="font-serif">Messages</h1></div>
            <div className="chat-search">
                <span className="material-symbols-outlined">search</span>
                <input placeholder="Search conversations..." value={search} onChange={e => handleSearch(e.target.value)} />
            </div>
            <div className="chat-list" id="chat-list-content">
                {loading ? (
                    <div className="empty-state"><div className="spinner" style={{ width: 32, height: 32 }} /><h3>Loading...</h3></div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state" style={{ paddingTop: 60 }}>
                        <span className="material-symbols-outlined">chat_bubble</span>
                        <h3>No conversations</h3>
                        <p>Match with someone to start chatting!</p>
                    </div>
                ) : (
                    filtered.map(m => {
                        const hasUnread = m.unread_count > 0;
                        return (
                            <div key={m.match_id} className="chat-item" onClick={() =>
                                navigate('/chat/convo', { state: { match_id: m.match_id, name: m.name, photo: m.photo, user_id: m.user_id } })
                            }>
                                <img className="chat-avatar" src={m.photo || defaultAvatar(m.name)}
                                    onError={(e) => { e.target.src = defaultAvatar(m.name); }} alt={m.name} />
                                <div className="chat-info">
                                    <div className="chat-info-top">
                                        <h3>{m.name}</h3>
                                        <span>{m.last_message_time ? formatTime(m.last_message_time) : 'New'}</span>
                                    </div>
                                    <p className={`chat-preview ${hasUnread ? 'unread' : ''}`}>{getPreview(m)}</p>
                                </div>
                                {hasUnread && <span className="chat-unread-badge">{m.unread_count > 9 ? '9+' : m.unread_count}</span>}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
