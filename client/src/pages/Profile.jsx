import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiUpload } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar } from '../utils/helpers';

export default function Profile() {
    const navigate = useNavigate();
    const { user, isAuthenticated, refreshUser } = useAuth();
    const { showToast } = useToast();

    const [stats, setStats] = useState({ matches: 0, likes_given: 0, likes_received: 0 });
    const [loading, setLoading] = useState(true);
    const [photos, setPhotos] = useState([]);
    const [activePhoto, setActivePhoto] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [showCrop, setShowCrop] = useState(false);
    const [cropImg, setCropImg] = useState(null);
    const [editingCaptionId, setEditingCaptionId] = useState(null);
    const [captionText, setCaptionText] = useState('');
    const [savingCaption, setSavingCaption] = useState(false);
    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const cropState = useRef({ offsetX: 0, offsetY: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 });
    const idInputRef = useRef(null);
    const [uploadingID, setUploadingID] = useState(false);

    // Anonymous Questions
    const [anonQuestions, setAnonQuestions] = useState([]);
    const [answeringId, setAnsweringId] = useState(null);
    const [answerText, setAnswerText] = useState('');
    const [submittingAnswer, setSubmittingAnswer] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return navigate('/', { replace: true });
        
        async function init() {
            setLoading(true);
            await Promise.all([
                loadStats(),
                loadPhotos(),
                loadAnonQuestions(),
                loadPrompts(),
                refreshUser()
            ]);
            setLoading(false);
        }
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    const loadStats = async () => {
        try { const data = await apiFetch('/api/stats'); setStats(data); } catch { }
    };

    const loadPhotos = async () => {
        try { const data = await apiFetch('/api/profile/photos'); setPhotos(data.photos || []); } catch { }
    };

    const loadAnonQuestions = async () => {
        try { const data = await apiFetch('/api/anonymous-questions/received'); setAnonQuestions(data.questions || []); } catch { }
    };

    const [prompts, setPrompts] = useState([]);
    const loadPrompts = async () => {
        try { const data = await apiFetch('/api/profile/prompts'); setPrompts(data.prompts || []); } catch { }
    };

    const answerQuestion = async (id) => {
        if (!answerText.trim() || submittingAnswer) return;
        setSubmittingAnswer(true);
        try {
            await apiFetch(`/api/anonymous-questions/${id}/answer`, {
                method: 'PUT',
                body: JSON.stringify({ answer: answerText.trim() }),
            });
            showToast('Answer posted! 💬', 'success');
            setAnsweringId(null);
            setAnswerText('');
            loadAnonQuestions();
        } catch (e) { showToast(e.message, 'error'); }
        setSubmittingAnswer(false);
    };

    const deleteQuestion = async (id) => {
        if (!window.confirm('Delete this question?')) return;
        try {
            await apiFetch(`/api/anonymous-questions/${id}`, { method: 'DELETE' });
            setAnonQuestions(prev => prev.filter(q => q.id !== id));
            showToast('Question removed', 'success');
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (fileInputRef.current) fileInputRef.current.value = '';
        const reader = new FileReader();
        reader.onload = (ev) => {
            setCropImg(ev.target.result);
            setShowCrop(true);
            cropState.current = { offsetX: 0, offsetY: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 };
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        if (!showCrop || !cropImg || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const draw = () => {
                const s = cropState.current;
                ctx.clearRect(0, 0, 300, 300);
                ctx.fillStyle = '#0d0d1a';
                ctx.fillRect(0, 0, 300, 300);
                const sc = Math.max(300 / img.width, 300 / img.height) * s.scale;
                const w = img.width * sc, h = img.height * sc;
                const x = (300 - w) / 2 + s.offsetX;
                const y = (300 - h) / 2 + s.offsetY;
                ctx.drawImage(img, x, y, w, h);
            };
            draw();
            canvas._draw = draw;
        };
        img.src = cropImg;
    }, [showCrop, cropImg]);

    const handleCropPointerDown = (e) => {
        const s = cropState.current;
        s.dragging = true;
        s.lastX = e.clientX || (e.touches?.[0]?.clientX || 0);
        s.lastY = e.clientY || (e.touches?.[0]?.clientY || 0);
    };
    const handleCropPointerMove = (e) => {
        const s = cropState.current;
        if (!s.dragging) return;
        const cx = e.clientX || (e.touches?.[0]?.clientX || 0);
        const cy = e.clientY || (e.touches?.[0]?.clientY || 0);
        s.offsetX += cx - s.lastX; s.offsetY += cy - s.lastY;
        s.lastX = cx; s.lastY = cy;
        canvasRef.current?._draw?.();
    };
    const handleCropPointerUp = () => { cropState.current.dragging = false; };
    const handleZoom = (dir) => {
        const s = cropState.current;
        s.scale = Math.max(0.3, Math.min(3, s.scale + dir * 0.15));
        canvasRef.current?._draw?.();
    };

    const handleIDUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingID(true);
        try {
            const fd = new FormData();
            fd.append('photo', file);
            await apiUpload('/api/profile/id-card', fd);
            showToast('ID uploaded for verification! 🪪', 'success');
            refreshUser();
        } catch (e) { showToast(e.message, 'error'); }
        setUploadingID(false);
    };

    const uploadCroppedPhoto = async () => {
        if (!canvasRef.current) return;
        setUploading(true);
        try {
            const blob = await new Promise(r => canvasRef.current.toBlob(r, 'image/jpeg', 0.9));
            const fd = new FormData();
            fd.append('photo', blob, 'profile.jpg');
            const data = await apiUpload('/api/profile/photo', fd);
            setPhotos(data.photos || []);
            showToast('Photo uploaded! 📸', 'success');
            setShowCrop(false);
            setCropImg(null);
            refreshUser();
        } catch (e) { showToast(e.message, 'error'); }
        setUploading(false);
    };

    const deletePhoto = async (photoId) => {
        if (!window.confirm('Delete this photo?')) return;
        try {
            const data = await apiFetch(`/api/profile/photo/${photoId}`, { method: 'DELETE' });
            setPhotos(data.photos || []);
            setActivePhoto(0);
            showToast('Photo deleted', 'success');
            refreshUser();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const setPrimary = async (photoId) => {
        try {
            const data = await apiFetch(`/api/profile/photo/${photoId}/primary`, { method: 'PUT' });
            setPhotos(data.photos || []);
            showToast('Primary photo updated! ⭐', 'success');
            refreshUser();
        } catch (e) { showToast(e.message, 'error'); }
    };

    const saveCaption = async (photoId) => {
        setSavingCaption(true);
        try {
            const data = await apiFetch(`/api/profile/photo/${photoId}/caption`, {
                method: 'PATCH',
                body: JSON.stringify({ caption: captionText }),
            });
            setPhotos(data.photos || []);
            setEditingCaptionId(null);
            showToast('Caption saved!', 'success');
        } catch (e) { showToast(e.message, 'error'); }
        setSavingCaption(false);
    };

    if (loading) {
        return (
            <div className="profile-page view-animate" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spark-loader"></div>
                <h3 className="font-serif" style={{ marginTop: '24px', opacity: 0.8 }}>Calibrating Your Signal...</h3>
            </div>
        );
    }

    if (!user) return null;

    // Calculate Profile Completeness
    let completeness = 0;
    if (user.bio?.length > 10) completeness += 15;
    if (photos.length > 0) completeness += 20;
    if (photos.length > 2) completeness += 15;
    if (user.interests && user.interests.length >= 3) completeness += 15;
    if ((user.green_flags && user.green_flags.length > 0) || (user.red_flags && user.red_flags.length > 0)) completeness += 15;
    if (user.spotify_artist || user.spotify_song) completeness += 10;
    if (user.pickup_line) completeness += 10;
    // Cap at 100% just in case
    completeness = Math.min(100, completeness);

    return (
        <div className="profile-page view-animate" style={{ paddingBottom: '180px' }}>
            {/* Top Bar Navigation */}
            <div className="profile-nav-header glass-card holographic" style={{ borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, borderRadius: 0 }}>
                <h1 className="font-serif" style={{ fontSize: '1.2rem', margin: 0 }}>My SPARK</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-icon" onClick={() => navigate('/settings')} style={{ background: 'var(--bg-elevated)', borderRadius: '50%' }}>
                        <span className="material-symbols-rounded">settings</span>
                    </button>
                    <button className="btn-icon primary" onClick={() => navigate('/profile/edit')} style={{ background: 'var(--gradient-primary)', borderRadius: '50%', color: 'white' }}>
                        <span className="material-symbols-rounded">edit</span>
                    </button>
                </div>
            </div>

            {/* Completeness Indicator */}
            {completeness < 100 && (
                <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--primary-light)' }}>magic_button</span>
                            Flame Intensity
                        </span>
                        <span style={{ color: completeness > 70 ? 'var(--accent-cyan)' : 'var(--primary-light)' }}>{completeness}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${completeness}%`,
                            background: completeness > 70 ? 'var(--accent-cyan)' : 'var(--gradient-primary)',
                            borderRadius: '3px',
                            transition: 'width 1s ease-out'
                        }} />
                    </div>
                </div>
            )}

            {/* Profile Hero */}
            <div className="profile-hero" style={{ height: '450px', position: 'relative', overflow: 'hidden' }}>
                <div className="hero-gradient-top" style={{ position: 'absolute', top: 0, width: '100%', height: '150px', background: 'linear-gradient(to bottom, rgba(10,1,24,0.8), transparent)', zIndex: 1 }} />
                <div className="photo-carousel" style={{ height: '100%' }}>
                    {photos.length > 0 ? (
                        <div className="active-photo-container" style={{ height: '100%', position: 'relative' }}>
                            <img src={photos[activePhoto].url || photos[activePhoto].photo_url} alt="Profile" className="hero-background-photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div className="hero-overlay-info" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 20px', background: 'linear-gradient(to top, rgba(10,1,24,0.9) 20%, transparent)', zIndex: 2 }}>
                                <h1 className="font-serif" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>{user.name.split(' ')[0]}, {user.age}</h1>
                                <div className="user-badge-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span className="badge-pill" style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>school</span>
                                        {user.branch}
                                    </span>
                                    {user.is_verified === 1 && (
                                        <span className="badge-pill active" style={{ background: 'var(--gradient-primary)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: 'white' }}>
                                            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>verified</span>
                                            Verified
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="hero-empty-photo" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-elevated)' }}>
                            <div className="auth-icon-large" onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer', marginBottom: '16px' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '2.5rem' }}>add_a_photo</span>
                            </div>
                            <p style={{ color: 'var(--text-muted)' }}>Ignite your visual presence</p>
                            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileSelect} />
                        </div>
                    )}
                    {photos.length > 1 && (
                        <div className="carousel-indicators" style={{ position: 'absolute', top: '100px', right: '20px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 5 }}>
                            {photos.map((_, i) => (
                                <div key={i} className={`indicator ${i === activePhoto ? 'active' : ''}`} onClick={() => setActivePhoto(i)} style={{ width: '4px', height: i === activePhoto ? '24px' : '8px', background: i === activePhoto ? 'var(--primary)' : 'rgba(255,255,255,0.3)', borderRadius: '4px', transition: 'all 0.3s ease', cursor: 'pointer' }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Stats */}
            <div className="profile-stats-grid view-animate" style={{ animationDelay: '0.1s', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '0 20px', marginTop: '-30px', position: 'relative', zIndex: 10 }}>
                <div className="stat-card glass-card holographic" style={{ textAlign: 'center', padding: '20px 10px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="stat-value text-glow-purple" style={{ display: 'block', fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-light)', marginBottom: '4px' }}>{stats.matches}</span>
                    <span className="stat-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>Seductive Fusions</span>
                </div>
                <div className="stat-card glass-card holographic" style={{ textAlign: 'center', padding: '20px 10px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="stat-value text-glow-cyan" style={{ display: 'block', fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-cyan)', marginBottom: '4px' }}>{stats.likes_received}</span>
                    <span className="stat-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>Admired By</span>
                </div>
                <div className="stat-card glass-card holographic" style={{ textAlign: 'center', padding: '20px 10px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="stat-value text-glow-magenta" style={{ display: 'block', fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-magenta)', marginBottom: '4px' }}>{stats.likes_given}</span>
                    <span className="stat-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>Sparked At</span>
                </div>
            </div>

            {/* The Manifesto (Bio & Pickup Line) */}
            <div className="view-animate" style={{ animationDelay: '0.2s', padding: '0 20px', marginTop: '24px', marginBottom: '32px' }}>
                <div className="glass-card holographic" style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-15px', right: '-15px', opacity: 0.1, color: 'var(--primary-light)' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '100px' }}>history_edu</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary-light)' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>menu_book</span>
                        <span className="font-serif" style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>The Ignition</span>
                    </div>
                    <p className="font-serif" style={{ fontSize: '1.25rem', lineHeight: '1.5', marginBottom: '24px', color: 'var(--text)', position: 'relative', zIndex: 1 }}>
                        {user.bio || "Searching for cosmic resonance."}
                    </p>
                    {user.pickup_line && (
                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.1em' }}>Spark Signal</div>
                            <p className="font-serif" style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{user.pickup_line}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Sections */}
            <div style={{ padding: '0 20px' }}>
                {/* Spectral Anthem (Spotify) */}
                {(user.spotify_artist || user.spotify_song) && (
                    <section className="profile-section view-animate" style={{ animationDelay: '0.3s', marginBottom: '40px' }}>
                        {user.spotify_artist === 'iframe' ? (
                            <div className="spotify-embed-container" style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(29, 185, 84, 0.2)' }}>
                                <iframe 
                                    style={{ borderRadius: '12px' }} 
                                    src={`https://open.spotify.com/embed/track/${user.spotify_song}?utm_source=generator&theme=0`} 
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
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#1DB954', marginBottom: '4px' }}>Soul Anthem</div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', wordBreak: 'break-word' }}>{user.spotify_song || 'Unidentified Track'}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{user.spotify_artist || 'Unknown Artist'}</div>
                                </div>
                                <div className="spotify-bars" style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '20px' }}>
                                    <div style={{ width: '3px', height: '60%', background: '#1DB954', borderRadius: '2px' }} />
                                    <div style={{ width: '3px', height: '100%', background: '#1DB954', borderRadius: '2px' }} />
                                    <div style={{ width: '3px', height: '40%', background: '#1DB954', borderRadius: '2px' }} />
                                    <div style={{ width: '3px', height: '80%', background: '#1DB954', borderRadius: '2px' }} />
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Elemental Resonance (Interests) */}
                {user.interests && user.interests.length > 0 && (
                    <section className="profile-section view-animate" style={{ animationDelay: '0.4s', marginBottom: '40px' }}>
                        <div className="section-header" style={{ marginBottom: '16px' }}>
                            <h3 className="font-serif" style={{ fontSize: '1.2rem' }}>Elemental Resonance</h3>
                        </div>
                        <div className="interest-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {user.interests.map(i => (
                                <span key={i} className="badge-pill holographic" style={{ background: 'var(--bg-elevated)', padding: '8px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                    {i}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* SPARK Spectrum (Flags) */}
                {((user.green_flags && user.green_flags.length > 0) || (user.red_flags && user.red_flags.length > 0)) && (
                    <section className="profile-section view-animate" style={{ animationDelay: '0.5s', marginBottom: '40px' }}>
                        <div className="section-header" style={{ marginBottom: '16px' }}>
                            <h3 className="font-serif" style={{ fontSize: '1.2rem' }}>SPARK Spectrum</h3>
                        </div>
                        <div className="flags-containers" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {user.green_flags && user.green_flags.length > 0 && (
                                <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #22c55e' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#22c55e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>brightness_high</span>
                                        Elemental Positivity
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {user.green_flags.map((f, idx) => (
                                            <span key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: 'rgba(34, 197, 94, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>{f}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {user.red_flags && user.red_flags.length > 0 && (
                                <div className="glass-card" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: '#ef4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>ac_unit</span>
                                        Avoidance Zones
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {user.red_flags.map((f, idx) => (
                                            <span key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>{f}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Broadcast Prompts */}
                {prompts.length > 0 && (
                    <section className="profile-section view-animate" style={{ animationDelay: '0.6s', marginBottom: '40px' }}>
                        <div className="section-header" style={{ marginBottom: '16px' }}>
                            <h3 className="font-serif" style={{ fontSize: '1.2rem' }}>Spark Transmissions</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {prompts.map(p => (
                                <div key={p.id} className="glass-card holographic card-hover-zoom" style={{ padding: '20px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--primary-light)', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid var(--border)', pb: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>sensors</span>
                                        {p.question}
                                    </div>
                                    <p className="font-serif" style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-main)', lineHeight: '1.5' }}>{p.answer}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                {/* Visual Fragments */}
                <section className="profile-section view-animate" style={{ animationDelay: '0.7s', marginBottom: '40px' }}>
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="font-serif" style={{ fontSize: '1.2rem' }}>Flame Fragments</h3>
                        <button className="btn-ghost" onClick={() => fileInputRef.current?.click()} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span> Add
                        </button>
                    </div>
                    <div className="photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {photos.map((p, i) => (
                            <div key={p.id} className={`photo-item glass-card holographic ${i === activePhoto ? 'active' : ''}`} style={{ aspectAspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: i === activePhoto ? '2px solid var(--primary)' : '1px solid var(--border)' }} onClick={() => setActivePhoto(i)}>
                                <img src={p.url || p.photo_url} alt="Profile fragment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div className="photo-item-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <button onClick={(e) => { e.stopPropagation(); setPrimary(p.id); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '4px', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.is_primary ? 'var(--primary)' : 'white' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{p.is_primary ? 'star' : 'grade'}</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {photos.length < 6 && (
                            <div className="photo-add-placeholder glass-card holographic" style={{ aspectAspectRatio: '1/1', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-elevated)', borderRadius: '12px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                                <span className="material-symbols-rounded" style={{ color: 'var(--text-muted)' }}>add</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* Subconscious Echoes */}
                <section className="profile-section view-animate" style={{ animationDelay: '0.8s', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 10px' }}>
                        <h3 className="font-serif" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Anonymous Whispers</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{anonQuestions.length} Received</span>
                    </div>
                    <div className="anon-questions-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {anonQuestions.length === 0 ? (
                            <div className="glass-card holographic" style={{ padding: '40px 20px', textAlign: 'center', borderRadius: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', opacity: 0.5, color: 'var(--text-secondary)' }}>psychology</span>
                                </div>
                                <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0 }}>No echoes detected yet.</p>
                            </div>
                        ) : (
                            anonQuestions.map(q => (
                                <div key={q.id} className="anon-card holographic glass-card" style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--primary-light)' }}>mystery</span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(q.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p style={{ fontSize: '0.95rem', marginBottom: '16px', fontWeight: 500 }}>{q.question_text}</p>
                                    {q.answer_text ? (
                                        <div style={{ background: 'var(--primary-soft)', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', position: 'relative' }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: 'var(--primary)' }}>My Ignition</div>
                                            <p style={{ margin: 0 }}>{q.answer_text}</p>
                                        </div>
                                    ) : (
                                        <div className="anon-answer-input">
                                            <textarea
                                                placeholder="Write your resonance..."
                                                className="textarea-field"
                                                style={{ fontSize: '0.85rem', minHeight: '60px', marginBottom: '12px' }}
                                                value={answeringId === q.id ? answerText : ''}
                                                onChange={(e) => {
                                                    setAnsweringId(q.id);
                                                    setAnswerText(e.target.value);
                                                }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn-primary" style={{ flex: 1, padding: '8px 0', fontSize: '0.8rem' }} disabled={submittingAnswer || !answerText.trim() || answeringId !== q.id} onClick={() => answerQuestion(q.id)}>
                                                    Ignite Whisper
                                                </button>
                                                <button className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={() => deleteQuestion(q.id)}>
                                                    Discard
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Identity Manifest (Verification) */}
                {user.is_verified === 0 && (
                    <section className="profile-section view-animate" style={{ animationDelay: '0.9s', marginBottom: '160px' }}>
                        <div className="verification-card glass-card holographic" style={{ padding: '20px', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                            <div style={{ flex: '0 0 auto', width: 48, height: 72, borderRadius: '24px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                                <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '1.8rem' }}>verified_user</span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 className="font-serif" style={{ fontSize: '1.2rem', marginBottom: '4px', margin: 0, fontWeight: 700 }}>Calibrate<br />Your<br />Soul</h3>
                                <p style={{ color: 'var(--text-muted)', margin: '8px 0 0 0', fontSize: '0.85rem', lineHeight: 1.4 }}>
                                    Upload your university ID to unlock global frequencies and the verified badge.
                                </p>
                            </div>
                            <button
                                onClick={() => idInputRef.current?.click()}
                                disabled={uploadingID}
                                style={{
                                    flex: '0 0 auto',
                                    width: 100,
                                    height: 100,
                                    borderRadius: '50%',
                                    background: 'var(--gradient-primary)',
                                    border: 'none',
                                    color: 'white',
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                    lineHeight: 1.2,
                                    boxShadow: '0 10px 30px rgba(236,72,153,0.4)',
                                    cursor: uploadingID ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    padding: '16px'
                                }}>
                                {uploadingID ? 'Encrypting...' : 'Calibrate Soul Identity'}
                            </button>
                        </div>
                    </section>
                )}
            </div>

            {/* Photo Crop Modal */}
            {showCrop && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div className="modal-content glass-card holographic" style={{ width: '100%', maxWidth: '360px', padding: '24px' }}>
                        <h3 className="font-serif" style={{ textAlign: 'center', marginBottom: '20px' }}>Refine Visual</h3>
                        <div className="crop-area-wrapper" style={{ width: '300px', height: '300px', margin: '0 auto 20px', borderRadius: '16px', overflow: 'hidden', background: '#000' }}>
                            <canvas
                                ref={canvasRef} width={300} height={300}
                                onPointerDown={handleCropPointerDown}
                                onPointerMove={handleCropPointerMove}
                                onPointerUp={handleCropPointerUp}
                                onPointerLeave={handleCropPointerUp}
                                style={{ width: '100%', height: '100%', cursor: 'move' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
                            <button className="btn-icon" onClick={() => handleZoom(-1)} style={{ background: 'var(--bg-elevated)', borderRadius: '50%' }}>
                                <span className="material-symbols-rounded">zoom_out</span>
                            </button>
                            <button className="btn-icon" onClick={() => handleZoom(1)} style={{ background: 'var(--bg-elevated)', borderRadius: '50%' }}>
                                <span className="material-symbols-rounded">zoom_in</span>
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={uploadCroppedPhoto} disabled={uploading}>
                                {uploading ? 'Processing...' : 'Finalize'}
                            </button>
                            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowCrop(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
