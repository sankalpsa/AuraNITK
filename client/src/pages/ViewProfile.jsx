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
    const passedProfile = location.state?.profile;

    const [profileData, setProfileData] = useState(passedProfile || null);
    const [showReport, setShowReport] = useState(false);
    const [matchData, setMatchData] = useState(null);
    const [headerShrunk, setHeaderShrunk] = useState(false);
    const [activePhoto, setActivePhoto] = useState(0);
    const [imgViewerOpen, setImgViewerOpen] = useState(false);

    // Anonymous Q&A
    const [anonQuestion, setAnonQuestion] = useState('');
    const [sendingQ, setSendingQ] = useState(false);
    const [answeredQs, setAnsweredQs] = useState([]);
    const [showAskInput, setShowAskInput] = useState(false);

    // Redirect if no profile passed
    useEffect(() => {
        if (!passedProfile) navigate('/discover', { replace: true });
    }, [passedProfile, navigate]);

    // Auto-fetch full profile if data is partial (e.g. from chat)
    useEffect(() => {
        if (!passedProfile?.id) return;
        const needsFetch = !passedProfile.branch && !passedProfile.bio && !passedProfile.age;
        if (needsFetch) {
            apiFetch(`/api/users/${passedProfile.id}/profile`)
                .then(data => {
                    if (data.user) setProfileData(prev => ({ ...prev, ...data.user }));
                })
                .catch(() => { });
        }
    }, [passedProfile]);

    // Scroll listener for sticky header — uses window so normal doc-flow scroll works
    useEffect(() => {
        const onScroll = () => setHeaderShrunk(window.scrollY > 260);
        window.addEventListener('scroll', onScroll, { passive: true });
        // Scroll to top when page mounts
        window.scrollTo(0, 0);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Load answered questions
    useEffect(() => {
        if (profileData?.id) {
            apiFetch(`/api/anonymous-questions/profile/${profileData.id}`)
                .then(data => setAnsweredQs(data.questions || []))
                .catch(() => { });
        }
    }, [profileData?.id]);

    // Touch swipe for photo carousel
    const touchStartX = useRef(null);
    const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const handleTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 40) {
            if (dx < 0) setActivePhoto(p => (p + 1) % photos.length);
            else setActivePhoto(p => (p - 1 + photos.length) % photos.length);
        }
        touchStartX.current = null;
    };

    if (!profileData) return null;
    const profile = profileData;

    const isMatch = !!profile.match_id;

    // Build enriched photos array
    const photos = [];
    if (profile.photos && Array.isArray(profile.photos) && profile.photos.length > 0) {
        photos.push(...profile.photos.map(p =>
            typeof p === 'string' ? { url: p, caption: '' } : { url: p.photo_url, caption: p.caption || '' }
        ));
    } else if (profile.photo) {
        photos.push({ url: profile.photo, caption: '' });
    }
    if (photos.length === 0) photos.push({ url: defaultAvatar(profile.name), caption: '' });

    const handleQuickSwipe = async (action) => {
        try {
            const data = await apiFetch('/api/swipe', {
                method: 'POST',
                body: JSON.stringify({ target_id: profile.id, action }),
            });
            if (data.match && data.matched_user) {
                setMatchData({ user: data.matched_user, matchId: data.match_id });
            } else {
                showToast(action === 'like' ? 'Liked! ✨' : action === 'super_like' ? '⭐ Super Liked!' : 'Passed', 'success', 1500);
                navigate(-1);
            }
        } catch (e) { showToast(e.message, 'error'); }
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
        } catch (e) { showToast(e.message, 'error'); }
        setSendingQ(false);
    };

    const interests = profile.interests || [];
    const greenFlags = profile.green_flags || [];
    const redFlags = profile.red_flags || [];
    const sharedInterests = profile.shared_interests || [];
    const firstName = profile.name?.split(' ')[0] || profile.name;

    return (
        <div className="vp-page">

            {/* ── Floating Top Bar ── */}
            <div className={`vp-topbar ${headerShrunk ? 'shrunk' : ''}`}>
                <button className="vp-back-btn" onClick={() => navigate(-1)}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                {headerShrunk && (
                    <div className="vp-topbar-identity">
                        <img
                            src={photos[0].url}
                            alt=""
                            className="vp-topbar-avatar"
                            onError={(e) => { e.target.src = defaultAvatar(profile.name); }}
                        />
                        <span className="vp-topbar-name font-serif">{profile.name}</span>
                    </div>
                )}
                {!isMatch && (
                    <button className="vp-back-btn" style={{ marginLeft: 'auto' }} onClick={() => setShowReport(true)}>
                        <span className="material-symbols-outlined">flag</span>
                    </button>
                )}
            </div>

            {/* ══ PHOTO HERO CAROUSEL ══ */}
            <div
                className="vp-hero"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <img
                    src={photos[activePhoto].url}
                    alt={profile.name}
                    className="vp-hero-img"
                    onError={(e) => { e.target.src = defaultAvatar(profile.name); }}
                    onClick={() => setImgViewerOpen(true)}
                />
                <div className="vp-hero-gradient" />

                {/* Dot indicators */}
                {photos.length > 1 && (
                    <div className="vp-dots">
                        {photos.map((_, i) => (
                            <button
                                key={i}
                                className={`vp-dot ${i === activePhoto ? 'active' : ''}`}
                                onClick={() => setActivePhoto(i)}
                            />
                        ))}
                    </div>
                )}

                {/* Nav arrows for desktop */}
                {photos.length > 1 && (
                    <>
                        <button className="vp-arrow left" onClick={() => setActivePhoto(p => (p - 1 + photos.length) % photos.length)}>
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <button className="vp-arrow right" onClick={() => setActivePhoto(p => (p + 1) % photos.length)}>
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </>
                )}

                {/* Identity overlay */}
                <div className="vp-hero-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h1 className="vp-name font-serif">
                            {profile.name}
                            <span className="vp-age">, {profile.age}</span>
                        </h1>
                        {profile.is_verified === 1 && (
                            <span className="material-symbols-outlined fill-icon vp-verified">verified</span>
                        )}
                    </div>
                    {profile.match_percent && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(212, 175, 55, 0.15)', color: 'var(--primary)', borderRadius: 16, fontSize: '0.85rem', fontWeight: 600, marginTop: 8 }}>
                            <span className="material-symbols-outlined fill-icon" style={{ fontSize: 16 }}>diamond</span>
                            Aura Score: {profile.match_percent}%
                        </div>
                    )}
                    <p className="vp-meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>school</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{profile.institute || 'Global Aura'}</span>
                    </p>
                    <p className="vp-meta" style={{ marginTop: 4, opacity: 0.7, fontSize: '0.85rem' }}>
                        {profile.branch} · {profile.year}
                    </p>
                </div>

                {/* Photo counter */}
                {photos.length > 1 && (
                    <div className="vp-photo-counter">{activePhoto + 1}/{photos.length}</div>
                )}
            </div>

            {/* Caption strip for current photo */}
            {photos[activePhoto]?.caption && (
                <div className="vp-caption-strip">
                    <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: 0.6 }}>format_quote</span>
                    {photos[activePhoto].caption}
                </div>
            )}

            {/* Scrollable photo thumbnails */}
            {photos.length > 1 && (
                <div className="vp-photo-scroll">
                    {photos.map((p, i) => (
                        <div
                            key={i}
                            className={`vp-thumb ${i === activePhoto ? 'active' : ''}`}
                            onClick={() => setActivePhoto(i)}
                        >
                            <img src={p.url} alt={`Photo ${i + 1}`} onError={(e) => { e.target.src = defaultAvatar(profile.name); }} />
                            {p.caption && <div className="vp-thumb-caption">{p.caption}</div>}
                        </div>
                    ))}
                </div>
            )}

            {/* ══ CONTENT BODY ══ */}
            <div className="vp-body">

                {/* ── Pickup Line ── */}
                {profile.pickup_line && (
                    <div className="vp-pickup-banner">
                        <span className="vp-pickup-icon">💬</span>
                        <blockquote className="vp-pickup-quote">"{profile.pickup_line}"</blockquote>
                    </div>
                )}

                {/* ── About ── */}
                <div className="vp-section">
                    <div className="vp-section-hdr">
                        <span className="material-symbols-outlined vp-section-icon">person</span>
                        <h2 className="font-serif">About {firstName}</h2>
                    </div>
                    <p className="vp-bio">
                        {profile.bio || `Hey there! 👋 I'm ${firstName}, looking for something real.`}
                    </p>
                </div>

                {/* ── Prompts ── */}
                {(profile.prompts || []).length > 0 && (
                    <div className="vp-section">
                        <div className="vp-section-hdr">
                            <span className="material-symbols-outlined vp-section-icon">chat_bubble</span>
                            <h2 className="font-serif">Prompts</h2>
                        </div>
                        {profile.prompts.map((p, i) => (
                            <div key={p.id || i} className="vp-prompt-card">
                                <div className="vp-prompt-q">{p.question}</div>
                                <div className="vp-prompt-a">{p.answer}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Interests ── */}
                {interests.length > 0 && (
                    <div className="vp-section">
                        <div className="vp-section-hdr">
                            <span className="material-symbols-outlined vp-section-icon">interests</span>
                            <h2 className="font-serif">Interests</h2>
                        </div>
                        <div className="vp-tags">
                            {interests.map(i => (
                                <span key={i} className={`vp-tag ${sharedInterests.includes(i) ? 'shared' : ''}`}>
                                    {sharedInterests.includes(i) && '✨ '}{i}
                                </span>
                            ))}
                        </div>
                        {sharedInterests.length > 0 && (
                            <p className="vp-shared-note">
                                You both love {sharedInterests.slice(0, 2).join(' & ')}!
                            </p>
                        )}
                    </div>
                )}

                {/* ── Flags ── */}
                {(greenFlags.length > 0 || redFlags.length > 0) && (
                    <div className="vp-section vp-flags-grid">
                        {greenFlags.length > 0 && (
                            <div>
                                <div className="vp-section-hdr">
                                    <span className="material-symbols-outlined vp-section-icon" style={{ color: 'var(--success)' }}>flag</span>
                                    <h2 className="font-serif">Green Flags</h2>
                                </div>
                                <div className="vp-flags">
                                    {greenFlags.map(f => (
                                        <div key={f} className="vp-flag green">
                                            <span className="material-symbols-outlined fill-icon" style={{ fontSize: 16 }}>check_circle</span>
                                            {f}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {redFlags.length > 0 && (
                            <div style={{ marginTop: greenFlags.length > 0 ? 16 : 0 }}>
                                <div className="vp-section-hdr">
                                    <span className="material-symbols-outlined vp-section-icon" style={{ color: 'var(--danger)' }}>flag</span>
                                    <h2 className="font-serif">Red Flags</h2>
                                </div>
                                <div className="vp-flags">
                                    {redFlags.map(f => (
                                        <div key={f} className="vp-flag red">
                                            <span className="material-symbols-outlined fill-icon" style={{ fontSize: 16 }}>warning</span>
                                            {f}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Spotify Anthem ── */}
                {(profile.spotify_artist || profile.spotify_song) && (
                    <div className="vp-section">
                        <div className="vp-section-hdr">
                            <span className="material-symbols-outlined vp-section-icon" style={{ color: '#1DB954' }}>music_note</span>
                            <h2 className="font-serif">Anthem</h2>
                        </div>
                        <div className="vp-spotify-card">
                            <div className="vp-vinyl" />
                            <div className="vp-spotify-info">
                                {profile.spotify_song && <div className="vp-spotify-song">{profile.spotify_song}</div>}
                                {profile.spotify_artist && <div className="vp-spotify-artist">{profile.spotify_artist}</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Ask Anonymously ── */}
                {!isMatch && (
                    <div className="vp-section vp-anon-section">
                        <div className="vp-section-hdr">
                            <span className="material-symbols-outlined vp-section-icon" style={{ color: '#a78bfa' }}>chat_bubble</span>
                            <h2 className="font-serif">Ask Anonymously</h2>
                        </div>
                        <p className="vp-anon-sub">
                            Curious? Ask {firstName} anything — your identity stays hidden!
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
                                    placeholder={`What would you like to ask ${firstName}?`}
                                    value={anonQuestion}
                                    onChange={(e) => setAnonQuestion(e.target.value)}
                                    maxLength={300}
                                    rows={3}
                                    autoFocus
                                />
                                <div className="anon-input-footer">
                                    <span className="anon-char-count">{anonQuestion.length}/300</span>
                                    <div className="anon-btn-group">
                                        <button className="anon-cancel-btn" onClick={() => { setShowAskInput(false); setAnonQuestion(''); }}>Cancel</button>
                                        <button className="anon-send-btn" onClick={sendAnonQuestion} disabled={!anonQuestion.trim() || sendingQ}>
                                            {sendingQ ? <div className="spinner" style={{ width: 16, height: 16 }} /> : (
                                                <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>Send</>
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

                {/* ── Answered Q&A ── */}
                {answeredQs.length > 0 && (
                    <div className="vp-section">
                        <div className="vp-section-hdr">
                            <span className="material-symbols-outlined vp-section-icon" style={{ color: '#f59e0b' }}>forum</span>
                            <h2 className="font-serif">Q&A</h2>
                            <span className="vp-qa-count">{answeredQs.length}</span>
                        </div>
                        <div className="vp-qa-list">
                            {answeredQs.map(q => (
                                <div key={q.id} className="vp-qa-card">
                                    <div className="vp-qa-q">
                                        <span className="vp-qa-badge">🕵️ Anonymous</span>
                                        <p>{q.question}</p>
                                    </div>
                                    <div className="vp-qa-a">
                                        <span className="vp-qa-who">{firstName}'s answer</span>
                                        <p>{q.answer}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ height: 110 }} />

            {/* ══ STICKY ACTION BAR ══ */}
            <div className="vp-actions">
                {isMatch ? (
                    <button className="vp-action-btn chat" onClick={() =>
                        navigate('/chat/convo', {
                            state: { match_id: profile.match_id, user_id: profile.id || profile.user_id, name: profile.name, photo: photos[0].url }
                        })
                    }>
                        <span className="material-symbols-outlined fill-icon">chat</span>
                        <span>Message</span>
                    </button>
                ) : (
                    <>
                        <button className="vp-action-btn pass" onClick={() => handleQuickSwipe('pass')} title="Pass">
                            <span className="material-symbols-outlined fill-icon">close</span>
                        </button>
                        <button className="vp-action-btn superlike" onClick={() => handleQuickSwipe('super_like')} title="Super Like">
                            <span className="material-symbols-outlined fill-icon">star</span>
                        </button>
                        <button className="vp-action-btn like" onClick={() => handleQuickSwipe('like')} title="Like">
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

            {/* Full screen image viewer */}
            {imgViewerOpen && (
                <div className="vp-img-viewer" onClick={() => setImgViewerOpen(false)}>
                    <img src={photos[activePhoto].url} alt={profile.name} onError={(e) => { e.target.src = defaultAvatar(profile.name); }} />
                    {photos[activePhoto].caption && (
                        <div className="vp-img-viewer-caption">{photos[activePhoto].caption}</div>
                    )}
                </div>
            )}
        </div>
    );
}
