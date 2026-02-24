import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, apiUpload } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { defaultAvatar } from '../utils/helpers';

export default function Profile() {
    const navigate = useNavigate();
    const { user, updateUser, logout, isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [stats, setStats] = useState({ matches: 0, likes_given: 0, likes_received: 0 });
    const [photos, setPhotos] = useState([]);
    const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
    const [showCropModal, setShowCropModal] = useState(false);
    const [cropImageUrl, setCropImageUrl] = useState(null);

    // Canvas crop state
    const canvasRef = useRef(null);
    const cropRef = useRef({
        img: null, imgX: 0, imgY: 0, imgW: 0, imgH: 0,
        scale: 1, minScale: 1, maxScale: 4,
        isDragging: false, lastX: 0, lastY: 0, lastPinchDist: 0,
    });

    useEffect(() => {
        if (!isAuthenticated) return navigate('/', { replace: true });
        loadProfile();
    }, [isAuthenticated]);

    const loadProfile = async () => {
        try {
            const data = await apiFetch('/api/auth/me');
            updateUser(data.user);
            // Build photo gallery from user photo + additional photos
            const photoList = [];
            if (data.user.photo) photoList.push(data.user.photo);
            if (data.user.photos) photoList.push(...data.user.photos);
            setPhotos(photoList.length > 0 ? photoList : [defaultAvatar(data.user.name, 600)]);
        } catch (e) {
            if (e.message.includes('Session')) {
                logout();
                navigate('/', { replace: true });
            }
        }
        try {
            const s = await apiFetch('/api/stats');
            setStats(s);
        } catch { }
    };

    const handlePhotoUpload = (input) => {
        if (!input.files?.[0]) return;
        const file = input.files[0];
        if (!file.type.startsWith('image/')) return showToast('Please select an image file', 'error');
        const reader = new FileReader();
        reader.onload = (e) => {
            setCropImageUrl(e.target.result);
            setShowCropModal(true);
            setTimeout(() => initCrop(e.target.result), 100);
        };
        reader.readAsDataURL(file);
        input.value = '';
    };

    const initCrop = (dataUrl) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const box = canvas.parentElement;
        const size = Math.min(box?.clientWidth || 360, window.innerWidth - 32);
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';

        const img = new Image();
        img.onload = () => {
            const c = cropRef.current;
            c.img = img;
            const scaleX = size / img.width;
            const scaleY = size / img.height;
            c.scale = Math.max(scaleX, scaleY);
            c.minScale = c.scale;
            c.maxScale = c.scale * 4;
            c.imgW = img.naturalWidth;
            c.imgH = img.naturalHeight;
            c.imgX = (size - img.naturalWidth * c.scale) / 2;
            c.imgY = (size - img.naturalHeight * c.scale) / 2;
            cropClamp();
            cropDraw(ctx, canvas.width);
        };
        img.src = dataUrl;
    };

    const cropClamp = () => {
        const c = cropRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const S = canvas.width;
        const minX = S / c.imgW;
        const minY = S / c.imgH;
        c.minScale = Math.max(minX, minY);
        if (c.scale < c.minScale) c.scale = c.minScale;
        const nw = c.imgW * c.scale;
        const nh = c.imgH * c.scale;
        c.imgX = Math.min(0, Math.max(S - nw, c.imgX));
        c.imgY = Math.min(0, Math.max(S - nh, c.imgY));
    };

    const cropDraw = (ctx, S) => {
        const c = cropRef.current;
        if (!ctx || !c.img) return;
        ctx.clearRect(0, 0, S, S);
        ctx.drawImage(c.img, c.imgX, c.imgY, c.imgW * c.scale, c.imgH * c.scale);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.rect(0, 0, S, S);
        ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(238,43,157,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
        ctx.stroke();
    };

    const handleCropMouseDown = (e) => {
        cropRef.current.isDragging = true;
        cropRef.current.lastX = e.clientX;
        cropRef.current.lastY = e.clientY;
    };
    const handleCropMouseMove = (e) => {
        const c = cropRef.current;
        if (!c.isDragging) return;
        c.imgX += e.clientX - c.lastX;
        c.imgY += e.clientY - c.lastY;
        c.lastX = e.clientX;
        c.lastY = e.clientY;
        cropClamp();
        const canvas = canvasRef.current;
        if (canvas) cropDraw(canvas.getContext('2d'), canvas.width);
    };
    const handleCropMouseUp = () => { cropRef.current.isDragging = false; };
    const handleCropWheel = (e) => {
        e.preventDefault();
        const c = cropRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const S = canvas.width;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const prevScale = c.scale;
        c.scale = Math.min(c.maxScale, Math.max(c.minScale, c.scale * delta));
        const ratio = c.scale / prevScale;
        c.imgX = S / 2 - ratio * (S / 2 - c.imgX);
        c.imgY = S / 2 - ratio * (S / 2 - c.imgY);
        cropClamp();
        cropDraw(canvas.getContext('2d'), S);
    };

    const saveCrop = async () => {
        const c = cropRef.current;
        const canvas = canvasRef.current;
        if (!c.img || !canvas) return showToast('No image to save', 'error');

        const out = document.createElement('canvas');
        out.width = 600; out.height = 600;
        const octx = out.getContext('2d');
        const S = canvas.width;
        const ratio = 600 / S;
        octx.drawImage(c.img, -c.imgX * ratio, -c.imgY * ratio, c.imgW * c.scale * ratio, c.imgH * c.scale * ratio);

        out.toBlob(async (blob) => {
            if (!blob) return showToast('Could not process image', 'error');
            setShowCropModal(false);
            showToast('Uploading photo...', 'info');
            const form = new FormData();
            form.append('photo', blob, 'profile.jpg');
            try {
                const data = await apiUpload('/api/profile/photo', form);
                const updatedUser = { ...user, photo: data.photo };
                updateUser(updatedUser);
                showToast('Profile photo updated! 📸', 'success');
                loadProfile();
            } catch (e) {
                showToast(e.message, 'error');
            }
        }, 'image/jpeg', 0.92);
    };

    const doLogout = () => {
        if (!window.confirm('Are you sure you want to logout?')) return;
        logout();
        showToast('Logged out. See you soon! 👋', 'success');
        navigate('/', { replace: true });
    };

    if (!user) return null;

    return (
        <div className="profile-page view-animate">
            {/* Multi-photo hero carousel */}
            <div className="profile-hero">
                <div className="profile-photo-carousel">
                    {photos.length > 1 && (
                        <div className="photo-indicators">
                            {photos.map((_, idx) => (
                                <div key={idx} className={`photo-indicator ${idx === currentPhotoIdx ? 'active' : ''}`}
                                    onClick={() => setCurrentPhotoIdx(idx)} />
                            ))}
                        </div>
                    )}
                    <img src={photos[currentPhotoIdx] || defaultAvatar(user.name, 600)} alt={user.name}
                        onError={(e) => { e.target.src = defaultAvatar(user.name); }} />
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
                </div>
                <div className="profile-hero-gradient" />
                <div className="profile-hero-info">
                    <h1 className="font-serif">{user.name}, {user.age}</h1>
                    <p>{user.branch} • {user.year}</p>
                    <div className="profile-hero-badges">
                        {user.is_verified
                            ? <span className="profile-badge"><span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)' }}>verified</span>NITK Verified</span>
                            : <span className="profile-badge"><span className="material-symbols-outlined" style={{ color: 'var(--warning)' }}>warning</span>Unverified</span>}
                    </div>
                </div>
            </div>

            <div className="profile-content">
                <div className="profile-stats-card">
                    <div className="stat-item"><div className="stat-number" style={{ color: 'var(--primary)' }}>{stats.matches}</div><div className="stat-label">Matches</div></div>
                    <div className="stat-item"><div className="stat-number" style={{ color: 'var(--success)' }}>{stats.likes_given}</div><div className="stat-label">Liked</div></div>
                    <div className="stat-item"><div className="stat-number" style={{ color: 'var(--info)' }}>{stats.likes_received}</div><div className="stat-label">Liked You</div></div>
                </div>

                <div className="profile-section">
                    <h3>Profile Photos</h3>
                    <div className="photo-gallery-grid">
                        {photos.map((photo, idx) => (
                            <div key={idx} className="photo-gallery-item">
                                <img src={photo} alt={`Photo ${idx + 1}`} onError={(e) => { e.target.src = defaultAvatar(user.name); }} />
                            </div>
                        ))}
                        <label className="photo-gallery-add">
                            <span className="material-symbols-outlined">add_photo_alternate</span>
                            <span>Add Photo</span>
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(e.target)} />
                        </label>
                    </div>
                </div>

                <div className="profile-section">
                    <h3>Bio</h3>
                    <p style={{
                        color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6,
                        background: 'var(--bg-card)', padding: 14, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)'
                    }}>
                        {user.bio || 'No bio yet'}
                    </p>
                </div>

                <div className="profile-section">
                    <h3>Interests</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(user.interests || []).map(i => (
                            <span key={i} style={{
                                padding: '7px 14px', background: 'var(--primary-soft)',
                                border: '1px solid rgba(238,43,157,0.2)', borderRadius: 'var(--radius-full)',
                                fontSize: '0.83rem', fontWeight: 600, color: 'var(--primary)'
                            }}>{i}</span>
                        ))}
                    </div>
                </div>

                <div className="profile-section">
                    <div className="profile-action-grid">
                        <button className="profile-action-btn edit" onClick={() => navigate('/profile/edit')}>
                            <span className="material-symbols-outlined">edit</span>Edit Profile
                        </button>
                        <button className="profile-action-btn logout" onClick={doLogout}>
                            <span className="material-symbols-outlined">logout</span>Logout
                        </button>
                    </div>
                </div>

                <p className="profile-version">NITKnot v2.0 • Made with ❤️ for NITK</p>
            </div>

            {/* Crop Modal */}
            {showCropModal && (
                <div className="crop-modal">
                    <div className="crop-modal-content">
                        <h3>Crop Photo</h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 12px' }}>
                            Drag to reposition • Scroll to zoom
                        </p>
                        <div className="crop-canvas-wrapper">
                            <canvas ref={canvasRef} id="crop-canvas"
                                onMouseDown={handleCropMouseDown}
                                onMouseMove={handleCropMouseMove}
                                onMouseUp={handleCropMouseUp}
                                onMouseLeave={handleCropMouseUp}
                                onWheel={handleCropWheel}
                                style={{ cursor: 'grab', touchAction: 'none', display: 'block' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowCropModal(false)}>Cancel</button>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={saveCrop}>
                                <span className="material-symbols-outlined">check_circle</span>Save Photo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
