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
    const [spotifySong, setSpotifySong] = useState(user?.spotify_song || '');
    const [prompts, setPrompts] = useState([]);
    const [newPromptQ, setNewPromptQ] = useState('');
    const [newPromptA, setNewPromptA] = useState('');

    useEffect(() => {
        if (!isAuthenticated) navigate('/', { replace: true });
        loadPrompts();
    }, [isAuthenticated]);

    const loadPrompts = async () => {
        try {
            const data = await apiFetch('/api/profile/prompts');
            setPrompts(data.prompts || []);
        } catch { /* ignore */ }
    };

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
            if (spotifyArtist || spotifySong) {
                await apiFetch('/api/profile/spotify', {
                    method: 'PUT',
                    body: JSON.stringify({ artist: spotifyArtist.trim(), song: spotifySong.trim() }),
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
        <div className="auth-page view-animate">
            <div className="auth-header">
                <button className="btn-icon" onClick={() => navigate('/profile')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2>Edit Profile</h2>
            </div>
            <div className="auth-body">
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="input-group"><label>Name</label>
                        <input className="input-field" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="input-group"><label>Bio</label>
                        <textarea className="textarea-field" value={bio} onChange={e => setBio(e.target.value)}
                            placeholder="Tell people about yourself..." maxLength={300} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>{bio.length}/300</span>
                    </div>
                    <div className="input-group"><label>💬 Pickup Line</label>
                        <input className="input-field" value={pickupLine} onChange={e => setPickupLine(e.target.value)}
                            placeholder="Your best pickup line..." maxLength={150} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>{pickupLine.length}/150</span>
                    </div>
                    <div className="input-group"><label>Branch</label>
                        <select className="input-field" value={branch} onChange={e => setBranch(e.target.value)}>
                            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="input-group"><label>Year</label>
                        <select className="input-field" value={year} onChange={e => setYear(e.target.value)}>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="input-group"><label>Show Me</label>
                        <select className="input-field" value={showMe} onChange={e => setShowMe(e.target.value)}>
                            <option value="all">Everyone</option>
                            <option value="male">Men</option>
                            <option value="female">Women</option>
                        </select>
                    </div>
                    <div className="input-group"><label>Interests</label>
                        <div className="interest-tags" style={{ marginTop: 4 }}>
                            {INTEREST_OPTIONS.map(i => (
                                <button key={i} type="button"
                                    className={`interest-tag ${interests.includes(i) ? 'selected' : ''}`}
                                    onClick={() => toggleInterest(i)}>{i}</button>
                            ))}
                        </div>
                    </div>
                    <div className="input-group"><label>Green Flags (comma separated)</label>
                        <input className="input-field" value={greenFlags} onChange={e => setGreenFlags(e.target.value)} />
                    </div>
                    <div className="input-group"><label>Red Flags (comma separated)</label>
                        <input className="input-field" value={redFlags} onChange={e => setRedFlags(e.target.value)} />
                    </div>

                    {/* Spotify Section */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 6 }}>
                        <h3 style={{ fontWeight: 700, marginBottom: 10 }}>🎵 Spotify Anthem</h3>
                        <div className="input-group"><label>Favorite Artist</label>
                            <input className="input-field" value={spotifyArtist} onChange={e => setSpotifyArtist(e.target.value)}
                                placeholder="e.g. Arijit Singh, Taylor Swift" />
                        </div>
                        <div className="input-group" style={{ marginTop: 8 }}><label>Favorite Song</label>
                            <input className="input-field" value={spotifySong} onChange={e => setSpotifySong(e.target.value)}
                                placeholder="e.g. Tum Hi Ho, Love Story" />
                        </div>
                    </div>

                    <button className="btn-primary" type="submit" disabled={loading}>
                        {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : <><span className="material-symbols-outlined">save</span>Save Changes</>}
                    </button>
                </form>

                {/* Profile Prompts */}
                <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 12 }}>💬 Profile Prompts</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Add up to 3 conversation starters that appear on your profile.</p>

                    {prompts.map(p => (
                        <div key={p.id} className="prompt-card">
                            <div className="prompt-question">{p.question}</div>
                            <div className="prompt-answer">{p.answer}</div>
                            <button className="prompt-delete" onClick={() => deletePrompt(p.id)}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                            </button>
                        </div>
                    ))}

                    {prompts.length < 3 && (
                        <div style={{ marginTop: 12 }}>
                            <select className="input-field" value={newPromptQ} onChange={e => setNewPromptQ(e.target.value)} style={{ marginBottom: 8 }}>
                                <option value="">Choose a question...</option>
                                {PROMPT_QUESTIONS.filter(q => !prompts.some(p => p.question === q)).map(q => (
                                    <option key={q} value={q}>{q}</option>
                                ))}
                            </select>
                            {newPromptQ && (
                                <>
                                    <textarea className="textarea-field" value={newPromptA} onChange={e => setNewPromptA(e.target.value)}
                                        placeholder="Write your answer..." maxLength={200} style={{ marginBottom: 6 }} />
                                    <button className="btn-secondary" onClick={addPrompt} style={{ width: '100%' }}>
                                        <span className="material-symbols-outlined">add</span> Add Prompt
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Snooze Mode */}
                <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 12 }}>😴 Snooze Mode</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                        Hide your profile from the swipe deck without deactivating your account.
                    </p>
                    <button className={isSnoozed ? "btn-primary" : "btn-secondary"} onClick={toggleSnooze} style={{ width: '100%' }}>
                        <span className="material-symbols-outlined">{isSnoozed ? 'visibility' : 'visibility_off'}</span>
                        {isSnoozed ? 'Turn Off Snooze (Be Visible)' : 'Snooze for 24 Hours'}
                    </button>
                </div>

                {/* Link to Settings */}
                <div style={{ marginTop: 20, paddingTop: 12 }}>
                    <button className="btn-secondary" onClick={() => navigate('/settings')} style={{ width: '100%' }}>
                        <span className="material-symbols-outlined">settings</span> Account Settings, Privacy & Safety
                    </button>
                </div>
            </div>
        </div>
    );
}
