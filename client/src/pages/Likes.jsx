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
            <div className="page-header"><h1 className="font-serif">Likes You ✨</h1></div>
            <div style={{ padding: 14 }}>
                {loading ? (
                    <div className="empty-state"><div className="spinner" style={{ width: 32, height: 32 }} /><h3>Loading...</h3></div>
                ) : likes.length === 0 ? (
                    <div className="empty-state" style={{ paddingTop: 60 }}>
                        <span className="material-symbols-rounded fill-icon" style={{ color: 'var(--primary)' }}>favorite_border</span>
                        <h3>No likes yet</h3>
                        <p>Keep swiping! Your likes will show up here.</p>
                    </div>
                ) : (
                    <>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                            {likes.length} people liked you
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '15px' }}>
                            {likes.map(u => {
                                const isBlur = !u.is_super_like;
                                return (
                                    <div key={u.id} className="aura-grid-item glass-card holographic"
                                        onClick={() => navigate('/profile/view', { state: { profile: u } })}>
                                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                            <img src={u.photo || defaultAvatar(u.name)} alt={u.name}
                                                style={{ filter: isBlur ? 'blur(15px) grayscale(0.5)' : 'none', scale: isBlur ? '1.2' : '1' }}
                                                onError={(e) => { e.target.src = defaultAvatar(u.name); }} />
                                            {isBlur && (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: 'var(--primary-light)' }}>lock</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="aura-item-overlay">
                                            <h3 style={{ margin: 0, fontSize: '0.9rem' }}>{isBlur ? 'Aura Mystery' : u.name}</h3>
                                            <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.6 }}>{isBlur ? 'Matched Frequency' : u.branch}</p>
                                        </div>
                                        <div style={{
                                            position: 'absolute', top: '10px', right: '10px',
                                            background: u.is_super_like ? 'var(--gradient-aura)' : 'rgba(0,0,0,0.5)',
                                            borderRadius: '10px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700
                                        }}>
                                            {u.is_super_like ? 'SUPER' : 'LIKE'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
