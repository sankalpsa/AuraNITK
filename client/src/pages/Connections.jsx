import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar } from '../utils/helpers';

export default function Connections() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    async function loadMatches() {
        setLoading(true);
        try {
            const data = await apiFetch('/api/matches');
            setMatches(data.matches || []);
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    }

    useEffect(() => {
        if (!isAuthenticated) return navigate('/', { replace: true });
        loadMatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    return (
        <div className="connections-page view-animate">
            <div className="page-header"><h1 className="font-serif">Matches</h1></div>
            <div id="conn-content" style={{ padding: 14 }}>
                {loading ? (
                    <div className="empty-state"><div className="spinner" style={{ width: 32, height: 32 }} /><h3>Loading...</h3></div>
                ) : matches.length === 0 ? (
                    <div className="empty-state" style={{ paddingTop: 60 }}>
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)' }}>group</span>
                        <h3>No matches yet</h3>
                        <p>Keep swiping to find your match!</p>
                        <button className="btn-primary" style={{ maxWidth: 200, marginTop: 16 }} onClick={() => navigate('/discover')}>
                            <span className="material-symbols-outlined">style</span>Discover
                        </button>
                    </div>
                ) : (
                    <>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                            {matches.length} match{matches.length !== 1 ? 'es' : ''}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '15px' }}>
                            {matches.map(m => (
                                <div key={m.match_id} className="aura-grid-item glass-card holographic" onClick={() =>
                                    navigate('/chat/convo', { state: { match_id: m.match_id, name: m.name, photo: m.photo, user_id: m.user_id } })
                                }>
                                    <img src={m.photo || defaultAvatar(m.name)} alt={m.name}
                                        onError={(e) => { e.target.src = defaultAvatar(m.name); }} />
                                    <div className="aura-item-overlay">
                                        <h3 style={{ margin: 0, fontSize: '1rem' }}>{m.name}</h3>
                                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6 }}>{m.branch || 'Aura Soul'}</p>
                                    </div>
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--gradient-aura)', borderRadius: '10px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700 }}>MATCH</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
