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
    const [searchMode, setSearchMode] = useState('local'); // 'local' or 'global'

    async function loadProfiles() {
        setLoading(true);
        try {
            let url = '/api/discover';
            const params = [];
            if (filterBranch !== 'all') params.push(`branch=${encodeURIComponent(filterBranch)}`);
            if (filterYear !== 'all') params.push(`year=${encodeURIComponent(filterYear)}`);
            if (searchMode === 'local') params.push(`local=true`);
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
    }, [isAuthenticated, filterBranch, filterYear, searchMode]);

    const handleTileClick = (profile) => {
        // Direct users to ViewProfile where they can read Prompts and decide to Like/Pass
        navigate('/profile/view', { state: { profile, fromRadar: true } });
    };

    if (loading) {
        return (
            <div className="discover-page view-animate">
                <div className="page-header">
                    <h1 className="font-serif text-aurora">Aura Radar</h1>
                </div>
                <div className="empty-state" style={{ height: '60vh' }}>
                    <div className="cosmic-loader">
                        <div className="spinner" style={{ width: 48, height: 48, borderTopColor: 'var(--primary)' }} />
                    </div>
                    <h3 className="font-serif" style={{ marginTop: '24px', opacity: 0.8 }}>Calibrating Aura Frequencies...</h3>
                </div>
            </div>
        );
    }

    return (
        <div className="discover-page view-animate" style={{ paddingBottom: '120px' }}>
            <div className="radar-pulse-bg"></div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 className="font-serif" style={{ fontSize: '2.5rem', lineHeight: '1' }}>Radar</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                        {searchMode === 'local' ? 'NEARBY DIMENSIONS' : 'GLOBAL FREQUENCIES'}
                    </p>
                </div>
                <button className="btn-icon holographic" onClick={() => setShowFilters(!showFilters)}
                    style={{ background: (filterBranch !== 'all' || filterYear !== 'all') ? 'var(--gradient-primary)' : 'var(--bg-elevated)', border: 'none', width: 44, height: 44, borderRadius: '14px', position: 'relative' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 22, color: (filterBranch !== 'all' || filterYear !== 'all') ? 'white' : 'var(--text-secondary)' }}>tune</span>
                    {(filterBranch !== 'all' || filterYear !== 'all') && <div className="filter-dot-active" />}
                </button>
            </div>

            {showFilters && (
                <div className="discover-filters auth-card holographic view-animate" style={{ padding: '24px', marginBottom: '32px' }}>
                    <div className="discovery-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--bg-elevated)', padding: '6px', borderRadius: '16px' }}>
                        <button
                            className={`tab-btn ${searchMode === 'local' ? 'active' : ''}`}
                            onClick={() => setSearchMode('local')}
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: searchMode === 'local' ? 'var(--bg-card)' : 'transparent', color: searchMode === 'local' ? 'var(--primary-light)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.3s ease', boxShadow: searchMode === 'local' ? 'var(--shadow-sm)' : 'none' }}
                        >
                            Local 🏛️
                        </button>
                        <button
                            className={`tab-btn ${searchMode === 'global' ? 'active' : ''}`}
                            onClick={() => setSearchMode('global')}
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: searchMode === 'global' ? 'var(--bg-card)' : 'transparent', color: searchMode === 'global' ? 'var(--primary-light)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.3s ease', boxShadow: searchMode === 'global' ? 'var(--shadow-sm)' : 'none' }}
                        >
                            Global ✨
                        </button>
                    </div>

                    <div className="filter-row" style={{ marginBottom: '20px' }}>
                        <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Academic Sphere</label>
                        <select className="filter-select" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); }}>
                            <option value="all">Everywhere</option>
                            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    <div className="filter-row" style={{ marginBottom: '28px' }}>
                        <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Journey Stage</label>
                        <select className="filter-select" value={filterYear} onChange={(e) => { setFilterYear(e.target.value); }}>
                            <option value="all">Any year</option>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <button className="btn-primary" style={{ width: '100%' }} onClick={() => { setShowFilters(false); loadProfiles(); }}>
                        <span className="material-symbols-rounded">sync_alt</span> Apply Sync
                    </button>
                </div>
            )}

            {cards.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: '0 20px' }}>
                    <div className="empty-state glass-card holographic" style={{ padding: '60px 40px', textAlign: 'center', borderRadius: '32px', maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ background: 'var(--primary-soft)', width: '96px', height: '96px', borderRadius: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px', boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                            <span className="material-symbols-rounded" style={{ color: 'var(--primary-light)', fontSize: '3rem' }}>satellite_alt</span>
                        </div>
                        <h3 className="font-serif" style={{ fontSize: '1.8rem', marginBottom: '12px' }}>Static on the Radar</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '32px', fontSize: '0.95rem' }}>
                            All known frequencies have been explored. Expand your parameters to find more.
                        </p>
                        <button className="btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onClick={loadProfiles}>
                            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>refresh</span> Re-scan Area
                        </button>
                    </div>
                </div>
            ) : (
                <div className="aura-radar-grid">
                    {cards.map((p) => (
                        <div key={p.id} className="radar-tile holographic glass-card" onClick={() => handleTileClick(p)}>
                            <div className="radar-photo-container">
                                <img src={p.photo || defaultAvatar(p.name)} alt={p.name} className="radar-photo" loading="lazy" onError={(e) => { e.target.src = defaultAvatar(p.name); }} />
                                <div className="radar-photo-gradient" />
                            </div>
                            <div className="radar-overlay">
                                <div className="radar-name-tag">
                                    <span className="radar-name">{p.name.split(' ')[0]}, {p.age}</span>
                                    {p.is_verified === 1 && <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--accent-cyan)' }}>verified</span>}
                                </div>
                                <div className="radar-stats-tag">
                                    <span className="material-symbols-rounded" style={{ fontSize: 12 }}>school</span>
                                    {p.branch}
                                </div>
                            </div>
                            {(p.match_percent || 70) >= 85 && (
                                <div className="radar-badge">
                                    <span className="badge-bg" />
                                    <span className="badge-text"><span className="material-symbols-rounded" style={{ fontSize: 12 }}>star</span> TOP AURA</span>
                                </div>
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
                        loadProfiles();
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
