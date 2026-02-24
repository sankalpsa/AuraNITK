import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { INTEREST_OPTIONS, BRANCHES, YEARS } from '../constants';

export default function EditProfile() {
    const navigate = useNavigate();
    const { user, updateUser, logout, isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState(user?.name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [branch, setBranch] = useState(user?.branch || '');
    const [year, setYear] = useState(user?.year || '');
    const [showMe, setShowMe] = useState(user?.show_me || 'all');
    const [interests, setInterests] = useState(user?.interests || []);
    const [greenFlags, setGreenFlags] = useState((user?.green_flags || []).join(', '));
    const [redFlags, setRedFlags] = useState((user?.red_flags || []).join(', '));

    useEffect(() => {
        if (!isAuthenticated) navigate('/', { replace: true });
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
                    name: name.trim(), bio: bio.trim(), branch, year, show_me: showMe,
                    interests,
                    green_flags: greenFlags.split(',').map(s => s.trim()).filter(Boolean),
                    red_flags: redFlags.split(',').map(s => s.trim()).filter(Boolean),
                }),
            });
            updateUser(data.user);
            showToast('Profile updated! ✨', 'success');
            navigate('/profile');
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    };

    const deactivateAccount = async () => {
        if (!window.confirm('Deactivate your account? You can reactivate by logging in again.')) return;
        try {
            await apiFetch('/api/account/deactivate', { method: 'POST' });
            logout();
            showToast('Account deactivated. See you soon! 👋', 'success');
            navigate('/', { replace: true });
        } catch (e) { showToast(e.message, 'error'); }
    };

    const deleteAccount = async () => {
        const conf = window.prompt('Type "DELETE" to permanently delete your account. This cannot be undone.');
        if (conf !== 'DELETE') return showToast('Deletion cancelled', 'error');
        try {
            await apiFetch('/api/account', { method: 'DELETE' });
            logout();
            showToast('Account deleted. Goodbye! 💔', 'success');
            navigate('/', { replace: true });
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
                        <textarea className="textarea-field" value={bio} onChange={e => setBio(e.target.value)} />
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
                    <button className="btn-primary" type="submit" disabled={loading}>
                        {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : <><span className="material-symbols-outlined">save</span>Save Changes</>}
                    </button>
                </form>

                <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                    <h3 style={{ marginBottom: 12, fontWeight: 700 }}>Danger Zone</h3>
                    <button className="btn-secondary" onClick={deactivateAccount} style={{ marginBottom: 10 }}>Deactivate Account</button>
                    <button className="btn-ghost" onClick={deleteAccount} style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.4)' }}>
                        Delete Account Permanently
                    </button>
                </div>
            </div>
        </div>
    );
}
