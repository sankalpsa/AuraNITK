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

    const primaryPhoto = photos.find(p => p.is_primary) || photos[0];
    const displayPhoto = primaryPhoto?.photo_url || user.photo || defaultAvatar(user.name);
    const firstName = user.name?.split(' ')[0] || user.name;

    // Calculate completeness
    const calculateCompleteness = () => {
        let score = 0;
        if (user.bio?.length > 10) score += 20;
        if (user.interests?.length > 0) score += 10;
        if (user.pickup_line) score += 10;
        if (user.verification_status === 'verified') score += 20;
        score += Math.min(photos.length * 10, 40);
        return score;
    };
    const completeness = calculateCompleteness();

    return (
        <div className="pf-page view-animate">

            {/* ══ TOP HERO ══ */}
            <div className="pf-hero">
                <div className="pf-hero-bgblur" style={{ backgroundImage: `url(${displayPhoto})` }} />
                <div className="pf-hero-overlay" />

                {/* Top bar */}
                <div className="pf-topbar">
                    <div className="pf-topbar-left">
                        <h1 className="pf-topbar-title font-serif">My Profile</h1>
                    </div>
                    <div className="pf-topbar-actions">
                        <button className="pf-icon-btn" onClick={() => navigate('/settings')} title="Settings">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                        <button className="pf-icon-btn primary" onClick={() => navigate('/profile/edit')} title="Edit Profile">
                            <span className="material-symbols-outlined">edit</span>
                        </button>
                    </div>
                </div>

                {/* Avatar + name */}
                <div className="pf-identity">
                    <div className="pf-avatar-ring">
                        <img
                            src={displayPhoto}
                            alt={user.name}
                            className="pf-avatar"
                            onError={(e) => { e.target.src = defaultAvatar(user.name); }}
                        />
                        <button className="pf-avatar-add" onClick={() => fileInputRef.current?.click()} title="Add photo">
                            <span className="material-symbols-outlined">add_a_photo</span>
                        </button>
                    </div>
                    <div className="pf-identity-info">
                        <h2 className="pf-name font-serif">
                            {user.name}&nbsp;
                            {user.verification_status === 'verified' && (
                                <span className="material-symbols-outlined fill-icon pf-verified-badge" title="Verified">verified</span>
                            )}
                        </h2>
                        <p className="pf-meta">
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>school</span>
                            {user.branch} · {user.year}
                        </p>
                        {user.bio && <p className="pf-short-bio">{user.bio}</p>}
                    </div>
                </div>

                {/* Stats bar */}
                <div className="pf-stats-bar">
                    <div className="pf-stat">
                        <span className="pf-stat-num">{stats.matches}</span>
                        <span className="pf-stat-lbl">Matches</span>
                    </div>
                    <div className="pf-stat-divider" />
                    <div className="pf-stat">
                        <span className="pf-stat-num">{stats.likes_received}</span>
                        <span className="pf-stat-lbl">Liked You</span>
                    </div>
                    <div className="pf-stat-divider" />
                    <div className="pf-stat">
                        <span className="pf-stat-num">{stats.likes_given}</span>
                        <span className="pf-stat-lbl">You Liked</span>
                    </div>
                </div>
            </div>

            {/* ══ CONTENT BODY ══ */}
            <div className="pf-body">
                {/* ── Progress Bar ── */}
                <div className="pf-progress-section">
                    <div className="pf-progress-header">
                        <span>Profile Excellence</span>
                        <span className="pf-progress-pct">{completeness}%</span>
                    </div>
                    <div className="pf-progress-track">
                        <div className="pf-progress-fill" style={{ width: `${completeness}%` }}></div>
                    </div>
                    {completeness < 100 && (
                        <p className="pf-progress-hint">
                            {completeness < 50 ? 'Add photos to stand out!' : 'Verify your ID for a 20% boost!'}
                        </p>
                    )}
                </div>

                {/* ── Verification Banner ── */}
                {user.verification_status !== 'verified' && (
                    <div className={`pf-verify-banner ${user.verification_status || 'unverified'}`}>
                        <span className="material-symbols-outlined">
                            {user.verification_status === 'pending' ? 'pending' : 'shield_person'}
                        </span>
                        <div className="pf-verify-text">
                            <strong>
                                {user.verification_status === 'pending' ? 'Verification in Review' : 'Get Verified'}
                            </strong>
                            <span>
                                {user.verification_status === 'pending'
                                    ? 'Your ID is being reviewed. Usually 24 hours.'
                                    : 'Upload your NITK ID to get the blue tick ✓'}
                            </span>
                        </div>
                        {(!user.verification_status || user.verification_status === 'unverified') && (
                            <button className="pf-verify-cta" onClick={() => idInputRef.current?.click()} disabled={uploadingID}>
                                {uploadingID ? '...' : 'Upload'}
                            </button>
                        )}
                        <input type="file" ref={idInputRef} accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleIDUpload} />
                    </div>
                )}

                {/* ── Anonymous Questions Inbox ── */}
                {anonQuestions.length > 0 && (
                    <div className="pf-section">
                        <div className="pf-section-hdr">
                            <div className="pf-section-title-row">
                                <span className="material-symbols-outlined" style={{ color: '#a78bfa' }}>forum</span>
                                <h3>Anonymous Questions</h3>
                                {anonQuestions.filter(q => !q.answer).length > 0 && <span className="pf-badge-pill">{anonQuestions.filter(q => !q.answer).length} new</span>}
                            </div>
                        </div>
                        <div className="pf-anon-list">
                            {anonQuestions.map(q => (
                                <div key={q.id} className={`pf-anon-card ${!q.answer ? 'unanswered' : ''}`}>
                                    <div className="pf-anon-q">
                                        <span className="pf-anon-icon">🕵️</span>
                                        <p>{q.question}</p>
                                    </div>
                                    {q.answer ? (
                                        <div className="pf-anon-a">
                                            <span className="pf-anon-you">Your answer</span>
                                            <p>{q.answer}</p>
                                        </div>
                                    ) : (
                                        <>
                                            {answeringId === q.id ? (
                                                <div className="pf-anon-reply">
                                                    <textarea
                                                        rows={2}
                                                        className="anon-textarea"
                                                        placeholder="Write your answer..."
                                                        value={answerText}
                                                        onChange={(e) => setAnswerText(e.target.value)}
                                                        maxLength={500}
                                                        autoFocus
                                                    />
                                                    <div className="pf-anon-reply-btns">
                                                        <button className="anon-cancel-btn" onClick={() => { setAnsweringId(null); setAnswerText(''); }}>Cancel</button>
                                                        <button className="anon-send-btn" onClick={() => answerQuestion(q.id)} disabled={!answerText.trim() || submittingAnswer}>
                                                            {submittingAnswer ? '...' : 'Post Answer'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="pf-anon-actions">
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

                {/* ── Photo Portfolio ── */}
                <div className="pf-section">
                    <div className="pf-section-hdr">
                        <div className="pf-section-title-row">
                            <span className="material-symbols-outlined" style={{ color: '#21d4fd' }}>photo_library</span>
                            <h3>My Photos</h3>
                            <span className="pf-photo-count">{photos.length}/4</span>
                        </div>
                    </div>

                    {/* Full photo viewer */}
                    {photos.length > 0 && (
                        <div className="pf-photo-viewer">
                            <div className="pf-photo-main-wrap">
                                <img
                                    src={photos[activePhoto]?.photo_url || displayPhoto}
                                    alt={`Photo ${activePhoto + 1}`}
                                    className="pf-photo-main"
                                    onError={(e) => { e.target.src = defaultAvatar(user.name); }}
                                />
                                {photos[activePhoto]?.is_primary === 1 && (
                                    <div className="pf-primary-badge">⭐ Cover</div>
                                )}
                                {photos.length > 1 && (
                                    <>
                                        <button className="pf-photo-arrow left" onClick={() => setActivePhoto(p => (p - 1 + photos.length) % photos.length)}>
                                            <span className="material-symbols-outlined">chevron_left</span>
                                        </button>
                                        <button className="pf-photo-arrow right" onClick={() => setActivePhoto(p => (p + 1) % photos.length)}>
                                            <span className="material-symbols-outlined">chevron_right</span>
                                        </button>
                                    </>
                                )}
                                {/* Photo counter */}
                                {photos.length > 1 && (
                                    <div className="pf-photo-counter">{activePhoto + 1}/{photos.length}</div>
                                )}
                            </div>

                            {/* Caption */}
                            <div className="pf-caption-row">
                                {editingCaptionId === photos[activePhoto]?.id ? (
                                    <div className="pf-caption-edit">
                                        <input
                                            className="pf-caption-input"
                                            value={captionText}
                                            onChange={e => setCaptionText(e.target.value)}
                                            placeholder="Add a caption..."
                                            maxLength={120}
                                            autoFocus
                                        />
                                        <button className="pf-caption-save" onClick={() => saveCaption(photos[activePhoto].id)} disabled={savingCaption}>
                                            {savingCaption ? '...' : 'Save'}
                                        </button>
                                        <button className="pf-caption-cancel" onClick={() => setEditingCaptionId(null)}>×</button>
                                    </div>
                                ) : (
                                    <div className="pf-caption-display" onClick={() => {
                                        setEditingCaptionId(photos[activePhoto]?.id);
                                        setCaptionText(photos[activePhoto]?.caption || '');
                                    }}>
                                        {photos[activePhoto]?.caption
                                            ? <span className="pf-caption-text">"{photos[activePhoto].caption}"</span>
                                            : <span className="pf-caption-placeholder">
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                                Add caption...
                                            </span>
                                        }
                                    </div>
                                )}
                            </div>

                            {/* Photos strip */}
                            <div className="pf-photo-strip">
                                {photos.map((p, i) => (
                                    <div
                                        key={p.id}
                                        className={`pf-strip-item ${i === activePhoto ? 'active' : ''}`}
                                        onClick={() => setActivePhoto(i)}
                                    >
                                        <img src={p.photo_url} alt={`Photo ${i + 1}`} onError={(e) => { e.target.src = defaultAvatar(user.name); }} />
                                    </div>
                                ))}
                                {photos.length < 4 && (
                                    <div className="pf-strip-add" onClick={() => fileInputRef.current?.click()}>
                                        <span className="material-symbols-outlined">add</span>
                                    </div>
                                )}
                            </div>

                            {/* Photo actions */}
                            <div className="pf-photo-actions">
                                {!photos[activePhoto]?.is_primary && (
                                    <button className="pf-photo-action-btn" onClick={() => setPrimary(photos[activePhoto]?.id)}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>star</span>
                                        Set Cover
                                    </button>
                                )}
                                <button className="pf-photo-action-btn danger" onClick={() => deletePhoto(photos[activePhoto]?.id)}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}

                    {photos.length === 0 && (
                        <div className="pf-no-photos" onClick={() => fileInputRef.current?.click()}>
                            <span className="material-symbols-outlined">add_a_photo</span>
                            <p>Add your first photo</p>
                            <span>Show the world who you are 📸</span>
                        </div>
                    )}

                    <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
                </div>

                {/* ── About Me ── */}
                <div className="pf-section">
                    <div className="pf-section-hdr">
                        <div className="pf-section-title-row">
                            <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>format_quote</span>
                            <h3>About {firstName}</h3>
                        </div>
                        <button className="pf-edit-inline-btn" onClick={() => navigate('/profile/edit')}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        </button>
                    </div>
                    <div className="pf-bio-card">
                        <p className="pf-bio-text">{user.bio || <span style={{ color: 'var(--text-muted)' }}>No bio yet — tap edit to add one!</span>}</p>
                        {user.pickup_line && (
                            <div className="pf-pickup">
                                <span className="pf-pickup-label">💬 Pickup Line</span>
                                <p className="pf-pickup-text">"{user.pickup_line}"</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Interests ── */}
                {user.interests?.length > 0 && (
                    <div className="pf-section">
                        <div className="pf-section-hdr">
                            <div className="pf-section-title-row">
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>interests</span>
                                <h3>Interests</h3>
                            </div>
                            <button className="pf-edit-inline-btn" onClick={() => navigate('/profile/edit')}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                            </button>
                        </div>
                        <div className="pf-tags">
                            {user.interests.map(i => (
                                <span key={i} className="pf-tag">{i}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Green & Red Flags ── */}
                {(user.green_flags?.length > 0 || user.red_flags?.length > 0) && (
                    <div className="pf-section pf-flags-section">
                        <div className="pf-section-hdr">
                            <div className="pf-section-title-row">
                                <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>flag</span>
                                <h3>Personality Flags</h3>
                            </div>
                            <button className="pf-edit-inline-btn" onClick={() => navigate('/profile/edit')}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                            </button>
                        </div>
                        {user.green_flags?.length > 0 && (
                            <div className="pf-flags-group">
                                <p className="pf-flags-label green">✅ Green Flags</p>
                                <div className="pf-tags">
                                    {user.green_flags.map(f => <span key={f} className="pf-tag green">{f}</span>)}
                                </div>
                            </div>
                        )}
                        {user.red_flags?.length > 0 && (
                            <div className="pf-flags-group" style={{ marginTop: 12 }}>
                                <p className="pf-flags-label red">🚩 Red Flags</p>
                                <div className="pf-tags">
                                    {user.red_flags.map(f => <span key={f} className="pf-tag red">{f}</span>)}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Spotify Anthem ── */}
                {(user.spotify_artist || user.spotify_song) && (
                    <div className="pf-section">
                        <div className="pf-section-hdr">
                            <div className="pf-section-title-row">
                                <span className="material-symbols-outlined" style={{ color: '#1DB954' }}>music_note</span>
                                <h3>My Anthem</h3>
                            </div>
                        </div>
                        <div className="pf-spotify-card">
                            <div className="pf-vinyl" />
                            <div className="pf-spotify-info">
                                {user.spotify_song && <div className="pf-spotify-song">{user.spotify_song}</div>}
                                {user.spotify_artist && <div className="pf-spotify-artist">{user.spotify_artist}</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Prompts ── */}
                {user.prompts?.length > 0 && (
                    <div className="pf-section">
                        <div className="pf-section-hdr">
                            <div className="pf-section-title-row">
                                <span className="material-symbols-outlined" style={{ color: '#b721ff' }}>chat_bubble</span>
                                <h3>Prompts</h3>
                            </div>
                            <button className="pf-edit-inline-btn" onClick={() => navigate('/profile/edit')}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                            </button>
                        </div>
                        {user.prompts.map((p, i) => (
                            <div key={p.id || i} className="pf-prompt-card">
                                <div className="pf-prompt-q">{p.question}</div>
                                <div className="pf-prompt-a">{p.answer}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Empty state CTAs ── */}
                {(!user.bio || !user.interests?.length || !user.prompts?.length) && (
                    <div className="pf-cta-card">
                        <span className="material-symbols-outlined">auto_awesome</span>
                        <div>
                            <strong>Complete your portfolio</strong>
                            <p>Profiles with bios + photos get 5× more matches!</p>
                        </div>
                        <button className="pf-cta-btn" onClick={() => navigate('/profile/edit')}>
                            Complete Profile
                        </button>
                    </div>
                )}

                <div style={{ height: 40 }} />
            </div>

            {/* ══ CROP MODAL ══ */}
            {showCrop && (
                <div className="crop-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCrop(false)}>
                    <div className="crop-modal glass-card">
                        <h3>Crop Photo</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Drag to position. Scroll/pinch to zoom.</p>
                        <canvas
                            ref={canvasRef} width={300} height={300}
                            className="crop-canvas"
                            onMouseDown={handleCropPointerDown} onMouseMove={handleCropPointerMove}
                            onMouseUp={handleCropPointerUp} onMouseLeave={handleCropPointerUp}
                            onTouchStart={handleCropPointerDown} onTouchMove={handleCropPointerMove} onTouchEnd={handleCropPointerUp}
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
