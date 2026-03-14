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
    const [refreshing, setRefreshing] = useState(false);
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

    // Broadcast state
    const [broadcast, setBroadcast] = useState({ title: '', message: '', type: 'info' });
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

    // Premium state
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [premiumRequests, setPremiumRequests] = useState([]);
    const [newPayment, setNewPayment] = useState({ label: '', type: 'qr', upi_id: '' });
    const [qrFile, setQrFile] = useState(null);
    const [addingMethod, setAddingMethod] = useState(false);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated && user && user.is_admin === 1 && isUnlocked) {
            loadDashboardData();
        } else if (isAuthenticated && user && user.is_admin === 1) {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isUnlocked, isAuthenticated]);

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

    const loadDashboardData = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const [result, pm, pr] = await Promise.all([
                apiFetch('/api/admin/dashboard'),
                apiFetch('/api/admin/payment-methods'),
                apiFetch('/api/admin/premium-requests')
            ]);
            setData(result);
            setPaymentMethods(pm.methods || []);
            setPremiumRequests(pr.requests || []);
        } catch (e) {
            showToast('Failed to load dashboard data', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleVerify = async (userId, status) => {
        try {
            await apiFetch(`/api/admin/users/${userId}/verify`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            showToast(`User ${status}!`, 'success');
            loadDashboardData(true);
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const handleBan = async (userId) => {
        if (!window.confirm('⚠️ This will permanently ban this user from SPARK. Continue?')) return;
        try {
            await apiFetch(`/api/admin/users/${userId}/ban`, { method: 'PUT' });
            showToast('User banned from platform', 'success');
            loadDashboardData(true);
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const handleDismissReport = async (reportId) => {
        if (!window.confirm('Dismiss this report? It will be permanently removed.')) return;
        try {
            await apiFetch(`/api/admin/reports/${reportId}/dismiss`, { method: 'DELETE' });
            showToast('Report dismissed', 'success');
            loadDashboardData(true);
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

    const handleBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcast.title || !broadcast.message) {
            showToast('Title and message are required', 'error');
            return;
        }
        if (!window.confirm('🚀 Send this announcement to the ENTIRE campus?')) return;

        setSendingBroadcast(true);
        try {
            await apiFetch('/api/admin/broadcast', {
                method: 'POST',
                body: JSON.stringify(broadcast)
            });
            showToast('Campus-wide broadcast sent!', 'success');
            setBroadcast({ title: '', message: '', type: 'info' });
            setActiveTab('reports');
        } catch (e) {
            showToast(e.message, 'error');
        }
        setSendingBroadcast(false);
    };

    // ========== PREMIUM HANDLERS ==========

    const handleAddPaymentMethod = async (e) => {
        e.preventDefault();
        if (!newPayment.label) return showToast('Label is required', 'error');
        setAddingMethod(true);
        try {
            const formData = new FormData();
            formData.append('label', newPayment.label);
            formData.append('type', newPayment.type);
            if (newPayment.upi_id) formData.append('upi_id', newPayment.upi_id);
            if (qrFile) formData.append('qr_image', qrFile);

            const token = localStorage.getItem('token');
            const resp = await fetch('/api/admin/payment-methods', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const result = await resp.json();
            if (!resp.ok) throw new Error(result.error);
            setPaymentMethods(result.methods || []);
            setNewPayment({ label: '', type: 'qr', upi_id: '' });
            setQrFile(null);
            showToast('Payment method added! 💳', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
        setAddingMethod(false);
    };

    const togglePaymentMethod = async (id) => {
        try {
            const result = await apiFetch(`/api/admin/payment-methods/${id}/toggle`, { method: 'PUT' });
            setPaymentMethods(result.methods || []);
            showToast('Payment method toggled', 'success');
        } catch (e) { showToast(e.message, 'error'); }
    };

    const deletePaymentMethod = async (id) => {
        if (!window.confirm('Delete this payment method?')) return;
        try {
            const result = await apiFetch(`/api/admin/payment-methods/${id}`, { method: 'DELETE' });
            setPaymentMethods(result.methods || []);
            showToast('Payment method deleted', 'success');
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handlePremiumAction = async (requestId, action) => {
        const note = action === 'reject' ? window.prompt('Reason for rejection (optional):') : null;
        try {
            await apiFetch(`/api/admin/premium-requests/${requestId}/${action}`, {
                method: 'PUT',
                body: JSON.stringify({ note: note || (action === 'approve' ? 'Approved' : 'Rejected') })
            });
            showToast(action === 'approve' ? 'User upgraded to Premium! 💎' : 'Request rejected', 'success');
            loadDashboardData(true);
        } catch (e) { showToast(e.message, 'error'); }
    };

    // ========== RENDER GATES ==========

    if (!user || user.is_admin !== 1) {
        return (
            <div className="admin-access-denied view-animate" style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '20px',
                background: 'radial-gradient(circle at center, #1a0b2e 0%, #050505 100%)'
            }}>
                <div className="vault-ring" style={{ width: '100px', height: '100px', marginBottom: '30px' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--danger)' }}>shield_lock</span>
                </div>
                <h1 className="font-serif" style={{ fontSize: '2rem', marginBottom: '10px' }}>Restricted Sector</h1>
                <p style={{ maxWidth: '400px', opacity: 0.6, lineHeight: 1.6 }}>Unauthorized access to the SPARK Command Center is strictly prohibited. Your identifiers have been logged.</p>
                <button className="btn-primary holographic" onClick={() => navigate('/discover')} style={{ marginTop: '30px' }}>
                    Return to Campus
                </button>
            </div>
        );
    }

    if (!isUnlocked) {
        return (
            <div className="vault-gate-spark view-animate">
                <div className="glass-card holographic" style={{ maxWidth: '420px', padding: '40px 30px', textAlign: 'center' }}>
                    <div className="vault-ring">
                        <span className="material-symbols-rounded" style={{ fontSize: '48px', color: 'var(--primary-light)' }}>
                            {unlocking ? 'settings_web' : 'key_visualizer'}
                        </span>
                    </div>
                    <h2 className="font-serif" style={{ fontSize: '1.8rem', marginBottom: '10px' }}>Security Vault</h2>
                    <p style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '30px' }}>
                        Provide the Master Key to establish a secure administrative link with the SPARK Core.
                    </p>
                    <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="input-group-spark">
                            <input
                                type="password"
                                placeholder="ENTER MASTER KEY"
                                value={masterPass}
                                onChange={(e) => setMasterPass(e.target.value)}
                                required
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '15px',
                                    textAlign: 'center',
                                    letterSpacing: '0.5em',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    color: 'white',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        {vaultError && (
                            <div className="view-animate" style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
                                Signature Mismatch. Access Denied.
                            </div>
                        )}
                        <button className="btn-primary holographic" type="submit" disabled={unlocking} style={{ width: '100%', padding: '15px' }}>
                            {unlocking ? 'Authenticating...' : 'Authorize Session'}
                        </button>
                    </form>
                    <div style={{ marginTop: '40px', fontSize: '0.75rem', opacity: 0.4 }}>
                        SPARK SYSTEM ADMINISTRATION • END-TO-END ENCRYPTED
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="admin-loading" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
                <div className="cosmic-loader"></div>
                <p style={{ marginTop: '20px', letterSpacing: '2px', fontSize: '0.8rem', opacity: 0.6 }}>ESTABLISHING SECURE LINK...</p>
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

    return (
        <div className="admin-dashboard view-animate" style={{ minHeight: '100vh', background: 'var(--bg-main)', paddingBottom: '100px' }}>
            {/* Command Header */}
            <header className="glass-card" style={{
                padding: '20px 24px',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                borderRadius: 0,
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(30px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button className="btn-icon" onClick={() => navigate('/discover')} style={{ background: 'var(--bg-elevated)' }}>
                        <span className="material-symbols-rounded">rocket_launch</span>
                    </button>
                    <div>
                        <h1 className="font-serif" style={{ fontSize: '1.4rem', margin: 0 }}>Command Center</h1>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="pulse-dot"></span> SECURE SESSION ACTIVE • {user.name.toUpperCase()}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {refreshing && (
                        <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, marginRight: 10, alignSelf: 'center' }} />
                    )}
                    <button className="btn-icon" onClick={() => loadDashboardData(true)} style={{ background: 'none' }} disabled={refreshing}>
                        <span className="material-symbols-rounded" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>refresh</span>
                    </button>
                    <button className="btn-icon" onClick={handleLockVault} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                        <span className="material-symbols-rounded">terminal</span>
                    </button>
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>

                {/* Real-time Intel: Professional Dashboard Stats */}
                <div className="admin-stats-v2 view-animate">
                    <div className="admin-card-pro">
                        <div className="admin-card-icon">
                            <span className="material-symbols-rounded">group</span>
                        </div>
                        <span className="admin-card-label">Personnel</span>
                        <div className="admin-card-value">{(data.stats?.total_users || 0).toLocaleString()}</div>
                        <div className="admin-card-trend trend-up">
                            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>trending_up</span>
                            <span>Live Campus Orbit</span>
                        </div>
                    </div>

                    <div className="admin-card-pro">
                        <div className="admin-card-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                            <span className="material-symbols-rounded">verified</span>
                        </div>
                        <span className="admin-card-label">Verified Units</span>
                        <div className="admin-card-value">{(data.stats?.verified_users || 0).toLocaleString()}</div>
                        <div className="admin-card-trend trend-up">
                            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>verified</span>
                            <span>{Math.round((data.stats?.verified_users / data.stats?.total_users) * 100 || 0)}% Integrity</span>
                        </div>
                    </div>

                    <div className="admin-card-pro revenue">
                        <div className="admin-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            <span className="material-symbols-rounded">payments</span>
                        </div>
                        <span className="admin-card-label">Total Revenue</span>
                        <div className="admin-card-value">₹{(data.stats?.total_revenue || 0).toLocaleString()}</div>
                        <div className="finance-chart-mock">
                            {[40, 70, 45, 90, 65, 80, 100].map((h, i) => (
                                <div key={i} className="chart-bar" style={{ height: `${h}%`, background: '#f59e0b' }}></div>
                            ))}
                        </div>
                    </div>

                    <div className="admin-card-pro incidents">
                        <div className="admin-card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            <span className="material-symbols-rounded">emergency</span>
                        </div>
                        <span className="admin-card-label">System Incidents</span>
                        <div className="admin-card-value">{data.stats?.total_reports || 0}</div>
                        <div className="admin-card-trend" style={{ color: data.stats?.total_reports > 5 ? '#ef4444' : '#22c55e' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
                                {data.stats?.total_reports > 5 ? 'warning' : 'check_circle'}
                            </span>
                            <span>{data.stats?.total_reports > 5 ? 'Action Required' : 'Stable Ops'}</span>
                        </div>
                    </div>
                </div>

                {/* Tactical Navigation */}
                <div className="admin-tabs glass-card" style={{
                    display: 'flex',
                    gap: '5px',
                    padding: '5px',
                    borderRadius: '15px',
                    marginBottom: '30px',
                    background: 'var(--bg-elevated)',
                    overflowX: 'auto'
                }}>
                    {[
                        { id: 'reports', icon: 'flag', label: 'Incidents' },
                        { id: 'verifications', icon: 'verified_user', label: 'Personnel' },
                        { id: 'broadcast', icon: 'campaign', label: 'Signal' },
                        { id: 'premium', icon: 'diamond', label: 'Revenue' },
                        { id: 'settings', icon: 'terminal', label: 'Config' }
                    ].map(tab => (
                        <button key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                padding: '12px 20px',
                                borderRadius: '12px',
                                border: 'none',
                                background: activeTab === tab.id ? 'var(--gradient-primary)' : 'transparent',
                                color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                whiteSpace: 'nowrap'
                            }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>{tab.icon}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="admin-content-spark">
                    {/* Search Strip */}
                    {(activeTab === 'reports' || activeTab === 'verifications') && (
                        <div className="glass-card" style={{
                            padding: '12px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            marginBottom: '20px',
                            background: 'var(--bg-elevated)'
                        }}>
                            <span className="material-symbols-rounded" style={{ opacity: 0.5 }}>search</span>
                            <input
                                type="text"
                                placeholder="Scan database for specific signatures..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    flex: 1,
                                    background: 'none',
                                    border: 'none',
                                    color: 'white',
                                    outline: 'none',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                    )}

                    {/* Content Views */}
                    {activeTab === 'reports' && (
                        <div className="admin-reports-view view-animate">
                            {filteredReports.length === 0 ? (
                                <div className="glass-card" style={{ padding: '80px 20px', textAlign: 'center', opacity: 0.6 }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '4rem', marginBottom: '20px' }}>verified_user</span>
                                    <h3>Zero Incident Sector</h3>
                                    <p>The campus is currently within safety parameters.</p>
                                </div>
                            ) : (
                                filteredReports.map(r => (
                                    <div key={r.id} className="admin-item-spark">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                    <span className="report-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>{r.reason.toUpperCase()}</span>
                                                    <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>{new Date(r.created_at).toLocaleString()}</span>
                                                </div>
                                                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>{r.reported_name} <span style={{ opacity: 0.4, fontWeight: 400 }}>reported by</span> {r.reporter_name}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn-icon" onClick={() => handleDismissReport(r.id)} style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                                                    <span className="material-symbols-rounded">verified</span>
                                                </button>
                                                <button className="btn-icon" onClick={() => handleBan(r.reported_id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                                                    <span className="material-symbols-rounded">block</span>
                                                </button>
                                            </div>
                                        </div>
                                        <p style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px', margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', borderLeft: '4px solid var(--danger)' }}>
                                            "{r.details || 'No telemetry provided.'}"
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'verifications' && (
                        <div className="admin-verify-view view-animate" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                            {filteredVerifications.length === 0 ? (
                                <div className="glass-card" style={{ gridColumn: '1/-1', padding: '80px 20px', textAlign: 'center', opacity: 0.6 }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '4rem', marginBottom: '20px' }}>task_alt</span>
                                    <h3>Queue Purged</h3>
                                    <p>All personnel have been processed and integrated.</p>
                                </div>
                            ) : (
                                filteredVerifications.map(u => (
                                    <div key={u.id} className="admin-item-spark">
                                        <div style={{ display: 'flex', gap: '15px' }}>
                                            <div className="glass-card" style={{ width: '80px', height: '110px', flexShrink: 0, overflow: 'hidden', padding: 0 }}>
                                                <img src={u.id_card_url} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                                    onClick={() => window.open(u.id_card_url, '_blank')} alt="ID" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{u.name}</h3>
                                                <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: '5px 0' }}>{u.branch} • Year {u.year}</p>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                                                    <button className="btn-primary holographic" onClick={() => handleVerify(u.id, 'verified')} style={{ padding: '8px 15px', fontSize: '0.8rem', background: '#22c55e' }}>Approve</button>
                                                    <button className="btn-secondary" onClick={() => handleVerify(u.id, 'rejected')} style={{ padding: '8px 15px', fontSize: '0.8rem' }}>Reject</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'broadcast' && (
                        <div className="admin-broadcast-view view-animate" style={{ maxWidth: '700px', margin: '0 auto' }}>
                            <div className="admin-table-container" style={{ border: 'none' }}>
                                <div style={{ padding: '40px', textAlign: 'center', background: 'linear-gradient(to bottom, rgba(139, 92, 246, 0.05), transparent)' }}>
                                    <div className="admin-card-icon" style={{ margin: '0 auto 20px', width: '64px', height: '64px' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>campaign</span>
                                    </div>
                                    <h2 className="font-serif" style={{ fontSize: '2rem' }}>Campus-Wide Signal</h2>
                                    <p style={{ opacity: 0.6, maxWidth: '400px', margin: '10px auto' }}>Dispatch an emergency or informational broadcast to every active device in the SPARK network.</p>
                                </div>
                                <form onSubmit={handleBroadcast} style={{ padding: '0 40px 40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="input-group-spark">
                                        <label style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 700, marginBottom: '8px', display: 'block' }}>SIGNAL IDENTIFIER</label>
                                        <input className="input-field" type="text" placeholder="e.g. SYSTEM_MAINTENANCE_ALPHA"
                                            value={broadcast.title} onChange={e => setBroadcast({ ...broadcast, title: e.target.value })} required 
                                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 700, marginBottom: '8px', display: 'block' }}>PAYLOAD CONTENT</label>
                                        <textarea className="textarea-field" placeholder="Draft your transmission..."
                                            value={broadcast.message} onChange={e => setBroadcast({ ...broadcast, message: e.target.value })} required
                                            style={{ minHeight: '150px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}></textarea>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {['info', 'success', 'warning'].map(type => (
                                            <button key={type} type="button" onClick={() => setBroadcast({ ...broadcast, type })}
                                                style={{
                                                    flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border)',
                                                    background: broadcast.type === type ? 'var(--primary-light)' : 'var(--bg-elevated)',
                                                    color: broadcast.type === type ? 'white' : 'var(--text-muted)',
                                                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase'
                                                }}>
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                    <button className="btn-primary holographic" type="submit" disabled={sendingBroadcast} style={{ padding: '18px', fontSize: '1rem' }}>
                                        {sendingBroadcast ? 'TRANSMITTING SIGNAL...' : 'EXECUTE GLOBAL BROADCAST'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {activeTab === 'premium' && (
                        <div className="admin-premium-view view-animate">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
                                {/* Finance Overview & Gateways */}
                                <div className="admin-table-container">
                                    <div className="admin-table-header">
                                        <h3 className="font-serif">Global Gateways</h3>
                                        <button className="btn-primary holographic" onClick={() => setActiveTab('premium')} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                                            View Payouts
                                        </button>
                                    </div>
                                    <div style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
                                            {paymentMethods.map(m => (
                                                <div key={m.id} className="admin-list-item" style={{ borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                                                    <div className="admin-avatar-pro">
                                                        {m.qr_image_url ? (
                                                            <img src={m.qr_image_url} style={{ width: '100%', height: '100%', borderRadius: '10px' }} alt="" />
                                                        ) : (
                                                            <span className="material-symbols-rounded">account_balance_wallet</span>
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700 }}>{m.label}</div>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{m.upi_id || 'QR Only Source'}</div>
                                                    </div>
                                                    <div className="admin-payment-pill">
                                                        {m.is_active ? 'ACTIVE' : 'OFFLINE'}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button className="btn-icon" onClick={() => togglePaymentMethod(m.id)}>
                                                            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>{m.is_active ? 'pause' : 'play_arrow'}</span>
                                                        </button>
                                                        <button className="btn-icon" onClick={() => deletePaymentMethod(m.id)} style={{ color: 'var(--danger)' }}>
                                                            <span className="material-symbols-rounded" style={{ fontSize: '18px' }}>delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="glass-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border)' }}>
                                            <h4 style={{ fontSize: '0.85rem', marginBottom: '15px', color: 'var(--primary-light)' }}>Register New Gateway</h4>
                                            <form onSubmit={handleAddPaymentMethod} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                    <input className="input-field" placeholder="Gateway Label (e.g. GPay Business)" value={newPayment.label} onChange={e => setNewPayment({ ...newPayment, label: e.target.value })} required />
                                                    <input className="input-field" placeholder="Business UPI ID" value={newPayment.upi_id} onChange={e => setNewPayment({ ...newPayment, upi_id: e.target.value })} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                    <label className="btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center' }}>
                                                        <span className="material-symbols-rounded" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 8 }}>qr_code_2</span>
                                                        {qrFile ? qrFile.name : 'Upload QR Signature'}
                                                        <input type="file" onChange={e => setQrFile(e.target.files[0])} style={{ display: 'none' }} />
                                                    </label>
                                                    <button className="btn-primary holographic" type="submit" disabled={addingMethod} style={{ flex: 1, padding: '10px' }}>
                                                        {addingMethod ? 'Syncing...' : 'Deploy Gateway'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>

                                {/* Premium Claims Intelligence */}
                                <div className="admin-table-container">
                                    <div className="admin-table-header">
                                        <h3 className="font-serif">Transaction Queue</h3>
                                        <span className="admin-payment-pill" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                                            {premiumRequests.filter(r => r.status === 'pending').length} Action Required
                                        </span>
                                    </div>
                                    <div style={{ padding: '20px', maxHeight: '600px', overflowY: 'auto' }}>
                                        {premiumRequests.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.4 }}>
                                                <span className="material-symbols-rounded" style={{ fontSize: 48, marginBottom: 15 }}>check_circle</span>
                                                <p>All claims have been settled.</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                {premiumRequests.map(r => (
                                                    <div key={r.id} className="admin-card-pro" style={{ padding: '16px', borderLeft: `4px solid ${r.status === 'pending' ? 'var(--primary)' : r.status === 'approved' ? '#22c55e' : 'var(--danger)'}`, background: 'rgba(255,255,255,0.01)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                            <div>
                                                                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{r.user_name}</div>
                                                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{r.user_email} • {r.user_branch}</div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: '1.1rem' }}>₹{r.amount}</div>
                                                                <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>ID: {r.transaction_id}</div>
                                                            </div>
                                                        </div>
                                                        
                                                        {r.screenshot_url && (
                                                            <div className="glass-card" style={{ marginBottom: 15, padding: 0, overflow: 'hidden', height: '120px' }}>
                                                                <img src={r.screenshot_url} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                                                                    onClick={() => window.open(r.screenshot_url, '_blank')} alt="Proof" />
                                                            </div>
                                                        )}

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ fontSize: '0.75rem', color: r.status === 'approved' ? '#22c55e' : r.status === 'rejected' ? '#ef4444' : '#f59e0b', fontWeight: 800, letterSpacing: 1 }}>
                                                                {r.status.toUpperCase()}
                                                            </span>
                                                            {r.status === 'pending' && (
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button className="btn-secondary" onClick={() => handlePremiumAction(r.id, 'reject')} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Deny</button>
                                                                    <button className="btn-primary holographic" onClick={() => handlePremiumAction(r.id, 'approve')} style={{ padding: '6px 16px', fontSize: '0.75rem', background: '#22c55e' }}>Verify & Grant</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="admin-settings-view view-animate" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <div className="admin-table-container">
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <div className="admin-card-icon" style={{ margin: '0 auto 20px', width: '64px', height: '64px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '32px' }}>terminal</span>
                                    </div>
                                    <h2 className="font-serif">Core Parameters</h2>
                                    <p style={{ opacity: 0.6 }}>Rotate the Master Encryption Key to secure the Command Center.</p>
                                </div>
                                <form onSubmit={handleChangeKey} style={{ padding: '0 40px 40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 700 }}>CURRENT MASTER SIGNATURE</label>
                                        <input className="input-field" type="password" value={currentKey} onChange={e => setCurrentKey(e.target.value)} required
                                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', textAlign: 'center', letterSpacing: '0.5em' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 700 }}>NEW SYSTEM KEY</label>
                                        <input className="input-field" type="password" value={newKey} onChange={e => setNewKey(e.target.value)} required minLength={8}
                                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', textAlign: 'center', letterSpacing: '0.5em' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 700 }}>VERIFY NEW KEY</label>
                                        <input className="input-field" type="password" value={confirmKey} onChange={e => setConfirmKey(e.target.value)} required
                                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', textAlign: 'center', letterSpacing: '0.5em' }} />
                                    </div>
                                    <button className="btn-primary holographic" type="submit" disabled={changingKey || newKey !== confirmKey} style={{ padding: '18px', background: '#ef4444' }}>
                                        {changingKey ? 'ROTATING PARAMETERS...' : 'AUTHORIZE KEY ROTATION'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
