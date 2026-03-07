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
        loadStats();
        loadPhotos();
        loadAnonQuestions();
        refreshUser();
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

    if (!user) return null;

    return (
        <div className="profile-page view-animate" style={{ paddingBottom: '120px' }}>
            {/* Top Bar Navigation */}
            <div className="profile-nav-header glass-card holographic" style={{ borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, borderRadius: 0 }}>
                <h1 className="font-serif" style={{ fontSize: '1.2rem', margin: 0 }}>My Aura</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-icon" onClick={() => navigate('/settings')} style={{ background: 'var(--bg-elevated)', borderRadius: '50%' }}>
                        <span className="material-symbols-rounded">settings</span>
                    </button>
                    <button className="btn-icon primary" onClick={() => navigate('/profile/edit')} style={{ background: 'var(--gradient-primary)', borderRadius: '50%', color: 'white' }}>
                        <span className="material-symbols-rounded">edit</span>
                    </button>
                </div>
            </div>

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
                            <p style={{ color: 'var(--text-muted)' }}>Manifest your visual Aura</p>
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
            <div className="profile-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '20px', marginTop: '-30px', position: 'relative', zIndex: 10 }}>
                <div className="stat-card glass-card holographic" style={{ textAlign: 'center', padding: '16px 8px' }}>
                    <span className="stat-value" style={{ display: 'block', fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-light)' }}>{stats.matches}</span>
                    <span className="stat-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Connections</span>
                </div>
                <div className="stat-card glass-card holographic" style={{ textAlign: 'center', padding: '16px 8px' }}>
                    <span className="stat-value" style={{ display: 'block', fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{stats.likes_received}</span>
                    <span className="stat-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Received</span>
                </div>
                <div className="stat-card glass-card holographic" style={{ textAlign: 'center', padding: '16px 8px' }}>
                    <span className="stat-value" style={{ display: 'block', fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-magenta)' }}>{stats.likes_given}</span>
                    <span className="stat-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Sent</span>
                </div>
            </div>

            {/* Main Content Sections */}
            <div style={{ padding: '0 20px' }}>
                {/* Visual Fragments */}
                <section className="profile-section" style={{ marginBottom: '40px' }}>
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="font-serif" style={{ fontSize: '1.2rem' }}>Visual Fragments</h3>
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
                <section className="profile-section" style={{ marginBottom: '40px' }}>
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="font-serif" style={{ fontSize: '1.2rem' }}>Subconscious Echoes</h3>
                        <span className="badge-pill" style={{ fontSize: '0.7rem', opacity: 0.6 }}>{anonQuestions.length} Received</span>
                    </div>
                    <div className="anon-questions-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {anonQuestions.length === 0 ? (
                            <div className="empty-section-card glass-card" style={{ padding: '30px', textAlign: 'center', opacity: 0.6 }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '2rem', marginBottom: '8px' }}>psychology</span>
                                <p style={{ fontSize: '0.9rem' }}>No echoes detected yet.</p>
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
                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: 'var(--primary)' }}>My Resonance</div>
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
                                                    Manifest
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
                    <section className="profile-section" style={{ marginBottom: '40px' }}>
                        <div className="verification-card glass-card holographic" style={{ padding: '24px', textAlign: 'center' }}>
                            <div className="auth-icon-large" style={{ margin: '0 auto 16px', background: 'var(--primary-soft)' }}>
                                <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '2rem' }}>verified_user</span>
                            </div>
                            <h3 className="font-serif" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Verify Your Aura</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.85rem' }}>
                                Upload your university ID to unlock global frequencies and the verified badge.
                            </p>
                            <button className="btn-primary" style={{ width: '100%' }} onClick={() => idInputRef.current?.click()} disabled={uploadingID}>
                                {uploadingID ? 'Encrypting...' : 'Upload ID Manifest'}
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
