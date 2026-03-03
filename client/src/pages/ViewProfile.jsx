import { useState, useRef, useEffect } from 'react';
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
    const [headerShrunk, setHeaderShrunk] = useState(false);
    const scrollRef = useRef(null);

    // Anonymous Q&A state
    const [anonQuestion, setAnonQuestion] = useState('');
    const [sendingQ, setSendingQ] = useState(false);
    const [answeredQs, setAnsweredQs] = useState([]);
    const [showAskInput, setShowAskInput] = useState(false);

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

    // Parallax-like header shrink on scroll
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => setHeaderShrunk(el.scrollTop > 280);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    // Load answered questions for this profile
    useEffect(() => {
        if (profile?.id) {
            apiFetch(`/api/anonymous-questions/profile/${profile.id}`)
                .then(data => setAnsweredQs(data.questions || []))
                .catch(() => { });
        }
    }, [profile?.id]);

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

    const sendAnonQuestion = async () => {
        if (!anonQuestion.trim() || sendingQ) return;
        setSendingQ(true);
        try {
            const data = await apiFetch('/api/anonymous-question', {
                method: 'POST',
                body: JSON.stringify({ receiver_id: profile.id, question: anonQuestion.trim() }),
            });
            showToast(data.message || 'Question sent!', 'success');
            setAnonQuestion('');
            setShowAskInput(false);
        } catch (e) {
            showToast(e.message, 'error');
        }
        setSendingQ(false);
    };

    const interests = profile.interests || [];
    const greenFlags = profile.green_flags || [];
    const redFlags = profile.red_flags || [];
    const sharedInterests = profile.shared_interests || [];

    return (
        <div className="portfolio-profile" ref={scrollRef}>
            {/* ── Floating Top Bar ── */}
            <div className={`portfolio-topbar ${headerShrunk ? 'shrunk' : ''}`}>
                <button className="portfolio-back" onClick={() => navigate(-1)}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                {headerShrunk && (
                    <div className="portfolio-topbar-info">
                        <img src={photos[0]} alt="" className="portfolio-topbar-avatar"
                            onError={(e) => { e.target.src = defaultAvatar(profile.name); }} />
                        <span className="portfolio-topbar-name font-serif">{profile.name}</span>
                    </div>
                )}
                {!isMatch && (
                    <button className="portfolio-back" style={{ marginLeft: 'auto' }}
                        onClick={() => setShowReport(true)}>
                        <span className="material-symbols-outlined">flag</span>
                    </button>
                )}
            </div>

            {/* ══════════════════════ HERO SECTION ══════════════════════ */}
            <div className="portfolio-hero">
                <img
                    src={photos[0]}
                    alt={profile.name}
                    className="portfolio-hero-img"
                    onError={(e) => { e.target.src = defaultAvatar(profile.name); }}
                />
                <div className="portfolio-hero-overlay" />
                <div className="portfolio-hero-content">
                    <div className="portfolio-hero-name">
                        <h1 className="font-serif">{profile.name}<span className="portfolio-age">, {profile.age}</span></h1>
                        {profile.is_verified && (
                            <span className="material-symbols-outlined fill-icon portfolio-verified">verified</span>
                        )}
                    </div>
                    <p className="portfolio-hero-subtitle">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>school</span>
                        {profile.branch} • {profile.year}
                    </p>
                    <p className="portfolio-hero-location">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>
                        NITK Surathkal
                    </p>
                    {profile.match_percent && (
                        <div className="portfolio-match-pill">✨ {profile.match_percent}% match</div>
                    )}
                </div>
            </div>

            {/* ══════════════════════ PICKUP LINE BANNER ══════════════════════ */}
            {profile.pickup_line && (
                <div className="portfolio-pickup-section">
                    <div className="portfolio-pickup-icon">💬</div>
                    <blockquote className="portfolio-pickup-quote">
                        "{profile.pickup_line}"
                    </blockquote>
                </div>
            )}

            {/* ══════════════════════ ABOUT ME ══════════════════════ */}
            <div className="portfolio-section">
                <div className="portfolio-section-header">
                    <span className="material-symbols-outlined section-icon">person</span>
                    <h2 className="font-serif">About Me</h2>
                </div>
                <p className="portfolio-bio">{profile.bio || 'Hey there! 👋 I haven\'t written a bio yet, but I\'m here looking for something special.'}</p>
            </div>

            {/* ══════════════════════ PHOTO GALLERY ══════════════════════ */}
            {photos.length > 1 && (
                <div className="portfolio-section">
                    <div className="portfolio-section-header">
                        <span className="material-symbols-outlined section-icon">photo_library</span>
                        <h2 className="font-serif">Gallery</h2>
                    </div>
                    <div className="portfolio-gallery">
                        {photos.map((photo, idx) => (
                            <div key={idx} className={`portfolio-gallery-item ${idx === 0 ? 'featured' : ''}`}>
                                <img src={photo} alt={`${profile.name} photo ${idx + 1}`}
                                    onError={(e) => { e.target.src = defaultAvatar(profile.name); }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════════════ ASK ANONYMOUSLY ══════════════════════ */}
            {!isMatch && (
                <div className="portfolio-section anon-section">
                    <div className="portfolio-section-header">
                        <span className="material-symbols-outlined section-icon" style={{ color: '#a78bfa' }}>chat_bubble</span>
                        <h2 className="font-serif">Ask Anonymously</h2>
                    </div>
                    <p className="anon-subtitle">
                        Curious about something? Ask {profile.name.split(' ')[0]} a question — they won't know who asked!
                    </p>

                    {!showAskInput ? (
                        <button className="anon-ask-btn" onClick={() => setShowAskInput(true)}>
                            <span className="material-symbols-outlined">edit_note</span>
                            Ask a Question
                        </button>
                    ) : (
                        <div className="anon-input-wrapper">
                            <textarea
                                className="anon-textarea"
                                placeholder={`What would you like to ask ${profile.name.split(' ')[0]}?`}
                                value={anonQuestion}
                                onChange={(e) => setAnonQuestion(e.target.value)}
                                maxLength={300}
                                rows={3}
                                autoFocus
                            />
                            <div className="anon-input-footer">
                                <span className="anon-char-count">{anonQuestion.length}/300</span>
                                <div className="anon-btn-group">
                                    <button className="anon-cancel-btn" onClick={() => { setShowAskInput(false); setAnonQuestion(''); }}>
                                        Cancel
                                    </button>
                                    <button
                                        className="anon-send-btn"
                                        onClick={sendAnonQuestion}
                                        disabled={!anonQuestion.trim() || sendingQ}
                                    >
                                        {sendingQ ? (
                                            <div className="spinner" style={{ width: 16, height: 16 }} />
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                                                Send
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="anon-privacy-note">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield</span>
                                Your identity stays completely hidden
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════ ANSWERED Q&A ══════════════════════ */}
            {answeredQs.length > 0 && (
                <div className="portfolio-section">
                    <div className="portfolio-section-header">
                        <span className="material-symbols-outlined section-icon" style={{ color: '#f59e0b' }}>forum</span>
                        <h2 className="font-serif">Q&A</h2>
                        <span className="anon-qa-count">{answeredQs.length}</span>
                    </div>
                    <div className="anon-qa-list">
                        {answeredQs.map(q => (
                            <div key={q.id} className="anon-qa-card">
                                <div className="anon-qa-question">
                                    <span className="anon-qa-badge">🕵️ Anonymous</span>
                                    <p>{q.question}</p>
                                </div>
                                <div className="anon-qa-answer">
                                    <span className="anon-qa-answerer">{profile.name.split(' ')[0]}'s answer</span>
                                    <p>{q.answer}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════════════ SPOTIFY ANTHEM ══════════════════════ */}
            {(profile.spotify_artist || profile.spotify_song) && (
                <div className="portfolio-section">
                    <div className="portfolio-section-header">
                        <span className="material-symbols-outlined section-icon" style={{ color: '#1DB954' }}>music_note</span>
                        <h2 className="font-serif">My Anthem</h2>
                    </div>
                    <div className="portfolio-spotify-card">
                        <div className="spotify-vinyl" />
                        <div className="spotify-info">
                            {profile.spotify_song && <div className="spotify-song">{profile.spotify_song}</div>}
                            {profile.spotify_artist && <div className="spotify-artist">{profile.spotify_artist}</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════ PROFILE PROMPTS ══════════════════════ */}
            {(profile.prompts || []).length > 0 && (
                <div className="portfolio-section">
                    <div className="portfolio-section-header">
                        <span className="material-symbols-outlined section-icon">chat_bubble</span>
                        <h2 className="font-serif">Prompts</h2>
                    </div>
                    {profile.prompts.map((p, i) => (
                        <div key={p.id || i} className="portfolio-prompt-card">
                            <div className="prompt-question">{p.question}</div>
                            <div className="prompt-answer">{p.answer}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* ══════════════════════ INTERESTS ══════════════════════ */}
            {interests.length > 0 && (
                <div className="portfolio-section">
                    <div className="portfolio-section-header">
                        <span className="material-symbols-outlined section-icon">interests</span>
                        <h2 className="font-serif">Interests</h2>
                    </div>
                    <div className="portfolio-tags">
                        {interests.map(i => (
                            <span key={i} className={`portfolio-tag ${sharedInterests.includes(i) ? 'shared' : ''}`}>
                                {sharedInterests.includes(i) && '✨ '}{i}
                            </span>
                        ))}
                    </div>
                    {sharedInterests.length > 0 && (
                        <p className="portfolio-shared-note">
                            You share {sharedInterests.length} interest{sharedInterests.length > 1 ? 's' : ''}!
                        </p>
                    )}
                </div>
            )}

            {/* ══════════════════════ GREEN FLAGS ══════════════════════ */}
            {greenFlags.length > 0 && (
                <div className="portfolio-section">
                    <div className="portfolio-section-header">
                        <span className="material-symbols-outlined section-icon" style={{ color: 'var(--success)' }}>flag</span>
                        <h2 className="font-serif">Green Flags</h2>
                    </div>
                    <div className="portfolio-flags">
                        {greenFlags.map(f => (
                            <div key={f} className="portfolio-flag green">
                                <span className="material-symbols-outlined fill-icon">check_circle</span>
                                <span>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════════════ RED FLAGS ══════════════════════ */}
            {redFlags.length > 0 && (
                <div className="portfolio-section">
                    <div className="portfolio-section-header">
                        <span className="material-symbols-outlined section-icon" style={{ color: 'var(--danger)' }}>flag</span>
                        <h2 className="font-serif">Red Flags</h2>
                    </div>
                    <div className="portfolio-flags">
                        {redFlags.map(f => (
                            <div key={f} className="portfolio-flag red">
                                <span className="material-symbols-outlined fill-icon">warning</span>
                                <span>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════════════ BOTTOM SPACER ══════════════════════ */}
            <div style={{ height: 100 }} />

            {/* ══════════════════════ STICKY ACTION BAR ══════════════════════ */}
            <div className="portfolio-actions">
                {isMatch ? (
                    <button className="portfolio-action-btn portfolio-action-chat" onClick={() =>
                        navigate('/chat/convo', { state: { match_id: profile.match_id, user_id: profile.id || profile.user_id, name: profile.name, photo: profile.photo } })
                    }>
                        <span className="material-symbols-outlined fill-icon">chat</span>
                        <span>Message</span>
                    </button>
                ) : (
                    <>
                        <button className="portfolio-action-btn portfolio-action-pass" onClick={() => handleQuickSwipe('pass')} title="Pass">
                            <span className="material-symbols-outlined fill-icon">close</span>
                        </button>
                        <button className="portfolio-action-btn portfolio-action-superlike" onClick={() => handleQuickSwipe('super_like')} title="Super Like">
                            <span className="material-symbols-outlined fill-icon">star</span>
                        </button>
                        <button className="portfolio-action-btn portfolio-action-like" onClick={() => handleQuickSwipe('like')} title="Like">
                            <span className="material-symbols-outlined fill-icon">favorite</span>
                            <span>Like</span>
                        </button>
                    </>
                )}
            </div>

            {/* ── Modals ── */}
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
