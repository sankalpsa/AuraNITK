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
            showToast(data.message || 'Whisper Sent!', 'success');
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
        <div className="profile-page view-animate" style={{ paddingBottom: '140px' }}>
            {/* Immersive Top Bar */}
            <div className={`profile-nav-header glass-card holographic ${headerShrunk ? 'shrunk' : ''}`} style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 100,
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 0,
                borderBottom: headerShrunk ? '1px solid var(--border)' : 'none',
                background: headerShrunk ? 'var(--bg-glass)' : 'transparent',
                backdropFilter: headerShrunk ? 'blur(20px)' : 'none',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <button className="btn-icon" onClick={() => navigate(-1)} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}>
                    <span className="material-symbols-rounded">arrow_back</span>
                </button>

                {headerShrunk && (
                    <div className="view-profile-header-identity view-animate" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={photos[0].url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span className="font-serif" style={{ fontWeight: 600 }}>{profile.name}</span>
                    </div>
                )}

                <button className="btn-icon" onClick={() => setShowReport(true)} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}>
                    <span className="material-symbols-rounded">gavel</span>
                </button>
            </div>

            {/* Photo Hero Section */}
            <div
                className="profile-hero"
                style={{ height: '550px', position: 'relative' }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className="photo-carousel" style={{ height: '100%', position: 'relative' }}>
                    <img
                        src={photos[activePhoto].url}
                        alt={profile.name}
                        className="hero-background-photo"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onClick={() => setImgViewerOpen(true)}
                    />
                    <div className="hero-gradient-overlay" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,1,24,0.4), transparent 30%, rgba(10,1,24,0.95))' }} />

                    <div className="hero-overlay-info" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 20px', zIndex: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div>
                                <h1 className="font-serif text-glow-purple" style={{ fontSize: '3rem', lineHeight: 1, marginBottom: '8px' }}>{profile.name}, {profile.age}</h1>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <span className="badge-pill">
                                        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>school</span>
                                        {profile.branch}
                                    </span>
                                    {profile.is_verified === 1 && (
                                        <span className="badge-pill active">
                                            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>verified</span>
                                            Verified
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Photo Indicators */}
                {photos.length > 1 && (
                    <div className="carousel-indicators" style={{ position: 'absolute', bottom: '150px', right: '20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10 }}>
                        {photos.map((_, i) => (
                            <div key={i} className={`indicator ${i === activePhoto ? 'active' : ''}`} onClick={() => setActivePhoto(i)} style={{ width: '4px', height: i === activePhoto ? '24px' : '8px', background: i === activePhoto ? 'var(--primary)' : 'rgba(255,255,255,0.3)', borderRadius: '4px', transition: 'all 0.3s ease' }} />
                        ))}
                    </div>
                )}
            </div>

            {/* Profile Content */}
            <div className="profile-content" style={{ padding: '0 20px', marginTop: '-40px', position: 'relative', zIndex: 10 }}>

                {/* About/Bio Section */}
                {profile.bio && (
                    <section className="profile-section view-animate" style={{ animationDelay: '0.1s', marginBottom: '32px' }}>
                        <div className="glass-card holographic" style={{ padding: '28px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary-light)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>whatshot</span>
                                <h4 className="font-serif" style={{ margin: 0, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>The Ignition</h4>
                            </div>
                            <p className="font-serif" style={{ fontSize: '1.25rem', lineHeight: 1.5, margin: 0, color: 'var(--text)' }}>{profile.bio}</p>
                            {profile.pickup_line && (
                                <div style={{ marginTop: '24px', padding: '16px', background: 'var(--primary-soft)', borderRadius: '16px', borderLeft: '4px solid var(--primary)' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.1em' }}>Spark Signal</div>
                                    <p className="font-serif" style={{ margin: 0, fontStyle: 'italic', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>"{profile.pickup_line}"</p>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Spectral Anthem (Spotify) */}
                {(profile.spotify_artist || profile.spotify_song) && (
                    <section className="profile-section view-animate" style={{ animationDelay: '0.2s', marginBottom: '32px' }}>
                        <h4 className="font-serif" style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '16px' }}>Soul Anthem</h4>
                        {profile.spotify_artist === 'iframe' ? (
                            <div className="spotify-embed-container" style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(29, 185, 84, 0.2)' }}>
                                <iframe 
                                    style={{ borderRadius: '12px' }} 
                                    src={`https://open.spotify.com/embed/track/${profile.spotify_song}?utm_source=generator&theme=0`} 
                                    width="100%" 
                                    height="152" 
                                    frameBorder="0" 
                                    allowFullScreen="" 
                                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                                    loading="lazy"
                                />
                            </div>
                        ) : (
                            <div className="spotify-card glass-card card-hover-zoom" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(29, 185, 84, 0.05)', border: '1px solid rgba(29, 185, 84, 0.2)' }}>
                                <div className="spotify-icon-container" style={{ background: '#1DB954', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(29, 185, 84, 0.4)' }}>
                                    <span className="material-symbols-rounded" style={{ color: 'white' }}>music_note</span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', wordBreak: 'break-word' }}>{profile.spotify_song || 'Unidentified Track'}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{profile.spotify_artist || 'Unknown Artist'}</div>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Interests Fragment */}
                {interests.length > 0 && (
                    <section className="profile-section view-animate" style={{ animationDelay: '0.3s', marginBottom: '32px' }}>
                        <h4 className="font-serif" style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '16px' }}>Soul Resonance</h4>
                        <div className="tag-cloud" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {interests.map(tag => (
                                <span key={tag} className={`tag-pill glass-card ${sharedInterests.includes(tag) ? 'shared holographic' : ''}`} style={{
                                    padding: '8px 16px',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: '0.85rem',
                                    background: sharedInterests.includes(tag) ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                                    color: sharedInterests.includes(tag) ? 'white' : 'var(--text-main)',
                                    border: '1px solid var(--border)'
                                }}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* Subconscious Echoes (Q&A) */}
                <section className="profile-section view-animate" style={{ animationDelay: '0.4s', marginBottom: '120px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 className="font-serif" style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Anonymous Whispers</h4>
                        {!isMatch && (
                            <button className="btn-ghost" onClick={() => setShowAskInput(!showAskInput)} style={{ fontSize: '0.75rem' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>bolt</span>
                                Ignite Connection
                            </button>
                        )}
                    </div>

                    {showAskInput && (
                        <div className="ask-input-card glass-card holographic view-animate" style={{ padding: '20px', marginBottom: '20px' }}>
                            <textarea
                                placeholder={`Whisper a seductive secret to ${firstName}...`}
                                className="textarea-field"
                                value={anonQuestion}
                                onChange={e => setAnonQuestion(e.target.value)}
                                style={{ minHeight: '80px', marginBottom: '16px' }}
                            />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-primary" style={{ flex: 1 }} onClick={sendAnonQuestion} disabled={!anonQuestion.trim() || sendingQ}>
                                    {sendingQ ? 'Igniting Connection...' : 'Ignite'}
                                </button>
                                <button className="btn-ghost" onClick={() => setShowAskInput(false)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    <div className="answered-qs-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {answeredQs.length === 0 ? (
                            <div className="glass-card" style={{ padding: '30px', textAlign: 'center', opacity: 0.5 }}>
                                <p style={{ fontSize: '0.9rem', margin: 0 }}>Silence. No whispers ignited yet.</p>
                            </div>
                        ) : (
                            answeredQs.map(q => (
                                <div key={q.id} className="echo-card glass-card holographic card-hover-zoom" style={{ padding: '20px' }}>
                                    <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--primary-light)' }}>Q: {q.question}</p>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px' }}>
                                        <p style={{ margin: 0, fontSize: '0.95rem' }}>{q.answer}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>

            {/* Action Buttons Hub */}
            <div className="vp-action-hub" style={{
                position: 'fixed',
                bottom: '30px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                zIndex: 200,
                padding: '12px 24px',
                background: 'rgba(10,1,24,0.6)',
                backdropFilter: 'blur(15px)',
                borderRadius: '50px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
                {isMatch ? (
                    <button className="btn-primary holographic" style={{ padding: '12px 30px', borderRadius: '30px' }} onClick={() =>
                        navigate('/chat/convo', {
                            state: { match_id: profile.match_id, user_id: profile.id, name: profile.name, photo: photos[0].url }
                        })
                    }>
                        <span className="material-symbols-rounded" style={{ marginRight: '8px' }}>chat</span>
                        Message {firstName}
                    </button>
                ) : (
                    <>
                        <button className="vp-btn pass" onClick={() => handleQuickSwipe('pass')} style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 28 }}>close</span>
                        </button>

                        <button className="vp-btn superlike holographic" onClick={() => handleQuickSwipe('super_like')} style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: 'var(--gradient-spark)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 20px var(--primary-soft)'
                        }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 32 }}>stars</span>
                        </button>

                        <button className="vp-btn like" onClick={() => handleQuickSwipe('like')} style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'var(--gradient-primary)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 28 }}>favorite</span>
                        </button>
                    </>
                )}
            </div>

            {/* Modals & Overlays */}
            {showReport && <ReportModal userId={profile.id} onClose={() => setShowReport(false)} />}
            {matchData && (
                <MatchOverlay
                    matchedUser={matchData.user}
                    onClose={() => { setMatchData(null); navigate(-1); }}
                    onChat={() => {
                        setMatchData(null);
                        navigate('/chat/convo', {
                            state: {
                                match_id: matchData.matchId,
                                user_id: matchData.user.id,
                                name: matchData.user.name,
                                photo: matchData.user.photo
                            }
                        });
                    }}
                />
            )}

            {imgViewerOpen && (
                <div className="image-viewer-overlay view-animate" onClick={() => setImgViewerOpen(false)} style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.95)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <img src={photos[activePhoto].url} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '12px' }} />
                    {photos[activePhoto].caption && (
                        <p style={{ marginTop: '20px', color: 'white', fontSize: '1.1rem', textAlign: 'center' }}>{photos[activePhoto].caption}</p>
                    )}
                    <button className="btn-icon" style={{ position: 'absolute', top: '20px', right: '20px', color: 'white' }}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>
            )}
        </div>
    );
}
