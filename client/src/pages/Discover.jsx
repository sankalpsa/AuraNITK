import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar } from '../utils/helpers';
import { BRANCHES, YEARS } from '../constants';
import MatchOverlay from '../components/common/MatchOverlay';

export default function Discover() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();

    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [matchData, setMatchData] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filterBranch, setFilterBranch] = useState('all');
    const [filterYear, setFilterYear] = useState('all');

    async function loadProfiles() {
        setLoading(true);
        try {
            let url = '/api/discover';
            const params = [];
            if (filterBranch !== 'all') params.push(`branch=${encodeURIComponent(filterBranch)}`);
            if (filterYear !== 'all') params.push(`year=${encodeURIComponent(filterYear)}`);
            if (params.length > 0) url += '?' + params.join('&');
            const data = await apiFetch(url);
            setCards(data.profiles || []);
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    }

    useEffect(() => {
        if (!isAuthenticated) return navigate('/', { replace: true });
        loadProfiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, filterBranch, filterYear]);

    const handleTileClick = (profile) => {
        // Direct users to ViewProfile where they can read Prompts and decide to Like/Pass
        navigate('/profile/view', { state: { profile, fromRadar: true } });
    };

    if (loading) {
        return (
            <div className="discover-page view-animate">
                <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src="/aura-logo.png" className="logo-img-small" alt="Aura" />
                    <h1 className="font-serif">Radar</h1>
                </div>
                <div className="empty-state"><div className="spinner" style={{ width: 32, height: 32 }} /><h3>Locating elite connections...</h3></div>
            </div>
        );
    }

    return (
        <div className="discover-page view-animate" style={{ height: 'auto', minHeight: '100vh', overflowY: 'visible' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="font-serif">Aura Radar</h1>
                <button className="btn-icon" onClick={() => setShowFilters(!showFilters)}
                    style={{ background: (filterBranch !== 'all' || filterYear !== 'all') ? 'var(--primary)' : 'var(--bg-elevated)', border: 'none', width: 38, height: 38, borderRadius: '50%' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: (filterBranch !== 'all' || filterYear !== 'all') ? '#111' : 'var(--text-secondary)' }}>tune</span>
                </button>
            </div>

            {showFilters && (
                <div className="discover-filters">
                    <div className="filter-row">
                        <label className="filter-label">Branch</label>
                        <select className="filter-select" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); }}>
                            <option value="all">All Branches</option>
                            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="filter-row">
                        <label className="filter-label">Year</label>
                        <select className="filter-select" value={filterYear} onChange={(e) => { setFilterYear(e.target.value); }}>
                            <option value="all">All Years</option>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button className="btn-primary" style={{ width: '100%', marginTop: 8, padding: '10px 0', color: '#111' }} onClick={() => { setShowFilters(false); loadProfiles(); }}>
                        <span className="material-symbols-outlined">search</span> Apply Filters
                    </button>
                </div>
            )}

            {cards.length === 0 ? (
                <div className="empty-state">
                    <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)', fontSize: 56 }}>diamond</span>
                    <h3>The Radar is Empty</h3>
                    <p style={{ maxWidth: 280 }}>You've seen all available profiles matching your criteria.</p>
                    <button className="btn-primary" style={{ maxWidth: 200, marginTop: 16, color: '#111' }} onClick={loadProfiles}>
                        <span className="material-symbols-outlined">refresh</span>Refresh Radar
                    </button>
                </div>
            ) : (
                <div className="aura-radar-grid">
                    {cards.map((p) => (
                        <div key={p.id} className="radar-tile" onClick={() => handleTileClick(p)}>
                            <img src={p.photo || defaultAvatar(p.name)} alt={p.name} className="radar-photo" loading="lazy" onError={(e) => { e.target.src = defaultAvatar(p.name); }} />
                            <div className="radar-overlay">
                                <div className="radar-name">
                                    {p.name.split(' ')[0]}, {p.age}
                                    {p.is_verified === 1 && <span className="material-symbols-outlined fill-icon" style={{ fontSize: 18, color: 'var(--primary)' }}>verified</span>}
                                </div>
                                <div className="radar-detail">{p.branch}</div>
                            </div>
                            {(p.match_percent || 70) >= 85 && (
                                <div className="radar-badge">Highly Compatible</div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {matchData && (
                <MatchOverlay
                    matchedUser={matchData.user}
                    matchId={matchData.matchId}
                    onClose={() => {
                        setMatchData(null);
                        loadProfiles(); // Refresh radar after match
                    }}
                    onChat={() => {
                        setMatchData(null);
                        navigate('/chat/convo', {
                            state: { match_id: matchData.matchId, user_id: matchData.user.id, name: matchData.user.name, photo: matchData.user.photo }
                        });
                    }}
                />
            )}
        </div>
    );
}
