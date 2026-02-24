import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useToast } from '../context/ToastContext';
import { defaultAvatar } from '../utils/helpers';
import ReportModal from '../components/common/ReportModal';
import MatchOverlay from '../components/common/MatchOverlay';

export default function ViewProfile() {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const profile = location.state?.profile;
    const [showReport, setShowReport] = useState(false);
    const [matchData, setMatchData] = useState(null);
    const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

    if (!profile) {
        navigate('/discover', { replace: true });
        return null;
    }

    const isMatch = !!profile.match_id;

    // Build photo array from user_photos data
    const photos = [];
    if (profile.photos && Array.isArray(profile.photos) && profile.photos.length > 0) {
        photos.push(...profile.photos.map(p => typeof p === 'string' ? p : p.photo_url));
    } else if (profile.photo) {
        photos.push(profile.photo);
    }
    if (photos.length === 0) photos.push(defaultAvatar(profile.name));

    const handleQuickSwipe = async (action) => {
        try {
            const data = await apiFetch('/api/swipe', {
                method: 'POST',
                body: JSON.stringify({ target_id: profile.id, action }),
            });
            if (data.match && data.matched_user) {
                setMatchData({ user: data.matched_user, matchId: data.match_id });
            } else {
                showToast(action === 'like' ? 'Liked! 💕' : action === 'super_like' ? '⭐ Super Liked!' : 'Passed', 'success', 1500);
                navigate(-1);
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    return (
        <div className="view-profile-page view-animate">
            <div className="profile-header">
                <button className="btn-icon" onClick={() => navigate(-1)}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="font-serif" style={{ fontSize: '1rem' }}>{profile.name}'s Profile</h2>
                {!isMatch && (
                    <button className="btn-icon" style={{ marginLeft: 'auto' }}
                        onClick={() => setShowReport(true)}>
                        <span className="material-symbols-outlined">flag</span>
                    </button>
                )}
            </div>

            <div className="vp-photo-section">
                {/* Multi-photo view */}
                {photos.length > 1 && (
                    <div className="photo-indicators" style={{ top: 12 }}>
                        {photos.map((_, idx) => (
                            <div key={idx} className={`photo-indicator ${idx === currentPhotoIdx ? 'active' : ''}`}
                                onClick={() => setCurrentPhotoIdx(idx)} />
                        ))}
                    </div>
                )}
                <img className="vp-photo" src={photos[currentPhotoIdx]} alt={profile.name}
                    onError={(e) => { e.target.src = defaultAvatar(profile.name); }} />
                {photos.length > 1 && (
                    <>
                        <button className="photo-nav-btn photo-prev" onClick={() => setCurrentPhotoIdx(Math.max(0, currentPhotoIdx - 1))}
                            style={{ opacity: currentPhotoIdx === 0 ? 0.3 : 1 }}>
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <button className="photo-nav-btn photo-next" onClick={() => setCurrentPhotoIdx(Math.min(photos.length - 1, currentPhotoIdx + 1))}
                            style={{ opacity: currentPhotoIdx === photos.length - 1 ? 0.3 : 1 }}>
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </>
                )}
                <div className="vp-photo-gradient" />
            </div>

            <div className="vp-info">
                <div className="vp-name-row">
                    <h1 className="vp-name font-serif">{profile.name}, {profile.age}</h1>
                    {profile.is_verified && <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)' }}>verified</span>}
                </div>
                <p className="vp-details">{profile.branch || ''} • {profile.year || ''} • NITK Surathkal</p>

                <div className="vp-section">
                    <h3>About</h3>
                    <p className="vp-bio">{profile.bio || 'No bio yet'}</p>
                    {profile.pickup_line && (
                        <div className="pickup-line" style={{ marginTop: 12 }}>
                            <span className="pickup-label">💬 Pickup Line</span>
                            <p className="pickup-text">"{profile.pickup_line}"</p>
                        </div>
                    )}
                </div>

                {/* Spotify Anthem */}
                {(profile.spotify_artist || profile.spotify_song) && (
                    <div className="vp-section">
                        <h3>🎵 Anthem</h3>
                        <div className="spotify-card">
                            <span className="material-symbols-outlined" style={{ color: '#1DB954', fontSize: 28 }}>music_note</span>
                            <div>
                                {profile.spotify_song && <div style={{ fontWeight: 600 }}>{profile.spotify_song}</div>}
                                {profile.spotify_artist && <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{profile.spotify_artist}</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Prompts */}
                {(profile.prompts || []).length > 0 && (
                    <div className="vp-section">
                        {profile.prompts.map(p => (
                            <div key={p.id} className="prompt-card" style={{ marginBottom: 12 }}>
                                <div className="prompt-question">{p.question}</div>
                                <div className="prompt-answer">{p.answer}</div>
                            </div>
                        ))}
                    </div>
                )}

                {(profile.interests || []).length > 0 && (
                    <div className="vp-section">
                        <h3>Interests</h3>
                        <div className="vp-tags">
                            {profile.interests.map(i => <span key={i} className="vp-tag">{i}</span>)}
                        </div>
                    </div>
                )}

                {(profile.green_flags || []).length > 0 && (
                    <div className="vp-section">
                        <h3>Green Flags 💚</h3>
                        <div className="flag-list">
                            {profile.green_flags.map(f => (
                                <div key={f} className="flag-item green">
                                    <span className="material-symbols-outlined fill-icon">check_circle</span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(profile.red_flags || []).length > 0 && (
                    <div className="vp-section">
                        <h3>Red Flags 🚩</h3>
                        <div className="flag-list">
                            {profile.red_flags.map(f => (
                                <div key={f} className="flag-item red">
                                    <span className="material-symbols-outlined fill-icon">warning</span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="vp-actions">
                {isMatch ? (
                    <button className="btn-primary" style={{ flex: 1 }} onClick={() =>
                        navigate('/chat/convo', { state: { match_id: profile.match_id, user_id: profile.id || profile.user_id, name: profile.name, photo: profile.photo } })
                    }>
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'white' }}>chat</span>Message
                    </button>
                ) : (
                    <>
                        <button className="action-btn medium" onClick={() => handleQuickSwipe('pass')} title="Pass">
                            <span className="material-symbols-outlined fill-icon" style={{ color: '#ef4444', fontSize: 24 }}>close</span>
                        </button>
                        <button className="btn-primary" style={{ flex: 1 }} onClick={() => handleQuickSwipe('like')}>
                            <span className="material-symbols-outlined fill-icon" style={{ color: 'white' }}>favorite</span>Like
                        </button>
                        <button className="action-btn small" onClick={() => handleQuickSwipe('super_like')} title="Super Like">
                            <span className="material-symbols-outlined fill-icon" style={{ color: '#3b82f6', fontSize: 20 }}>star</span>
                        </button>
                    </>
                )}
            </div>

            {showReport && <ReportModal userId={profile.id} userName={profile.name} onClose={() => setShowReport(false)} />}

            {matchData && (
                <MatchOverlay
                    matchedUser={matchData.user}
                    matchId={matchData.matchId}
                    onClose={() => { setMatchData(null); navigate(-1); }}
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
