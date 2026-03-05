import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
    const navigate = useNavigate();
    const { user, logout, isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();
    const [reports, setReports] = useState([]);
    const [showChangePass, setShowChangePass] = useState(false);
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [passLoading, setPassLoading] = useState(false);
    const [showSafety, setShowSafety] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Premium Features state
    const [incognito, setIncognito] = useState(false);
    const [readReceipts, setReadReceipts] = useState(true);

    // Search filter helper — returns true if the section should be visible
    const q = searchQuery.toLowerCase().trim();
    const show = useMemo(() => ({
        account: !q || ['account', 'edit', 'profile', 'password', 'view', 'change'].some(k => k.includes(q) || q.includes(k)),
        privacy: !q || ['privacy', 'safety', 'block', 'premium', 'incognito', 'read', 'receipt', 'dark', 'mode', 'theme'].some(k => k.includes(q) || q.includes(k)),
        howTo: !q || ['how', 'use', 'swipe', 'like', 'match', 'tap', 'timer', 'help'].some(k => k.includes(q) || q.includes(k)),
        about: !q || ['about', 'version', 'info', 'nitknot', 'credit'].some(k => k.includes(q) || q.includes(k)),
        logins: !q || ['login', 'logout', 'log', 'admin', 'sign'].some(k => k.includes(q) || q.includes(k)),
        danger: !q || ['danger', 'deactivate', 'delete', 'account', 'remove'].some(k => k.includes(q) || q.includes(k)),
    }), [q]);

    useEffect(() => {
        if (!isAuthenticated) navigate('/', { replace: true });
        loadReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    async function loadReports() {
        try {
            const data = await apiFetch('/api/reports/me');
            setReports(data.reports || []);
        } catch { /* endpoint may not exist yet */ }
    }

    const handleLogout = () => {
        if (!window.confirm('Are you sure you want to log out?')) return;
        logout();
        showToast('Logged out successfully', 'success');
        navigate('/', { replace: true });
    };

    const handleChangePassword = async () => {
        if (!currentPass || !newPass) return showToast('Fill in all fields', 'error');
        if (newPass.length < 4) return showToast('New password must be at least 4 characters', 'error');
        if (newPass !== confirmPass) return showToast('Passwords do not match', 'error');
        setPassLoading(true);
        try {
            await apiFetch('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
            });
            showToast('Password changed successfully! 🔒', 'success');
            setShowChangePass(false);
            setCurrentPass(''); setNewPass(''); setConfirmPass('');
        } catch (e) {
            showToast(e.message, 'error');
        }
        setPassLoading(false);
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
        <div className="settings-page view-animate">
            {/* Instagram-style header */}
            <div className="settings-header">
                <button className="btn-icon" onClick={() => navigate('/profile')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2>Settings & Activity</h2>
            </div>

            <div className="settings-body">
                {/* Functional search bar */}
                <div className="settings-search-bar">
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>search</span>
                    <input
                        type="text"
                        placeholder="Search settings..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="settings-search-input"
                    />
                    {searchQuery && (
                        <button className="btn-icon" onClick={() => setSearchQuery('')} style={{ padding: 2 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>close</span>
                        </button>
                    )}
                </div>

                {/* Your Account — Instagram style */}
                {show.account && <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>account_circle</span>
                        <div>
                            <h3>Your account</h3>
                            <p className="settings-section-desc">Profile, password, activity and more</p>
                        </div>
                    </div>

                    <div className="settings-item" onClick={() => navigate('/profile/edit')}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">person</span>
                            <div>
                                <span className="settings-item-title">Edit Profile</span>
                                <span className="settings-item-sub">Name, bio, interests, photos</span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined settings-chevron">chevron_right</span>
                    </div>

                    <div className="settings-item" onClick={() => navigate('/profile')}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">badge</span>
                            <div>
                                <span className="settings-item-title">View My Profile</span>
                                <span className="settings-item-sub">See how others see you</span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined settings-chevron">chevron_right</span>
                    </div>

                    <div className="settings-item" onClick={() => setShowChangePass(!showChangePass)}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">lock</span>
                            <div>
                                <span className="settings-item-title">Change Password</span>
                                <span className="settings-item-sub">Update your login credentials</span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined settings-chevron">{showChangePass ? 'expand_less' : 'chevron_right'}</span>
                    </div>
                    {showChangePass && (
                        <div className="settings-expand">
                            <input className="input-field" type="password" placeholder="Current password"
                                value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
                            <input className="input-field" type="password" placeholder="New password (min 4 chars)"
                                value={newPass} onChange={e => setNewPass(e.target.value)} style={{ marginTop: 8 }} />
                            <input className="input-field" type="password" placeholder="Confirm new password"
                                value={confirmPass} onChange={e => setConfirmPass(e.target.value)} style={{ marginTop: 8 }} />
                            <button className="btn-primary" onClick={handleChangePassword} disabled={passLoading}
                                style={{ marginTop: 10, width: '100%' }}>
                                {passLoading ? 'Changing...' : '🔒 Update Password'}
                            </button>
                        </div>
                    )}
                </div>}

                {/* Privacy & Safety — Instagram style */}
                {show.privacy && <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>shield</span>
                        <div>
                            <h3>Privacy & safety</h3>
                            <p className="settings-section-desc">Manage your campus safety</p>
                        </div>
                    </div>

                    <div className="settings-item" onClick={() => setShowSafety(!showSafety)}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">verified_user</span>
                            <div>
                                <span className="settings-item-title">Safety Guidelines</span>
                                <span className="settings-item-sub">Tips for staying safe on campus</span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined settings-chevron">{showSafety ? 'expand_less' : 'chevron_right'}</span>
                    </div>
                    {showSafety && (
                        <div className="safety-tips-card" style={{ margin: '0 0 8px 0' }}>
                            <ul className="safety-list">
                                <li>🔒 <strong>Never share</strong> your password, financial info, or personal ID numbers.</li>
                                <li>📍 <strong>Meet in public</strong> — choose well-lit, busy spots on campus.</li>
                                <li>👥 <strong>Tell a friend</strong> where you're going when meeting someone new.</li>
                                <li>🚩 <strong>Trust your instincts</strong> — if something feels off, unmatch and report.</li>
                                <li>⚠️ <strong>Report suspicious behavior</strong> — we auto-suspend after 3+ reports.</li>
                                <li>⏳ <strong>Don't rush</strong> — take your time getting to know them first.</li>
                            </ul>
                        </div>
                    )}

                    <div className="settings-item" onClick={() => showToast('Blocked Profiles coming soon!', 'info')}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">block</span>
                            <div>
                                <span className="settings-item-title">Blocked Profiles</span>
                                <span className="settings-item-sub">Manage profiles you've blocked</span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined settings-chevron">chevron_right</span>
                    </div>

                    {/* NITKnot Premium Features Section */}
                    <div className="settings-section-header" style={{ marginTop: 20 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#f59e0b' }}>workspace_premium</span>
                        <div>
                            <h3 style={{ color: '#f59e0b' }}>Premium controls</h3>
                            <p className="settings-section-desc">Exclusive privacy features</p>
                        </div>
                    </div>

                    <div className="settings-item" style={{ cursor: 'default' }}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined" style={{ color: '#a78bfa' }}>visibility_off</span>
                            <div>
                                <span className="settings-item-title">Incognito Mode</span>
                                <span className="settings-item-sub">Only show profile to people you like</span>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={incognito} onChange={(e) => {
                                setIncognito(e.target.checked);
                                showToast(e.target.checked ? 'Incognito Mode ON 🕵️‍♀️' : 'Incognito Mode OFF', 'success');
                            }} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div className="settings-item" style={{ cursor: 'default' }}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>done_all</span>
                            <div>
                                <span className="settings-item-title">Read Receipts</span>
                                <span className="settings-item-sub">Let others see when you've read messages</span>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={readReceipts} onChange={(e) => {
                                setReadReceipts(e.target.checked);
                                showToast(e.target.checked ? 'Read Receipts ON' : 'Read Receipts OFF', 'info');
                            }} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    <div className="settings-item" style={{ cursor: 'default' }}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>
                                {theme === 'light' ? 'light_mode' : 'dark_mode'}
                            </span>
                            <div>
                                <span className="settings-item-title">Dark Mode</span>
                                <span className="settings-item-sub">Switch between light and dark themes</span>
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>}

                {/* Report History */}
                {reports.length > 0 && (
                    <div className="settings-section">
                        <div className="settings-section-header" style={{ color: 'var(--danger)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--danger)' }}>warning</span>
                            <div>
                                <h3 style={{ color: 'var(--danger)' }}>Community guidelines</h3>
                                <p className="settings-section-desc">You have {reports.length} report{reports.length > 1 ? 's' : ''} against your account</p>
                            </div>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10, padding: '0 4px' }}>
                            3+ reports from different users will result in automatic suspension.
                        </p>
                        {reports.map((r, i) => (
                            <div key={i} className="report-item">
                                <div className="report-reason">
                                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--danger)' }}>flag</span>
                                    <strong>{r.reason}</strong>
                                </div>
                                {r.details && <p className="report-details">{r.details}</p>}
                                <span className="report-date">{new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* How to use NITKnot */}
                {show.howTo && <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>help</span>
                        <div>
                            <h3>How to use NITKnot</h3>
                            <p className="settings-section-desc">Get the most out of the app</p>
                        </div>
                    </div>

                    <div className="settings-item">
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">swipe</span>
                            <div>
                                <span className="settings-item-title">Swipe right to like</span>
                                <span className="settings-item-sub">Left to pass, right to like someone</span>
                            </div>
                        </div>
                    </div>
                    <div className="settings-item">
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">favorite</span>
                            <div>
                                <span className="settings-item-title">Mutual likes = Match!</span>
                                <span className="settings-item-sub">Both swipe right? You can chat now</span>
                            </div>
                        </div>
                    </div>
                    <div className="settings-item">
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">touch_app</span>
                            <div>
                                <span className="settings-item-title">Double-tap to react</span>
                                <span className="settings-item-sub">Double-tap messages to send a ❤️</span>
                            </div>
                        </div>
                    </div>
                    <div className="settings-item">
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">timer</span>
                            <div>
                                <span className="settings-item-title">48h match timer</span>
                                <span className="settings-item-sub">Send a message within 48h or the match expires</span>
                            </div>
                        </div>
                    </div>
                </div>}

                {/* About NITKnot */}
                {show.about && <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>info</span>
                        <div>
                            <h3>About</h3>
                            <p className="settings-section-desc">App info and credits</p>
                        </div>
                    </div>
                    <div className="about-card">
                        <div className="about-logo">NITKnot</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            The dating app made exclusively for NITK Surathkal students.
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 6 }}>
                            Version 2.0 • Made with ❤️ for NITK
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                            <span className="about-badge">🎓 Campus Only</span>
                            <span className="about-badge">🔒 Secure</span>
                            <span className="about-badge">💕 Free Forever</span>
                        </div>
                    </div>
                </div>}

                {/* Login section — Instagram-style "Log in" section */}
                {show.logins && <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>login</span>
                        <div>
                            <h3>Logins</h3>
                            <p className="settings-section-desc">Signed in as {user?.email || 'your account'}</p>
                        </div>
                    </div>

                    {user && user.is_admin === 1 && (
                        <div className="settings-item admin-link" onClick={() => navigate('/admin')} style={{ borderTop: '1px solid var(--border)', marginTop: 10 }}>
                            <div className="settings-item-left">
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>shield_person</span>
                                <div>
                                    <span className="settings-item-title" style={{ color: 'var(--primary)', fontWeight: 700 }}>Admin Command Center</span>
                                    <span className="settings-item-sub">Manage reports and verifications</span>
                                </div>
                            </div>
                            <span className="material-symbols-outlined settings-chevron" style={{ color: 'var(--primary)' }}>chevron_right</span>
                        </div>
                    )}

                    <button className="settings-logout-btn" onClick={handleLogout}>
                        <span className="material-symbols-outlined">logout</span>
                        Log out
                    </button>
                </div>}

                {/* Danger Zone */}
                {show.danger && <div className="settings-section danger-zone">
                    <div className="settings-section-header">
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--danger)' }}>dangerous</span>
                        <div>
                            <h3 style={{ color: 'var(--danger)' }}>Danger zone</h3>
                            <p className="settings-section-desc">These actions are irreversible</p>
                        </div>
                    </div>
                    <div className="settings-item" onClick={deactivateAccount}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined" style={{ color: 'var(--warning, #f59e0b)' }}>pause_circle</span>
                            <div>
                                <span className="settings-item-title">Deactivate Account</span>
                                <span className="settings-item-sub">Temporarily hide — reactivate by logging in again</span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined settings-chevron">chevron_right</span>
                    </div>
                    <div className="settings-item" onClick={deleteAccount}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined" style={{ color: 'var(--danger)' }}>delete_forever</span>
                            <div>
                                <span className="settings-item-title" style={{ color: 'var(--danger)' }}>Delete Account</span>
                                <span className="settings-item-sub">Permanently remove all your data</span>
                            </div>
                        </div>
                        <span className="material-symbols-outlined settings-chevron" style={{ color: 'var(--danger)' }}>chevron_right</span>
                    </div>
                </div>}
            </div>
        </div>
    );
}
