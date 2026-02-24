import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Settings() {
    const navigate = useNavigate();
    const { user, logout, isAuthenticated, refreshUser } = useAuth();
    const { showToast } = useToast();
    const [reports, setReports] = useState([]);
    const [showChangePass, setShowChangePass] = useState(false);
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [passLoading, setPassLoading] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) navigate('/', { replace: true });
        loadReports();
    }, [isAuthenticated]);

    const loadReports = async () => {
        try {
            const data = await apiFetch('/api/reports/me');
            setReports(data.reports || []);
        } catch { /* will 404 if endpoint doesn't exist yet, that's fine */ }
    };

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
            <div className="settings-header">
                <button className="btn-icon" onClick={() => navigate('/profile')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2>Settings</h2>
            </div>

            <div className="settings-body">
                {/* Account Section */}
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        <span className="material-symbols-outlined">person</span> Account
                    </h3>
                    <div className="settings-item" onClick={() => navigate('/profile/edit')}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">edit</span>
                            <span>Edit Profile</span>
                        </div>
                        <span className="material-symbols-outlined settings-chevron">chevron_right</span>
                    </div>
                    <div className="settings-item" onClick={() => setShowChangePass(!showChangePass)}>
                        <div className="settings-item-left">
                            <span className="material-symbols-outlined">lock</span>
                            <span>Change Password</span>
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
                </div>

                {/* Safety & Privacy */}
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        <span className="material-symbols-outlined">shield</span> Safety & Privacy
                    </h3>
                    <div className="safety-tips-card">
                        <h4>🛡️ NITKnot Safety Guidelines</h4>
                        <ul className="safety-list">
                            <li><strong>Never share</strong> your password, financial info, or personal ID numbers.</li>
                            <li><strong>Meet in public</strong> — choose well-lit, busy spots on campus for first meetings.</li>
                            <li><strong>Tell a friend</strong> where you're going when meeting someone new.</li>
                            <li><strong>Trust your instincts</strong> — if something feels off, unmatch and report.</li>
                            <li><strong>Report suspicious behavior</strong> — we auto-suspend accounts with multiple reports.</li>
                            <li><strong>Don't rush</strong> — take your time getting to know someone before meeting up.</li>
                        </ul>
                    </div>
                </div>

                {/* Report History */}
                {reports.length > 0 && (
                    <div className="settings-section">
                        <h3 className="settings-section-title" style={{ color: 'var(--danger)' }}>
                            <span className="material-symbols-outlined">warning</span> Reports Against You
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                            If you receive 3+ reports from different users, your account will be auto-suspended.
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

                {/* App Info */}
                <div className="settings-section">
                    <h3 className="settings-section-title">
                        <span className="material-symbols-outlined">info</span> About
                    </h3>
                    <div className="about-card">
                        <div className="about-logo">NITKnot 💕</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            The dating app made exclusively for NITK Surathkal students.
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                            Version 2.0 • Made with ❤️ for NITK
                        </p>
                    </div>
                </div>

                {/* Logout */}
                <div className="settings-section">
                    <button className="settings-logout-btn" onClick={handleLogout}>
                        <span className="material-symbols-outlined">logout</span>
                        Log Out
                    </button>
                </div>

                {/* Danger Zone */}
                <div className="settings-section danger-zone">
                    <h3 className="settings-section-title" style={{ color: 'var(--danger)' }}>
                        <span className="material-symbols-outlined">dangerous</span> Danger Zone
                    </h3>
                    <button className="btn-secondary" onClick={deactivateAccount} style={{ marginBottom: 10, width: '100%' }}>
                        <span className="material-symbols-outlined">pause_circle</span> Deactivate Account
                    </button>
                    <button className="btn-ghost" onClick={deleteAccount}
                        style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.4)', width: '100%' }}>
                        <span className="material-symbols-outlined">delete_forever</span> Delete Account Permanently
                    </button>
                </div>
            </div>
        </div>
    );
}
