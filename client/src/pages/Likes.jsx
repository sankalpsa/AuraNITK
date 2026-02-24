import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar } from '../utils/helpers';

export default function Likes() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [likes, setLikes] = useState([]);
    const [loading, setLoading] = useState(true);

    async function loadLikes() {
        setLoading(true);
        try {
            const data = await apiFetch('/api/likes/received');
            setLikes(data || []);
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    }

    useEffect(() => {
        if (!isAuthenticated) return navigate('/', { replace: true });
        loadLikes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    return (
        <div className="likes-page view-animate">
            <div className="page-header"><h1 className="font-serif">Likes You 💕</h1></div>
            <div style={{ padding: 14 }}>
                {loading ? (
                    <div className="empty-state"><div className="spinner" style={{ width: 32, height: 32 }} /><h3>Loading...</h3></div>
                ) : likes.length === 0 ? (
                    <div className="empty-state" style={{ paddingTop: 60 }}>
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)' }}>favorite_border</span>
                        <h3>No likes yet</h3>
                        <p>Keep swiping! Your likes will show up here.</p>
                    </div>
                ) : (
                    <>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                            {likes.length} people liked you
                        </p>
                        <div className="connections-grid">
                            {likes.map(u => (
                                <div key={u.id} className="connection-card"
                                    onClick={() => navigate('/profile/view', { state: { profile: u } })}>
                                    <img src={u.photo || defaultAvatar(u.name)} alt={u.name}
                                        style={u.is_super_like ? { border: '3px solid #3b82f6' } : {}}
                                        onError={(e) => { e.target.src = defaultAvatar(u.name); }} />
                                    <div className="connection-card-overlay">
                                        <h3>{u.name}, {u.age} {u.is_verified ? '✅' : ''}</h3>
                                        <p>{u.branch}</p>
                                    </div>
                                    <span className="connection-card-badge" style={u.is_super_like ? { background: '#3b82f6' } : {}}>
                                        {u.is_super_like ? '⭐ Super Like' : 'Likes You'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
