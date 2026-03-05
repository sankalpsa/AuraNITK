import { useState, useEffect, useRef, useCallback } from 'react';
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
    const [swipePending, setSwipePending] = useState(false);
    const [undoProfile, setUndoProfile] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filterBranch, setFilterBranch] = useState('all');
    const [filterYear, setFilterYear] = useState('all');
    const [doubleTapAnim, setDoubleTapAnim] = useState(false);
    const cardRef = useRef(null);
    const lastTap = useRef(0);
    const dragState = useRef({ isDragging: false, startX: 0, startY: 0, currentX: 0, startTime: 0 });

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

    const processSwipe = async (action) => {
        if (swipePending || cards.length === 0) return;
        setSwipePending(true);

        const profile = cards[0];
        if (action === 'pass') {
            setUndoProfile(profile);
        } else {
            setUndoProfile(null);
        }

        setCards(prev => prev.slice(1));

        try {
            const data = await apiFetch('/api/swipe', {
                method: 'POST',
                body: JSON.stringify({ target_id: profile.id, action }),
            });
            if (data.match && data.matched_user) {
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Celebration vibration
                setMatchData({ user: data.matched_user, matchId: data.match_id });
            } else {
                if (action === 'like') {
                    if (navigator.vibrate) navigator.vibrate(50); // Subtle pop
                    showToast('💕 Liked!', 'success', 1500);
                }
                if (action === 'super_like') {
                    if (navigator.vibrate) navigator.vibrate([50, 50, 50]); // Triple pop
                    showToast('⭐ Super Liked!', 'success', 1500);
                }
            }
        } catch (e) {
            if (!e.message.includes('Already swiped')) showToast(e.message, 'error');
        }
        setSwipePending(false);
    };

    const undoSwipe = () => {
        if (!undoProfile) return showToast('Nothing to undo', 'info');
        setCards(prev => [undoProfile, ...prev]);
        setUndoProfile(null);
        showToast('Undone! ↩️', 'info');
    };

    const handleSwipeAction = (action) => {
        if (cards.length === 0) return showToast('No more cards!', 'error');
        const el = cardRef.current;
        if (!el) return;

        el.classList.add('animating');
        if (action === 'like') {
            el.style.transform = 'translateX(700px) rotate(30deg)';
            const l = el.querySelector('.swipe-label-like'); if (l) l.style.opacity = 1;
        } else if (action === 'pass') {
            el.style.transform = 'translateX(-700px) rotate(-30deg)';
            const n = el.querySelector('.swipe-label-nope'); if (n) n.style.opacity = 1;
        } else {
            el.style.transform = 'translateY(-700px) scale(0.8)';
        }
        el.style.opacity = '0';
        setTimeout(() => processSwipe(action), 300);
    };

    // Touch/drag logic
    const setupDrag = useCallback((el) => {
        if (!el) return;
        cardRef.current = el;
        const ds = dragState.current;

        const onStart = (e) => {
            if (e.target.closest('.card-view-btn')) return;
            ds.isDragging = true;
            ds.startTime = Date.now();
            ds.startX = e.touches ? e.touches[0].clientX : e.clientX;
            ds.startY = e.touches ? e.touches[0].clientY : e.clientY;
            ds.currentX = 0;
            el.classList.add('swiping');
            el.classList.remove('animating');
            el.style.willChange = 'transform';
        };

        const onMove = (e) => {
            if (!ds.isDragging) return;
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            ds.currentX = cx - ds.startX;
            const dy = cy - ds.startY;
            if (Math.abs(dy) > Math.abs(ds.currentX) && Math.abs(ds.currentX) < 10) return;
            e.preventDefault?.();
            const rotate = ds.currentX * 0.07;
            el.style.transform = `translateX(${ds.currentX}px) rotate(${rotate}deg)`;
            const likeLabel = el.querySelector('.swipe-label-like');
            const nopeLabel = el.querySelector('.swipe-label-nope');
            if (likeLabel) likeLabel.style.opacity = Math.max(0, Math.min(1, ds.currentX / 80));
            if (nopeLabel) nopeLabel.style.opacity = Math.max(0, Math.min(1, -ds.currentX / 80));
        };

        const onEnd = () => {
            if (!ds.isDragging) return;
            ds.isDragging = false;
            el.classList.remove('swiping');
            el.style.willChange = '';
            const elapsed = Date.now() - ds.startTime;
            const velocity = Math.abs(ds.currentX) / elapsed;
            const threshold = window.innerWidth * 0.25;

            if (Math.abs(ds.currentX) > threshold || (velocity > 0.5 && Math.abs(ds.currentX) > 60)) {
                const dir = ds.currentX > 0 ? 'like' : 'pass';
                el.classList.add('animating');
                el.style.transform = `translateX(${ds.currentX > 0 ? 700 : -700}px) rotate(${ds.currentX > 0 ? 30 : -30}deg)`;
                el.style.opacity = '0';
                setTimeout(() => processSwipe(dir), 300);
            } else {
                el.classList.add('animating');
                el.style.transform = '';
                const likeLabel = el.querySelector('.swipe-label-like');
                const nopeLabel = el.querySelector('.swipe-label-nope');
                if (likeLabel) likeLabel.style.opacity = 0;
                if (nopeLabel) nopeLabel.style.opacity = 0;
                setTimeout(() => el.classList.remove('animating'), 300);
            }
            ds.currentX = 0;
        };

        el.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        el.addEventListener('touchstart', onStart, { passive: true });
        el.addEventListener('touchmove', onMove, { passive: false });
        el.addEventListener('touchend', onEnd);

        return () => {
            el.removeEventListener('mousedown', onStart);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            el.removeEventListener('touchstart', onStart);
            el.removeEventListener('touchmove', onMove);
            el.removeEventListener('touchend', onEnd);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keyboard Shortcuts for Web
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (cards.length === 0 || swipePending || matchData || showFilters) return;
            if (e.key === 'ArrowLeft') handleSwipeAction('pass');
            if (e.key === 'ArrowRight') handleSwipeAction('like');
            if (e.key === 'ArrowUp') handleSwipeAction('super_like');
            if (e.key === 'Backspace') undoSwipe();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cards.length, swipePending, matchData, showFilters]);

    const handlePhotoTap = (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap.current;
        if (tapLength < 300 && tapLength > 0 && !swipePending) {
            e.preventDefault();
            setDoubleTapAnim(true);
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
            setTimeout(() => {
                setDoubleTapAnim(false);
                handleSwipeAction('like');
            }, 600);
        }
        lastTap.current = currentTime;
    };

    if (loading) {
        return (
            <div className="discover-page view-animate">
                <div className="page-header"><h1 className="font-serif">Discover</h1></div>
                <div className="empty-state"><div className="spinner" style={{ width: 32, height: 32 }} /><h3>Loading...</h3></div>
            </div>
        );
    }

    return (
        <div className="discover-page view-animate">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="font-serif">Discover</h1>
                <button className="btn-icon" onClick={() => setShowFilters(!showFilters)}
                    style={{ background: (filterBranch !== 'all' || filterYear !== 'all') ? 'var(--primary)' : 'var(--bg-elevated)', border: 'none', width: 38, height: 38, borderRadius: '50%' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: (filterBranch !== 'all' || filterYear !== 'all') ? '#fff' : 'var(--text-secondary)' }}>tune</span>
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
                    <button className="btn-primary" style={{ width: '100%', marginTop: 8, padding: '10px 0' }} onClick={() => { setShowFilters(false); loadProfiles(); }}>
                        <span className="material-symbols-outlined">search</span> Apply Filters
                    </button>
                </div>
            )}

            <div className="card-stack" id="card-stack">
                {cards.length === 0 ? (
                    <div className="empty-state">
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)' }}>explore</span>
                        <h3>You've seen everyone!</h3>
                        <p>Check back later for new profiles</p>
                        <button className="btn-primary" style={{ maxWidth: 200, marginTop: 16 }} onClick={loadProfiles}>
                            <span className="material-symbols-outlined">refresh</span>Refresh
                        </button>
                    </div>
                ) : (
                    cards.slice(0, 3).reverse().map((p, idx) => {
                        const pos = Math.min(2, cards.slice(0, 3).length - 1 - idx);
                        const isTop = pos === 0;
                        return (
                            <div
                                key={p.id}
                                className={`swipe-card ${pos === 1 ? 'behind' : pos === 2 ? 'far-behind' : ''} ${(p.match_percent || 70) >= 85 ? 'golden-aura' : ''}`}
                                ref={isTop ? setupDrag : null}
                            >
                                <div className="card-photo-area" onClick={handlePhotoTap} onTouchEnd={handlePhotoTap}>
                                    <img src={p.photo || defaultAvatar(p.name)} alt={p.name} loading="lazy"
                                        onError={(e) => { e.target.src = defaultAvatar(p.name); }} />
                                    {isTop && doubleTapAnim && (
                                        <div className="double-tap-heart">
                                            <span className="material-symbols-outlined fill-icon">favorite</span>
                                        </div>
                                    )}
                                    <div className="card-gradient-top" />
                                    <div className="card-gradient-bottom" />
                                    <div className="card-info-overlay">
                                        <div className="card-name-row">
                                            <span className="card-name font-serif">{p.name}, {p.age}</span>
                                            {p.is_verified === 1 && <span className="material-symbols-outlined fill-icon" style={{ color: '#ee2b9d', fontSize: 20 }}>verified</span>}
                                        </div>
                                        <div className="card-detail">{p.branch} • {p.year}</div>
                                        <div className="card-location"><span className="material-symbols-outlined">location_on</span>NITK Surathkal</div>
                                        <div className={`card-match-badge ${(p.match_percent || 70) >= 85 ? 'high-match' : ''}`}>
                                            ✨ {p.match_percent || 70}% match
                                        </div>
                                    </div>
                                    <div className="swipe-label swipe-label-like">LIKE 💚</div>
                                    <div className="swipe-label swipe-label-nope">NOPE ❌</div>
                                </div>
                                <div className="card-body">
                                    <p className="card-bio">{p.bio || 'Hey there!'}</p>
                                    {p.pickup_line && (
                                        <p className="card-pickup" style={{ fontStyle: 'italic', color: 'var(--primary-light)', fontSize: '0.82rem', margin: '6px 0' }}>
                                            💬 "{p.pickup_line}"
                                        </p>
                                    )}
                                    <div className="card-tags">
                                        {(p.interests || []).slice(0, 4).map(i => <span key={i} className="card-tag">{i}</span>)}
                                    </div>
                                    <button className="card-view-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/profile/view', { state: { profile: p } });
                                    }}>
                                        View Full Profile
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {cards.length > 0 && (
                <div className="swipe-actions">
                    <button className="action-btn small" onClick={undoSwipe}
                        style={{ opacity: undoProfile ? 1 : 0.4, pointerEvents: undoProfile ? 'auto' : 'none' }}
                        title="Undo">
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--warning)', fontSize: 20 }}>undo</span>
                    </button>
                    <button className="action-btn medium" onClick={() => handleSwipeAction('pass')} title="Pass">
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--danger)', fontSize: 28 }}>close</span>
                    </button>
                    <button className="action-btn large" onClick={() => handleSwipeAction('like')} title="Like">
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--success)', fontSize: 32 }}>favorite</span>
                    </button>
                    <button className="action-btn medium" onClick={() => handleSwipeAction('super_like')} title="Super Like">
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--info)', fontSize: 28 }}>star</span>
                    </button>
                </div>
            )}

            {matchData && (
                <MatchOverlay
                    matchedUser={matchData.user}
                    matchId={matchData.matchId}
                    onClose={() => setMatchData(null)}
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
