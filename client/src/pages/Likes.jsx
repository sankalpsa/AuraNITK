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
            <div className="page-header"><h1 className="font-serif text-spark">Resonance</h1></div>
            <div style={{ padding: 14 }}>
                {loading ? (
                    <div className="empty-state"><div className="spinner" style={{ width: 32, height: 32 }} /><h3>Tuning the frequency...</h3></div>
                ) : likes.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: '0 20px' }}>
                        <div className="empty-state glass-card holographic" style={{ padding: '60px 40px', textAlign: 'center', borderRadius: '32px', maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ background: 'rgba(167, 139, 250, 0.08)', width: '96px', height: '96px', borderRadius: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', boxShadow: '0 0 20px rgba(167, 139, 250, 0.15)', border: '1px solid rgba(167, 139, 250, 0.15)' }}>
                                <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '3.5rem' }}>favorite</span>
                            </div>
                            <h3 className="font-serif" style={{ fontSize: '1.8rem', marginBottom: '12px' }}>Silent Sparks</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '32px', fontSize: '0.95rem' }}>
                                Your frequency is silent. Radiate your presence and the sparks will follow.
                            </p>
                            <button className="btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/discover')}>
                                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>bolt</span> Ignite Presence
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
                            {likes.length} SOULS RADIATING INTEREST
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '15px' }}>
                            {likes.map(u => {
                                const isBlur = !u.is_super_like;
                                return (
                                    <div key={u.id} className="spark-grid-item glass-card holographic"
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
                                        <div className="spark-item-overlay">
                                            <h3 style={{ margin: 0, fontSize: '0.9rem' }}>{isBlur ? 'Mystery Flame' : u.name}</h3>
                                            <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.6 }}>{isBlur ? 'Hidden Resonance' : u.branch}</p>
                                        </div>
                                        <div style={{
                                            position: 'absolute', top: '10px', right: '10px',
                                            background: u.is_super_like ? 'var(--gradient-spark)' : 'rgba(0,0,0,0.5)',
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
