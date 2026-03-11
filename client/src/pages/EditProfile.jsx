import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { INTEREST_OPTIONS, BRANCHES, YEARS, PROMPT_QUESTIONS } from '../constants';

export default function EditProfile() {
    const navigate = useNavigate();
    const { user, updateUser, isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState(user?.name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [pickupLine, setPickupLine] = useState(user?.pickup_line || '');
    const [branch, setBranch] = useState(user?.branch || '');
    const [year, setYear] = useState(user?.year || '');
    const [showMe, setShowMe] = useState(user?.show_me || 'all');
    const [interests, setInterests] = useState(user?.interests || []);
    const [greenFlags, setGreenFlags] = useState((user?.green_flags || []).join(', '));
    const [redFlags, setRedFlags] = useState((user?.red_flags || []).join(', '));

    // New feature states
    const [isSnoozed, setIsSnoozed] = useState(user?.is_snoozed === 1);
    const [spotifyArtist, setSpotifyArtist] = useState(user?.spotify_artist || '');
    const [spotifyLink, setSpotifyLink] = useState(user?.spotify_artist === 'iframe' ? `https://open.spotify.com/track/${user?.spotify_song}` : (user?.spotify_song || ''));
    const [prompts, setPrompts] = useState([]);
    const [newPromptQ, setNewPromptQ] = useState('');
    const [newPromptA, setNewPromptA] = useState('');

    async function loadPrompts() {
        try {
            const data = await apiFetch('/api/profile/prompts');
            setPrompts(data.prompts || []);
        } catch { /* ignore */ }
    }

    useEffect(() => {
        if (!isAuthenticated) navigate('/', { replace: true });
        loadPrompts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    const toggleInterest = (i) => {
        if (interests.includes(i)) {
            setInterests(interests.filter(x => x !== i));
        } else if (interests.length < 8) {
            setInterests([...interests, i]);
        } else {
            showToast('Max 8 interests', 'error');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!name.trim()) return showToast('Name is required', 'error');
        setLoading(true);
        try {
            const data = await apiFetch('/api/profile', {
                method: 'PUT',
                body: JSON.stringify({
                    name: name.trim(), bio: bio.trim(), pickup_line: pickupLine.trim(),
                    branch, year, show_me: showMe,
                    interests,
                    green_flags: greenFlags.split(',').map(s => s.trim()).filter(Boolean),
                    red_flags: redFlags.split(',').map(s => s.trim()).filter(Boolean),
                }),
            });
            updateUser(data.user);

            // Save Spotify info
            let finalArtist = spotifyArtist;
            let finalSong = spotifyLink;
            
            // Try to extract track ID if it's a Spotify link
            const trackMatch = spotifyLink.match(/track\/([a-zA-Z0-9]+)/);
            if (trackMatch && trackMatch[1]) {
                finalSong = trackMatch[1];
                finalArtist = 'iframe';
            }

            if (finalArtist || finalSong) {
                await apiFetch('/api/profile/spotify', {
                    method: 'PUT',
                    body: JSON.stringify({ artist: finalArtist.trim(), song: finalSong.trim() }),
                });
            }

            showToast('Profile updated! ✨', 'success');
            navigate('/profile');
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    };

    const toggleSnooze = async () => {
        try {
            const data = await apiFetch('/api/profile/snooze', {
                method: 'POST',
                body: JSON.stringify({ enabled: !isSnoozed, hours: 24 }),
            });
            setIsSnoozed(!isSnoozed);
            showToast(data.message, 'success');
        } catch (e) { showToast(e.message, 'error'); }
    };

    const addPrompt = async () => {
        if (!newPromptQ || !newPromptA.trim()) return showToast('Choose a question and write your answer', 'error');
        try {
            const data = await apiFetch('/api/profile/prompts', {
                method: 'POST',
                body: JSON.stringify({ question: newPromptQ, answer: newPromptA.trim() }),
            });
            setPrompts(data.prompts || []);
            setNewPromptQ('');
            setNewPromptA('');
            showToast('Prompt added! ✨', 'success');
        } catch (e) { showToast(e.message, 'error'); }
    };

    const deletePrompt = async (id) => {
        try {
            const data = await apiFetch(`/api/profile/prompts/${id}`, { method: 'DELETE' });
            setPrompts(data.prompts || []);
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <div className="profile-page view-animate" style={{ paddingBottom: '100px' }}>
            {/* Immersive Header */}
            <div className="profile-nav-header glass-card holographic" style={{
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                borderRadius: 0,
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-glass)'
            }}>
                <button className="btn-icon" onClick={() => navigate('/profile')} style={{ background: 'var(--bg-elevated)' }}>
                    <span className="material-symbols-rounded">arrow_back</span>
                </button>
                <h2 className="font-serif" style={{ margin: 0, fontSize: '1.5rem' }}>Edit Identity</h2>
            </div>

            <div className="profile-content" style={{ padding: '20px' }}>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                    {/* Basic Essence */}
                    <div className="glass-card holographic" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--primary-light)' }}>
                            <span className="material-symbols-rounded">person_edit</span>
                            <h3 className="font-serif" style={{ margin: 0, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Essence</h3>
                        </div>

                        <div className="input-group" style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Name</label>
                            <input className="input-field glass-input" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%' }} />
                        </div>

                        <div className="input-group" style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Bio</label>
                            <textarea
                                className="textarea-field glass-input"
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                placeholder="Tell people about yourself..."
                                maxLength={300}
                                style={{ width: '100%', minHeight: '100px' }}
                            />
                            <div style={{ fontSize: '0.7rem', opacity: 0.5, textAlign: 'right', marginTop: '4px' }}>{bio.length}/300</div>
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>💬 Cosmic Pickup Line</label>
                            <input
                                className="input-field glass-input"
                                value={pickupLine}
                                onChange={e => setPickupLine(e.target.value)}
                                placeholder="Your best pickup line..."
                                maxLength={150}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>

                    {/* Technical Details */}
                    <div className="glass-card holographic" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--secondary)' }}>
                            <span className="material-symbols-rounded">school</span>
                            <h3 className="font-serif" style={{ margin: 0, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Alignment</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="input-group">
                                <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Branch</label>
                                <select className="input-field glass-input" value={branch} onChange={e => setBranch(e.target.value)} style={{ width: '100%' }}>
                                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Year</label>
                                <select className="input-field glass-input" value={year} onChange={e => setYear(e.target.value)} style={{ width: '100%' }}>
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="input-group" style={{ marginTop: '20px' }}>
                            <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Seek Interest</label>
                            <select className="input-field glass-input" value={showMe} onChange={e => setShowMe(e.target.value)} style={{ width: '100%' }}>
                                <option value="all">Everyone</option>
                                <option value="male">Men</option>
                                <option value="female">Women</option>
                            </select>
                        </div>
                    </div>

                    {/* Interests Vibe */}
                    <div className="glass-card holographic" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--primary-light)' }}>
                            <span className="material-symbols-rounded">interests</span>
                            <h3 className="font-serif" style={{ margin: 0, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Elemental Resonance</h3>
                        </div>

                        <div className="interest-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {INTEREST_OPTIONS.map(i => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`interest-tag-btn ${interests.includes(i) ? 'selected holographic' : ''}`}
                                    onClick={() => toggleInterest(i)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '30px',
                                        border: '1px solid var(--border)',
                                        background: interests.includes(i) ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                                        color: interests.includes(i) ? 'white' : 'var(--text-main)',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Flags & Vibes */}
                    <div className="glass-card holographic" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: '#22c55e' }}>
                            <span className="material-symbols-rounded">flag</span>
                            <h3 className="font-serif" style={{ margin: 0, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Aura Spectrum</h3>
                        </div>

                        <div className="input-group" style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.8rem', color: '#22c55e', marginBottom: '8px', display: 'block' }}>Green Flags (Elemental Positivity)</label>
                            <input
                                className="input-field glass-input"
                                value={greenFlags}
                                onChange={e => setGreenFlags(e.target.value)}
                                placeholder="Kindness, Humor, Ambition..."
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '0.8rem', color: '#ef4444', marginBottom: '8px', display: 'block' }}>Red Flags (Avoidance Zones)</label>
                            <input
                                className="input-field glass-input"
                                value={redFlags}
                                onChange={e => setRedFlags(e.target.value)}
                                placeholder="Ghosting, Pessimism..."
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>

                    {/* Spotify Section */}
                    <div className="glass-card holographic" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: '#1DB954' }}>
                            <span className="material-symbols-rounded">library_music</span>
                            <h3 className="font-serif" style={{ margin: 0, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Spectral Anthem</h3>
                        </div>
                        <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '20px' }}>Paste a Spotify Track link to embed a playable Anthem on your profile.</p>

                        <div className="input-group">
                            <label style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Spotify Share Link</label>
                            <input 
                                className="input-field glass-input" 
                                value={spotifyLink} 
                                onChange={e => setSpotifyLink(e.target.value)} 
                                placeholder="https://open.spotify.com/track/..." 
                                style={{ width: '100%' }} 
                            />
                        </div>
                    </div>

                    {/* Save Button */}
                    <button className="btn-primary holographic" type="submit" disabled={loading} style={{
                        padding: '16px',
                        borderRadius: '15px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '1.1rem',
                        marginTop: '10px'
                    }}>
                        {loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : (
                            <>
                                <span className="material-symbols-rounded">auto_fix_high</span>
                                Manifest Changes
                            </>
                        )}
                    </button>
                </form>

                {/* Profile Prompts */}
                <div className="glass-card holographic" style={{ padding: '24px', marginTop: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-light)' }}>
                            <span className="material-symbols-rounded">forum</span>
                            <h3 className="font-serif" style={{ margin: 0, fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Broadcast Prompts</h3>
                        </div>
                        <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{prompts.length}/3</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {prompts.map(p => (
                            <div key={p.id} className="glass-card" style={{ padding: '15px', position: 'relative', background: 'rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--primary-light)', fontWeight: 600, marginBottom: '4px' }}>{p.question}</div>
                                <div style={{ fontSize: '0.95rem' }}>{p.answer}</div>
                                <button
                                    onClick={() => deletePrompt(p.id)}
                                    style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                                >
                                    <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                                </button>
                            </div>
                        ))}

                        {prompts.length < 3 && (
                            <div className="add-prompt-box" style={{ marginTop: '10px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '15px', border: '1px dashed var(--border)' }}>
                                <select
                                    className="input-field glass-input"
                                    value={newPromptQ}
                                    onChange={e => setNewPromptQ(e.target.value)}
                                    style={{ width: '100%', marginBottom: '15px' }}
                                >
                                    <option value="">Choose a transmission theme...</option>
                                    {PROMPT_QUESTIONS.filter(q => !prompts.some(p => p.question === q)).map(q => (
                                        <option key={q} value={q}>{q}</option>
                                    ))}
                                </select>

                                {newPromptQ && (
                                    <div className="view-animate">
                                        <textarea
                                            className="textarea-field glass-input"
                                            value={newPromptA}
                                            onChange={e => setNewPromptA(e.target.value)}
                                            placeholder="Write your signal..."
                                            maxLength={200}
                                            style={{ width: '100%', minHeight: '80px', marginBottom: '15px' }}
                                        />
                                        <button className="btn-secondary" onClick={addPrompt} style={{ width: '100%', padding: '12px' }}>
                                            <span className="material-symbols-rounded" style={{ marginRight: '8px' }}>add</span>
                                            Initialize Prompt
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Snooze Mode */}
                <div className="glass-card holographic" style={{ padding: '24px', marginTop: '30px', border: isSnoozed ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                        <span className="material-symbols-rounded">bedtime</span>
                        <h3 className="font-serif" style={{ margin: 0 }}>Stellar Hibernate</h3>
                    </div>
                    <p style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '20px' }}>
                        Retreat from the cosmic grid temporarily. Your profile will be hidden from new seekers.
                    </p>
                    <button
                        className={isSnoozed ? "btn-primary holographic" : "btn-secondary"}
                        onClick={toggleSnooze}
                        style={{ width: '100%', padding: '15px' }}
                    >
                        <span className="material-symbols-rounded" style={{ marginRight: '8px' }}>{isSnoozed ? 'visibility' : 'visibility_off'}</span>
                        {isSnoozed ? 'Re-materialize Profile' : 'Enter Stasis (24h)'}
                    </button>
                </div>

                {/* Settings Link */}
                <button
                    className="btn-ghost"
                    onClick={() => navigate('/settings')}
                    style={{ width: '100%', marginTop: '30px', padding: '15px', color: 'var(--text-secondary)' }}
                >
                    <span className="material-symbols-rounded" style={{ marginRight: '8px' }}>settings</span>
                    Advanced Config & Privacy
                </button>
            </div>
        </div>
    );
}
