import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ reports: [], pendingVerifications: [], stats: {} });
    const [activeTab, setActiveTab] = useState('reports');
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [masterPass, setMasterPass] = useState('');
    const [unlocking, setUnlocking] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [vaultError, setVaultError] = useState(false);

    // Settings state
    const [currentKey, setCurrentKey] = useState('');
    const [newKey, setNewKey] = useState('');
    const [confirmKey, setConfirmKey] = useState('');
    const [changingKey, setChangingKey] = useState(false);

    useEffect(() => {
        if (user && user.is_admin === 1 && isUnlocked) {
            loadDashboardData();
        } else if (user && user.is_admin === 1) {
            setLoading(false);
        }
    }, [user, isUnlocked]);

    const handleUnlock = async (e) => {
        e.preventDefault();
        setUnlocking(true);
        setVaultError(false);
        try {
            await apiFetch('/api/admin/unlock', {
                method: 'POST',
                body: JSON.stringify({ masterPassword: masterPass })
            });
            setIsUnlocked(true);
            showToast('Secure Session Established', 'success');
        } catch (e) {
            setVaultError(true);
            showToast('Invalid Master Key', 'error');
            setMasterPass('');
            // Remove shake after animation
            setTimeout(() => setVaultError(false), 600);
        }
        setUnlocking(false);
    };

    const handleLockVault = () => {
        setIsUnlocked(false);
        setMasterPass('');
        setData({ reports: [], pendingVerifications: [], stats: {} });
        setActiveTab('reports');
        setSearchQuery('');
        showToast('Vault Locked — Session Ended', 'success');
    };

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const result = await apiFetch('/api/admin/dashboard');
            setData(result);
        } catch (e) {
            showToast('Failed to load dashboard', 'error');
        }
        setLoading(false);
    };

    const handleVerify = async (userId, status) => {
        try {
            await apiFetch(`/api/admin/users/${userId}/verify`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            showToast(`User ${status}!`, 'success');
            loadDashboardData();
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const handleBan = async (userId) => {
        if (!window.confirm('⚠️ This will permanently ban this user from NITKnot. Continue?')) return;
        try {
            await apiFetch(`/api/admin/users/${userId}/ban`, { method: 'PUT' });
            showToast('User banned from platform', 'success');
            loadDashboardData();
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const handleDismissReport = async (reportId) => {
        if (!window.confirm('Dismiss this report? It will be permanently removed.')) return;
        try {
            await apiFetch(`/api/admin/reports/${reportId}/dismiss`, { method: 'DELETE' });
            showToast('Report dismissed', 'success');
            loadDashboardData();
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const handleChangeKey = async (e) => {
        e.preventDefault();
        if (newKey !== confirmKey) {
            showToast('New keys do not match', 'error');
            return;
        }
        if (newKey.length < 8) {
            showToast('New key must be at least 8 characters', 'error');
            return;
        }
        setChangingKey(true);
        try {
            await apiFetch('/api/admin/change-master-password', {
                method: 'PUT',
                body: JSON.stringify({ currentPassword: currentKey, newPassword: newKey })
            });
            showToast('Master Key rotated successfully! 🔐', 'success');
            setCurrentKey('');
            setNewKey('');
            setConfirmKey('');
        } catch (e) {
            showToast(e.message || 'Failed to change key', 'error');
        }
        setChangingKey(false);
    };

    // ========== RENDER GATES ==========

    if (!user || user.is_admin !== 1) {
        return (
            <div className="admin-access-denied view-animate">
                <span className="material-symbols-outlined">shield_lock</span>
                <h2>Access Restricted</h2>
                <p>This is a secure operations zone restricted to authorized NITKnot administrators.</p>
                <button className="btn-verify" onClick={() => navigate('/discover')}>Return to Campus</button>
            </div>
        );
    }

    if (!isUnlocked) {
        return (
            <div className="admin-vault-gate view-animate">
                <div className={`vault-box ${vaultError ? 'vault-shake' : ''}`}>
                    <div className="vault-icon-ring">
                        <span className="material-symbols-outlined vault-icon">lock_person</span>
                    </div>
                    <h2>Security Vault</h2>
                    <p>Enter the Master Key to access the NITKnot Command Center. This session is encrypted end-to-end.</p>
                    <form onSubmit={handleUnlock}>
                        <div className="input-group">
                            <input
                                type="password"
                                placeholder="•••••••••••"
                                value={masterPass}
                                onChange={(e) => setMasterPass(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        {vaultError && <p className="vault-error-msg">Incorrect Master Key. Try again.</p>}
                        <button className="btn-verify" type="submit" disabled={unlocking}>
                            {unlocking ? (
                                <><span className="spinner-sm"></span> Authenticating...</>
                            ) : (
                                <><span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle' }}>vpn_key</span> Unlock Vault</>
                            )}
                        </button>
                    </form>
                    <p className="vault-hint">Forgot the key? Check your <code>.env</code> file.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="spinner"></div>
                <p>Establishing Secure Connection...</p>
            </div>
        );
    }

    // ========== FILTERED DATA ==========

    const filteredVerifications = data.pendingVerifications.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.branch.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredReports = data.reports.filter(r =>
        r.reported_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reporter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reason.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ========== MAIN DASHBOARD ==========

    return (
        <div className="admin-dashboard view-animate">
            <header className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button className="btn-icon" onClick={() => navigate('/discover')} title="Return to Campus">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1>Command Center</h1>
                        <p className="admin-subtitle">
                            <span className="secure-dot"></span>
                            Secure Session • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-icon" onClick={loadDashboardData} title="Refresh">
                        <span className="material-symbols-outlined">sync</span>
                    </button>
                    <button className="btn-icon btn-lock-vault" onClick={handleLockVault} title="Lock Vault">
                        <span className="material-symbols-outlined">lock</span>
                    </button>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="admin-stats-grid">
                <div className="admin-stat-card">
                    <span className="material-symbols-outlined">groups</span>
                    <span className="stat-value">{data.stats?.total_users || 0}</span>
                    <span className="stat-label">Personnel</span>
                </div>
                <div className="admin-stat-card success">
                    <span className="material-symbols-outlined">verified</span>
                    <span className="stat-value">{data.stats?.verified_users || 0}</span>
                    <span className="stat-label">Verified</span>
                </div>
                <div className="admin-stat-card danger">
                    <span className="material-symbols-outlined">flag</span>
                    <span className="stat-value">{data.stats?.total_reports || 0}</span>
                    <span className="stat-label">Incidents</span>
                </div>
            </div>

            {/* Search — only show for reports/verifications */}
            {activeTab !== 'settings' && (
                <div className="admin-search-bar">
                    <span className="material-symbols-outlined">search</span>
                    <input
                        type="text"
                        placeholder="Search personnel, incidents, or reasons..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="search-clear" onClick={() => setSearchQuery('')}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="admin-tabs">
                <button className={activeTab === 'reports' ? 'active' : ''} onClick={() => setActiveTab('reports')}>
                    <span className="material-symbols-outlined">flag</span>
                    Reports
                </button>
                <button className={activeTab === 'verifications' ? 'active' : ''} onClick={() => setActiveTab('verifications')}>
                    <span className="material-symbols-outlined">verified_user</span>
                    Verify
                </button>
                <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
                    <span className="material-symbols-outlined">settings</span>
                    Settings
                </button>
            </div>

            <div className="admin-content">
                {/* ========== REPORTS TAB ========== */}
                {activeTab === 'reports' && (
                    <div className="admin-list">
                        {filteredReports.length === 0 ? (
                            <div className="empty-state-card">
                                <span className="material-symbols-outlined">shield</span>
                                <h3>All Clear</h3>
                                <p>No active incidents. The campus community is safe.</p>
                            </div>
                        ) : (
                            filteredReports.map(r => (
                                <div key={r.id} className="admin-item report-item">
                                    <div className="item-header">
                                        <span className="report-reason">{r.reason}</span>
                                        <span className="report-date">
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                                            {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                    <p className="report-details">"{r.details || 'No additional details provided'}"</p>
                                    <div className="item-footer">
                                        <div className="user-pair">
                                            <span className="user-chip">
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person</span>
                                                {r.reporter_name}
                                            </span>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>arrow_forward</span>
                                            <span className="user-chip reported">
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>gpp_bad</span>
                                                {r.reported_name}
                                            </span>
                                        </div>
                                        <div className="item-actions">
                                            <button className="btn-action ghost" onClick={() => handleDismissReport(r.id)}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                                                Dismiss
                                            </button>
                                            <button className="btn-action danger" onClick={() => handleBan(r.reported_id)}>
                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span>
                                                Ban User
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ========== VERIFICATIONS TAB ========== */}
                {activeTab === 'verifications' && (
                    <div className="admin-list">
                        {filteredVerifications.length === 0 ? (
                            <div className="empty-state-card">
                                <span className="material-symbols-outlined">task_alt</span>
                                <h3>Queue Empty</h3>
                                <p>No pending verification requests. All caught up!</p>
                            </div>
                        ) : (
                            filteredVerifications.map(u => (
                                <div key={u.id} className="admin-item verify-item">
                                    <div className="verify-info">
                                        <h3>{u.name}</h3>
                                        <p>{u.branch} • {u.year}</p>
                                        <span className={`status-pill ${u.verification_status}`}>{u.verification_status}</span>
                                    </div>
                                    {u.id_card_url ? (
                                        u.id_card_url.toLowerCase().endsWith('.pdf') ? (
                                            <div className="id-document-preview">
                                                <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--primary)' }}>description</span>
                                                <p>PDF ID Card</p>
                                                <button className="btn-action ghost" style={{ marginTop: 8 }} onClick={() => window.open(u.id_card_url, '_blank')}>
                                                    View PDF Document
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="id-preview" onClick={() => window.open(u.id_card_url, '_blank')}>
                                                <img src={u.id_card_url} alt="ID Card" />
                                                <div className="id-overlay">
                                                    <span className="material-symbols-outlined">open_in_new</span>
                                                    Tap to view full
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <div className="id-missing">
                                            <span className="material-symbols-outlined" style={{ fontSize: 24, opacity: 0.4 }}>badge</span>
                                            <span>No ID uploaded yet</span>
                                        </div>
                                    )}
                                    <div className="item-actions">
                                        <button className="btn-action success" onClick={() => handleVerify(u.id, 'verified')}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                                            Approve
                                        </button>
                                        <button className="btn-action ghost" onClick={() => handleVerify(u.id, 'rejected')}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ========== SETTINGS TAB ========== */}
                {activeTab === 'settings' && (
                    <div className="admin-settings">
                        <div className="settings-card">
                            <div className="settings-card-header">
                                <span className="material-symbols-outlined">vpn_key</span>
                                <div>
                                    <h3>Rotate Master Key</h3>
                                    <p>Change the vault access password. All future logins will require the new key.</p>
                                </div>
                            </div>
                            <form onSubmit={handleChangeKey} className="settings-form">
                                <div className="settings-input-group">
                                    <label>Current Master Key</label>
                                    <input
                                        type="password"
                                        placeholder="Enter current key"
                                        value={currentKey}
                                        onChange={(e) => setCurrentKey(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="settings-input-group">
                                    <label>New Master Key</label>
                                    <input
                                        type="password"
                                        placeholder="Minimum 8 characters"
                                        value={newKey}
                                        onChange={(e) => setNewKey(e.target.value)}
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <div className="settings-input-group">
                                    <label>Confirm New Key</label>
                                    <input
                                        type="password"
                                        placeholder="Re-enter new key"
                                        value={confirmKey}
                                        onChange={(e) => setConfirmKey(e.target.value)}
                                        required
                                    />
                                    {confirmKey && newKey && confirmKey !== newKey && (
                                        <span className="input-error">Keys do not match</span>
                                    )}
                                    {confirmKey && newKey && confirmKey === newKey && (
                                        <span className="input-success">Keys match ✓</span>
                                    )}
                                </div>
                                <button className="btn-verify" type="submit" disabled={changingKey || !currentKey || !newKey || newKey !== confirmKey}>
                                    {changingKey ? 'Rotating Key...' : 'Update Master Key'}
                                </button>
                            </form>
                        </div>

                        <div className="settings-card">
                            <div className="settings-card-header">
                                <span className="material-symbols-outlined">info</span>
                                <div>
                                    <h3>Security Info</h3>
                                    <p>Current vault configuration and session details.</p>
                                </div>
                            </div>
                            <div className="settings-info-grid">
                                <div className="info-row">
                                    <span>Session Status</span>
                                    <span className="info-value active"><span className="secure-dot"></span> Active</span>
                                </div>
                                <div className="info-row">
                                    <span>Auth Level</span>
                                    <span className="info-value">JWT + Master Key (2FA)</span>
                                </div>
                                <div className="info-row">
                                    <span>Admin User</span>
                                    <span className="info-value">{user.name}</span>
                                </div>
                                <div className="info-row">
                                    <span>Key Storage</span>
                                    <span className="info-value">.env (Local)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
