import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiUpload } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar } from '../utils/helpers';

export default function Profile() {
    const navigate = useNavigate();
    const { user, isAuthenticated, updateUser, refreshUser } = useAuth();
    const { showToast } = useToast();

    const [stats, setStats] = useState({ matches: 0, likes_given: 0, likes_received: 0 });
    const [photos, setPhotos] = useState([]);
    const [activePhoto, setActivePhoto] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [showCrop, setShowCrop] = useState(false);
    const [cropImg, setCropImg] = useState(null);
    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const cropState = useRef({ offsetX: 0, offsetY: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 });

    // Anonymous Questions state
    const [anonQuestions, setAnonQuestions] = useState([]);
    const [answeringId, setAnsweringId] = useState(null);
    const [answerText, setAnswerText] = useState('');
    const [submittingAnswer, setSubmittingAnswer] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return navigate('/', { replace: true });
        loadStats();
        loadPhotos();
        loadAnonQuestions();
        refreshUser(); // Always fetch freshest identity data on profile visit
    }, [isAuthenticated]);

    const loadStats = async () => {
        try {
            const data = await apiFetch('/api/stats');
            setStats(data);
        } catch { }
    };

    const loadPhotos = async () => {
        try {
            const data = await apiFetch('/api/profile/photos');
            setPhotos(data.photos || []);
        } catch { }
    };

    const loadAnonQuestions = async () => {
        try {
            const data = await apiFetch('/api/anonymous-questions/received');
            setAnonQuestions(data.questions || []);
        } catch { }
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
        } catch (e) {
            showToast(e.message, 'error');
        }
        setSubmittingAnswer(false);
    };

    const deleteQuestion = async (id) => {
        if (!window.confirm('Delete this question?')) return;
        try {
            await apiFetch(`/api/anonymous-questions/${id}`, { method: 'DELETE' });
            setAnonQuestions(prev => prev.filter(q => q.id !== id));
            showToast('Question removed', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
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

    // Canvas crop tool
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
            canvas._img = img;
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
        s.offsetX += cx - s.lastX;
        s.offsetY += cy - s.lastY;
        s.lastX = cx;
        s.lastY = cy;
        canvasRef.current?._draw?.();
    };

    const handleCropPointerUp = () => { cropState.current.dragging = false; };

    const handleZoom = (dir) => {
        const s = cropState.current;
        s.scale = Math.max(0.3, Math.min(3, s.scale + dir * 0.15));
        canvasRef.current?._draw?.();
    };

    const idInputRef = useRef(null);
    const [uploadingID, setUploadingID] = useState(false);

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
        } catch (e) {
            showToast(e.message, 'error');
        }
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
        } catch (e) {
            showToast(e.message, 'error');
        }
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
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const setPrimary = async (photoId) => {
        try {
            const data = await apiFetch(`/api/profile/photo/${photoId}/primary`, { method: 'PUT' });
            setPhotos(data.photos || []);
            showToast('Primary photo updated! ⭐', 'success');
            refreshUser();
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    if (!user) return null;

    const primaryPhoto = photos.find(p => p.is_primary) || photos[0];
    const displayPhoto = primaryPhoto?.photo_url || user.photo || defaultAvatar(user.name);

    return (
        <div className="profile-page view-animate">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="font-serif">Profile</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-icon" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', width: 38, height: 38, borderRadius: '50%' }}
                        onClick={() => navigate('/settings')} title="Settings">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>settings</span>
                    </button>
                    <button className="btn-icon" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', width: 38, height: 38, borderRadius: '50%' }}
                        onClick={() => navigate('/profile/edit')} title="Edit Profile">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>edit</span>
                    </button>
                </div>
            </div>

            {/* Main Photo Carousel */}
            <div className="profile-hero">
                <div className="profile-carousel">
                    {photos.length > 0 ? (
                        <>
                            <img
                                src={photos[activePhoto]?.photo_url || displayPhoto}
                                alt={user.name}
                                className="profile-hero-img"
                                onError={(e) => { e.target.src = defaultAvatar(user.name); }}
                            />
                            {photos.length > 1 && (
                                <div className="carousel-dots">
                                    {photos.map((_, i) => (
                                        <button key={i}
                                            className={`carousel-dot ${i === activePhoto ? 'active' : ''}`}
                                            onClick={() => setActivePhoto(i)} />
                                    ))}
                                </div>
                            )}
                            {photos.length > 1 && (
                                <>
                                    <button className="carousel-arrow left" onClick={() => setActivePhoto(p => (p - 1 + photos.length) % photos.length)}>
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>
                                    <button className="carousel-arrow right" onClick={() => setActivePhoto(p => (p + 1) % photos.length)}>
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <img src={displayPhoto} alt={user.name} className="profile-hero-img"
                            onError={(e) => { e.target.src = defaultAvatar(user.name); }} />
                    )}
                    <div className="profile-hero-overlay">
                        <h2 className="font-serif">
                            {user.name}, {user.age}
                            {user.is_verified === 1 && (
                                <span className="material-symbols-outlined verified-badge-inline" title="Verified Account">
                                    verified
                                </span>
                            )}
                        </h2>
                        <p>{user.branch} • {user.year}</p>
                    </div>
                </div>
            </div>

            {/* ID Verification Section */}
            <div className="profile-section">
                <div className={`verification-card ${user.verification_status || 'unverified'}`}>
                    <div className="verification-icon">
                        <span className="material-symbols-outlined">
                            {user.verification_status === 'verified' ? 'verified_user' :
                                user.verification_status === 'pending' ? 'pending' : 'shield_person'}
                        </span>
                    </div>
                    <div className="verification-info">
                        <h4>
                            {user.verification_status === 'verified' ? 'Verified Account' :
                                user.verification_status === 'pending' ? 'Verification Pending' : 'Verify Your Identity'}
                        </h4>
                        <p>
                            {user.verification_status === 'verified' ? 'Your NITK identity is confirmed. Enjoy full access!' :
                                user.verification_status === 'pending' ? 'We are reviewing your ID card. This usually takes 24 hours.' : 'Upload your NITK ID card (Image or PDF) to get the blue tick and increase trust.'}
                        </p>

                        {(user.verification_status === 'unverified' || !user.verification_status) && (
                            <>
                                <button className="btn-verify" onClick={() => idInputRef.current?.click()} disabled={uploadingID}>
                                    {uploadingID ? 'Uploading...' : 'Upload ID Card (Image/PDF)'}
                                </button>
                                <input type="file" ref={idInputRef} accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleIDUpload} />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Photo Management Grid */}
            <div className="profile-section">
                <h3 className="section-title">
                    <span className="material-symbols-outlined">photo_library</span>
                    My Photos ({photos.length}/4)
                </h3>
                <div className="photo-grid">
                    {photos.map((p, i) => (
                        <div key={p.id} className={`photo-grid-item ${p.is_primary ? 'primary' : ''}`}>
                            <img src={p.photo_url} alt={`Photo ${i + 1}`}
                                onError={(e) => { e.target.src = defaultAvatar(user.name); }} />
                            {p.is_primary && <span className="primary-badge">★ Primary</span>}
                            <div className="photo-actions">
                                {!p.is_primary && (
                                    <button className="photo-action-btn" onClick={() => setPrimary(p.id)}
                                        title="Set as primary">
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>star</span>
                                    </button>
                                )}
                                <button className="photo-action-btn danger" onClick={() => deletePhoto(p.id)}
                                    title="Delete">
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                    {photos.length < 4 && (
                        <div className="photo-grid-item add-photo" onClick={() => fileInputRef.current?.click()}>
                            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>add_a_photo</span>
                            <span style={{ fontSize: '0.75rem' }}>Add Photo</span>
                        </div>
                    )}
                </div>
                <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }}
                    onChange={handleFileSelect} />
            </div>

            {/* Bio & Pickup Line */}
            <div className="profile-section">
                <h3 className="section-title">
                    <span className="material-symbols-outlined">format_quote</span>
                    About Me
                </h3>
                <div className="profile-card glass-card">
                    <p className="profile-bio">{user.bio || 'No bio yet — tap edit to add one!'}</p>
                    {user.pickup_line && (
                        <div className="pickup-line">
                            <span className="pickup-label">💬 Pickup Line</span>
                            <p className="pickup-text">"{user.pickup_line}"</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Interests */}
            {(user.interests?.length > 0) && (
                <div className="profile-section">
                    <h3 className="section-title">
                        <span className="material-symbols-outlined">interests</span>
                        Interests
                    </h3>
                    <div className="interest-tags">
                        {user.interests.map(i => <span key={i} className="interest-tag">{i}</span>)}
                    </div>
                </div>
            )}

            {/* Flags */}
            {(user.green_flags?.length > 0 || user.red_flags?.length > 0) && (
                <div className="profile-section">
                    {user.green_flags?.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <h3 className="section-title" style={{ color: 'var(--success)' }}>
                                <span className="material-symbols-outlined">flag</span>
                                Green Flags
                            </h3>
                            <div className="interest-tags">
                                {user.green_flags.map(f => <span key={f} className="interest-tag green">{f}</span>)}
                            </div>
                        </div>
                    )}
                    {user.red_flags?.length > 0 && (
                        <div>
                            <h3 className="section-title" style={{ color: 'var(--danger)' }}>
                                <span className="material-symbols-outlined">flag</span>
                                Red Flags
                            </h3>
                            <div className="interest-tags">
                                {user.red_flags.map(f => <span key={f} className="interest-tag red">{f}</span>)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="profile-section">
                <h3 className="section-title">
                    <span className="material-symbols-outlined">monitoring</span>
                    Stats
                </h3>
                <div className="stats-grid">
                    <div className="stat-card glass-card">
                        <span className="stat-number">{stats.matches}</span>
                        <span className="stat-label">Matches</span>
                    </div>
                    <div className="stat-card glass-card">
                        <span className="stat-number">{stats.likes_given}</span>
                        <span className="stat-label">Likes Sent</span>
                    </div>
                    <div className="stat-card glass-card">
                        <span className="stat-number">{stats.likes_received}</span>
                        <span className="stat-label">Likes Received</span>
                    </div>
                </div>
            </div>

            {/* Anonymous Questions Inbox */}
            {anonQuestions.length > 0 && (
                <div className="profile-section">
                    <h3 className="section-title" style={{ color: '#a78bfa' }}>
                        <span className="material-symbols-outlined">forum</span>
                        Anonymous Questions
                        <span className="anon-inbox-badge">{anonQuestions.filter(q => !q.answer).length} new</span>
                    </h3>
                    <div className="anon-inbox-list">
                        {anonQuestions.map(q => (
                            <div key={q.id} className={`anon-inbox-card ${!q.answer ? 'unanswered' : ''}`}>
                                <div className="anon-inbox-q">
                                    <span className="anon-inbox-icon">🕵️</span>
                                    <p>{q.question}</p>
                                </div>
                                {q.answer ? (
                                    <div className="anon-inbox-a">
                                        <span className="anon-inbox-you">Your answer</span>
                                        <p>{q.answer}</p>
                                    </div>
                                ) : (
                                    <>
                                        {answeringId === q.id ? (
                                            <div className="anon-inbox-reply">
                                                <textarea
                                                    rows={2}
                                                    className="anon-textarea"
                                                    placeholder="Write your answer..."
                                                    value={answerText}
                                                    onChange={(e) => setAnswerText(e.target.value)}
                                                    maxLength={500}
                                                    autoFocus
                                                />
                                                <div className="anon-inbox-reply-actions">
                                                    <button className="anon-cancel-btn" onClick={() => { setAnsweringId(null); setAnswerText(''); }}>Cancel</button>
                                                    <button className="anon-send-btn" onClick={() => answerQuestion(q.id)} disabled={!answerText.trim() || submittingAnswer}>
                                                        {submittingAnswer ? '...' : 'Post Answer'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="anon-inbox-actions">
                                                <button className="anon-reply-btn" onClick={() => { setAnsweringId(q.id); setAnswerText(''); }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>reply</span>
                                                    Answer
                                                </button>
                                                <button className="anon-dismiss-btn" onClick={() => deleteQuestion(q.id)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Crop Modal */}
            {showCrop && (
                <div className="crop-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCrop(false)}>
                    <div className="crop-modal glass-card">
                        <h3>Crop Photo</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                            Drag to position. Pinch/scroll to zoom.
                        </p>
                        <canvas ref={canvasRef} width={300} height={300}
                            className="crop-canvas"
                            onMouseDown={handleCropPointerDown}
                            onMouseMove={handleCropPointerMove}
                            onMouseUp={handleCropPointerUp}
                            onMouseLeave={handleCropPointerUp}
                            onTouchStart={handleCropPointerDown}
                            onTouchMove={handleCropPointerMove}
                            onTouchEnd={handleCropPointerUp}
                            onWheel={(e) => handleZoom(e.deltaY > 0 ? -1 : 1)}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
                            <button className="btn-icon" onClick={() => handleZoom(-1)}><span className="material-symbols-outlined">remove</span></button>
                            <button className="btn-icon" onClick={() => handleZoom(1)}><span className="material-symbols-outlined">add</span></button>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'center' }}>
                            <button className="btn-ghost" onClick={() => { setShowCrop(false); setCropImg(null); }}>Cancel</button>
                            <button className="btn-primary" onClick={uploadCroppedPhoto} disabled={uploading}>
                                {uploading ? 'Uploading...' : '📸 Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
