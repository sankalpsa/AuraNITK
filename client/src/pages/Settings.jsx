import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, getToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
    const navigate = useNavigate();
    const { user, logout, isAuthenticated, updateUser } = useAuth();
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

    // CRITICAL: Block Chrome/Edge autofill from ruining the settings dashboard
    // If the search query looks like an email and the component just mounted, clear it.
    useEffect(() => {
        if (searchQuery && (searchQuery.includes('@') || searchQuery === user?.email)) {
            setSearchQuery('');
        }
    }, [searchQuery, user?.email]);

    // Premium Features state
    const [incognito, setIncognito] = useState(false);
    const [readReceipts, setReadReceipts] = useState(true);

    // Premium subscription state
    const [premiumStatus, setPremiumStatus] = useState({ is_premium: 0, premium_until: null });
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [myRequests, setMyRequests] = useState([]);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentTxnId, setPaymentTxnId] = useState('');
    const [paymentScreenshot, setPaymentScreenshot] = useState(null);
    const [submittingPayment, setSubmittingPayment] = useState(false);
    const [premiumLoading, setPremiumLoading] = useState(true);

    // Search filter helper — returns true if the section should be visible
    const q = searchQuery.toLowerCase().trim();
    const show = useMemo(() => ({
        account: !q || ['account', 'edit', 'profile', 'password', 'view', 'change'].some(k => k.includes(q) || q.includes(k)),
        privacy: !q || ['privacy', 'safety', 'block', 'premium', 'incognito', 'read', 'receipt', 'dark', 'mode', 'theme', 'pay', 'subscribe'].some(k => k.includes(q) || q.includes(k)),
        howTo: !q || ['how', 'use', 'swipe', 'like', 'match', 'tap', 'timer', 'help'].some(k => k.includes(q) || q.includes(k)),
        about: !q || ['about', 'version', 'info', 'spark', 'credit'].some(k => k.includes(q) || q.includes(k)),
        logins: !q || ['login', 'logout', 'log', 'admin', 'sign'].some(k => k.includes(q) || q.includes(k)),
        danger: !q || ['danger', 'deactivate', 'delete', 'account', 'remove'].some(k => k.includes(q) || q.includes(k)),
    }), [q]);

    useEffect(() => {
        if (!isAuthenticated) navigate('/', { replace: true });
        if (user) {
            setIncognito(user.is_incognito === 1);
            setReadReceipts(user.read_receipts !== 0);
        }
        loadReports();
        loadPremiumData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user]);

    async function loadReports() {
        try {
            const data = await apiFetch('/api/reports/me');
            setReports(data.reports || []);
        } catch { /* endpoint may not exist yet */ }
    }

    async function loadPremiumData() {
        setPremiumLoading(true);
        try {
            const [status, methods, requests] = await Promise.all([
                apiFetch('/api/premium/status').catch(e => ({ is_premium: 0, error: e.message })),
                apiFetch('/api/premium/methods').catch(e => ({ methods: [], error: e.message })),
                apiFetch('/api/premium/requests').catch(e => ({ requests: [], error: e.message })),
            ]);
            
            if (status.is_premium !== undefined) setPremiumStatus(status);
            if (methods.methods) setPaymentMethods(methods.methods);
            if (requests.requests) setMyRequests(requests.requests);

            // Log errors if any endpoint failed (excluding 404s which we handle silently)
            [status, methods, requests].forEach(r => {
                if (r.error && !r.error.includes('404')) {
                    console.error('Premium Data Error:', r.error);
                }
            });
        } catch (e) {
            console.error('loadPremiumData failed', e);
        } finally {
            setPremiumLoading(false);
        }
    }

    const handleSubmitPayment = async () => {
        if (!paymentTxnId) return showToast('Transaction ID is required', 'error');
        setSubmittingPayment(true);
        try {
            const formData = new FormData();
            formData.append('transaction_id', paymentTxnId);
            if (paymentScreenshot) formData.append('screenshot', paymentScreenshot);
            formData.append('amount', '49');
            if (paymentMethods.length > 0) formData.append('payment_method_id', paymentMethods[0].id);

            const token = getToken();
            const resp = await fetch('/api/premium/subscribe', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const result = await resp.json();
            if (!resp.ok) throw new Error(result.error);
            showToast('Payment submitted! Admin will review within 24h 🎉', 'success');
            setShowPaymentForm(false);
            setPaymentTxnId('');
            setPaymentScreenshot(null);
            loadPremiumData();
        } catch (e) {
            showToast(e.message, 'error');
        }
        setSubmittingPayment(false);
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
            {/* Instagram-style header */}
            <div className="settings-header">
                <button className="btn-icon" onClick={() => navigate('/profile')}>
                    <span className="material-symbols-rounded">arrow_back</span>
                </button>
                <h2>SPARK Configuration</h2>
            </div>

            <div className="settings-body">
                {/* Functional search bar */}
                <div className="settings-search-bar">
                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--text-muted)' }}>search</span>
                    <input
                        type="text"
                        placeholder="Search settings..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="settings-search-input"
                        autoComplete="off"
                        spellCheck="false"
                        name="settings_search_field"
                    />
                    {searchQuery && (
                        <button className="btn-icon" onClick={() => setSearchQuery('')} style={{ padding: 2 }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--text-muted)' }}>close</span>
                        </button>
                    )}
                </div>

                {/* Your Account — Instagram style */}
                {show.account && <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>account_circle</span>
                        <div>
                            <h3>Soul Identity</h3>
                            <p className="settings-section-desc">Profile, password, activity and more</p>
                        </div>
                    </div>

                    <div className="settings-item" onClick={() => navigate('/profile/edit')}>
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded">person</span>
                            <div>
                                <span className="settings-item-title">Edit Profile</span>
                                <span className="settings-item-sub">Name, bio, interests, photos</span>
                            </div>
                        </div>
                        <span className="material-symbols-rounded settings-chevron">chevron_right</span>
                    </div>

                    <div className="settings-item" onClick={() => navigate('/profile')}>
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded">badge</span>
                            <div>
                                <span className="settings-item-title">View My Profile</span>
                                <span className="settings-item-sub">See how others see you</span>
                            </div>
                        </div>
                        <span className="material-symbols-rounded settings-chevron">chevron_right</span>
                    </div>

                    <div className="settings-item" onClick={() => setShowChangePass(!showChangePass)}>
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded">lock</span>
                            <div>
                                <span className="settings-item-title">Change Password</span>
                                <span className="settings-item-sub">Update your login credentials</span>
                            </div>
                        </div>
                        <span className="material-symbols-rounded settings-chevron">{showChangePass ? 'expand_less' : 'chevron_right'}</span>
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
                        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>shield</span>
                        <div>
                            <h3>Privacy & safety</h3>
                            <p className="settings-section-desc">Manage your campus safety</p>
                        </div>
                    </div>

                    <div className="settings-item" onClick={() => setShowSafety(!showSafety)}>
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded">verified_user</span>
                            <div>
                                <span className="settings-item-title">Safety Guidelines</span>
                                <span className="settings-item-sub">Tips for staying safe on campus</span>
                            </div>
                        </div>
                        <span className="material-symbols-rounded settings-chevron">{showSafety ? 'expand_less' : 'chevron_right'}</span>
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
                            <span className="material-symbols-rounded">block</span>
                            <div>
                                <span className="settings-item-title">Blocked Profiles</span>
                                <span className="settings-item-sub">Manage profiles you've blocked</span>
                            </div>
                        </div>
                        <span className="material-symbols-rounded settings-chevron">chevron_right</span>
                    </div>

                    {/* SPARK Premium Section */}
                    <div className="settings-section-header" style={{ marginTop: 20 }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 20, color: '#f59e0b' }}>workspace_premium</span>
                        <div>
                            <h3 style={{ color: '#f59e0b' }}>Premium controls</h3>
                            <p className="settings-section-desc">{premiumStatus.is_premium ? 'Your premium features' : 'Upgrade to unlock exclusive features'}</p>
                        </div>
                    </div>

                    {premiumLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                            <div className="spinner" />
                        </div>
                    ) : premiumStatus.is_premium ? (
                        <>
                            {/* Premium Active Badge */}
                            <div className="premium-active-badge">
                                <span className="material-symbols-rounded" style={{ fontSize: 22, color: '#f59e0b' }}>diamond</span>
                                <div>
                                    <strong style={{ color: '#f59e0b' }}>Premium Active ✨</strong>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                                        Expires: {premiumStatus.premium_until ? new Date(premiumStatus.premium_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}
                                    </p>
                                </div>
                            </div>

                            {/* Incognito Toggle */}
                            <div className="settings-item" style={{ cursor: 'default' }}>
                                <div className="settings-item-left">
                                    <span className="material-symbols-rounded" style={{ color: '#a78bfa' }}>visibility_off</span>
                                    <div>
                                        <span className="settings-item-title">Ghost Embers</span>
                                        <span className="settings-item-sub">Your flame only glows for those you choose.</span>
                                    </div>
                                </div>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={incognito} onChange={async (e) => {
                                        const newVal = e.target.checked;
                                        setIncognito(newVal);
                                        try {
                                            const resp = await apiFetch('/api/account/incognito', {
                                                method: 'PUT',
                                                body: JSON.stringify({ is_incognito: newVal })
                                            });
                                            if (user) updateUser({ ...user, is_incognito: resp.is_incognito, is_snoozed: resp.is_incognito });
                                            showToast(newVal ? 'Embers Cloaked 🕵️‍♀️' : 'Flame Visible', 'success');
                                        } catch (err) {
                                            setIncognito(!newVal);
                                            showToast(err.message || 'Failed to toggle Ghost Mode', 'error');
                                        }
                                    }} />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            {/* Read Receipts Toggle */}
                            <div className="settings-item" style={{ cursor: 'default' }}>
                                <div className="settings-item-left">
                                    <span className="material-symbols-rounded" style={{ color: '#3b82f6' }}>done_all</span>
                                    <div>
                                        <span className="settings-item-title">Ignition Confirmation</span>
                                        <span className="settings-item-sub">Show others when their whispers have been seen.</span>
                                    </div>
                                </div>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={readReceipts} onChange={async (e) => {
                                        const newVal = e.target.checked;
                                        setReadReceipts(newVal);
                                        try {
                                            const resp = await apiFetch('/api/account/read-receipts', {
                                                method: 'PUT',
                                                body: JSON.stringify({ enabled: newVal })
                                            });
                                            if (user) updateUser({ ...user, read_receipts: resp.read_receipts });
                                            showToast(newVal ? 'Ignition Confirmation ON' : 'Ignition Confirmation OFF', 'info');
                                        } catch (err) {
                                            setReadReceipts(!newVal);
                                            showToast(err.message || 'Failed to update Read Receipts', 'error');
                                        }
                                    }} />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Get Premium Card */}
                            <div className="premium-subscribe-card">
                                <div className="premium-features-list">
                                    <h4 style={{ margin: '0 0 10px', color: '#f59e0b' }}>💎 Unlock Premium for ₹49/month</h4>
                                    <div className="premium-feature-item">
                                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#a78bfa' }}>visibility_off</span>
                                        <span>Incognito Mode — Only visible to people you like</span>
                                    </div>
                                    <div className="premium-feature-item">
                                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#3b82f6' }}>done_all</span>
                                        <span>Read Receipt Control — Hide your read status</span>
                                    </div>
                                    <div className="premium-feature-item">
                                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: '#10b981' }}>trending_up</span>
                                        <span>Priority Profile — Get seen first in Discover</span>
                                    </div>
                                </div>

                                {/* Payment Methods */}
                                {paymentMethods.length > 0 ? (
                                    <div className="premium-payment-section">
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                            Scan the QR code below to pay, then submit your payment details:
                                        </p>
                                        {paymentMethods.map(m => (
                                            <div key={m.id} className="premium-qr-card">
                                                {m.qr_image_url && (
                                                    <img src={m.qr_image_url} alt="Payment QR" className="premium-qr-img" onClick={() => window.open(m.qr_image_url, '_blank')} />
                                                )}
                                                <strong>{m.label}</strong>
                                                {m.upi_id && <span className="premium-upi-id">{m.upi_id}</span>}
                                            </div>
                                        ))}

                                        {/* Payment Form */}
                                        {!showPaymentForm ? (
                                            <button className="btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => setShowPaymentForm(true)}>
                                                I've Paid — Submit Details
                                            </button>
                                        ) : (
                                            <div className="premium-payment-form">
                                                <input className="input-field" type="text" placeholder="Transaction/UTR ID"
                                                    value={paymentTxnId} onChange={e => setPaymentTxnId(e.target.value)} />
                                                <input className="input-field" type="file" accept="image/*" style={{ marginTop: 8 }}
                                                    onChange={e => setPaymentScreenshot(e.target.files[0])} />
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0' }}>Upload a screenshot of your payment confirmation</p>
                                                <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={submittingPayment || !paymentTxnId}
                                                    onClick={handleSubmitPayment}>
                                                    {submittingPayment ? 'Submitting...' : '🚀 Submit Payment'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                                        Payment setup coming soon. Contact admin for early access!
                                    </p>
                                )}

                                {/* Existing requests */}
                                {myRequests.length > 0 && (
                                    <div style={{ marginTop: 14 }}>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Your Requests:</p>
                                        {myRequests.map(r => (
                                            <div key={r.id} className="premium-my-request">
                                                <span className={`status-pill ${r.status === 'approved' ? 'verified' : r.status === 'rejected' ? 'rejected' : 'pending'}`}>{r.status}</span>
                                                <span style={{ fontSize: '0.8rem' }}>₹{r.amount} • {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                                {r.admin_note && r.status !== 'pending' && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>— {r.admin_note}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Dark Mode Toggle (free for all) */}
                    <div className="settings-item" style={{ cursor: 'default' }}>
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>
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
                            <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--danger)' }}>warning</span>
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
                                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--danger)' }}>flag</span>
                                    <strong>{r.reason}</strong>
                                </div>
                                {r.details && <p className="report-details">{r.details}</p>}
                                <span className="report-date">{new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* How to use SPARK */}
                {show.howTo && <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>help</span>
                        <div>
                            <h3>The Art of the SPARK</h3>
                            <p className="settings-section-desc">Get the most out of the app</p>
                        </div>
                    </div>

                    <div className="settings-item">
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded">swipe</span>
                            <div>
                                <span className="settings-item-title">Swipe right to ignite</span>
                                <span className="settings-item-sub">Left to fade, right to spark someone</span>
                            </div>
                        </div>
                    </div>
                    <div className="settings-item">
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded">favorite</span>
                            <div>
                                <span className="settings-item-title">Mutual Sparks = Fusion!</span>
                                <span className="settings-item-sub">When two souls spark, a fusion is born.</span>
                            </div>
                        </div>
                    </div>
                    <div className="settings-item">
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded">touch_app</span>
                            <div>
                                <span className="settings-item-title">Double-tap to resonate</span>
                                <span className="settings-item-sub">Double-tap whispers to send a ❤️</span>
                            </div>
                        </div>
                    </div>
                    <div className="settings-item">
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded">timer</span>
                            <div>
                                <span className="settings-item-title">48h Fusion Decay</span>
                                <span className="settings-item-sub">Ignite the conversation within 48h or the flame will fade.</span>
                            </div>
                        </div>
                    </div>
                </div>}

                {/* About SPARK */}
                {show.about && <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>info</span>
                        <div>
                            <h3>About</h3>
                            <p className="settings-section-desc">App info and credits</p>
                        </div>
                    </div>
                    <div className="about-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={{ background: 'linear-gradient(135deg,#0a0118,#1a0535)', width: '100%', aspectRatio: '1/1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                            {/* Ambient glow rings */}
                            <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.3) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                            <div style={{ position: 'absolute', width: '140px', height: '140px', borderRadius: '50%', border: '1px solid rgba(139,92,246,0.3)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                            <div style={{ position: 'absolute', width: '180px', height: '180px', borderRadius: '50%', border: '1px solid rgba(236,72,153,0.2)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                            {/* S mark */}
                            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
                                <div style={{ fontSize: '5rem', fontWeight: 900, background: 'linear-gradient(135deg,#ec4899,#8b5cf6,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1, fontFamily: 'Georgia, serif', letterSpacing: '-4px' }}>S</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, background: 'linear-gradient(90deg,#ec4899,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.5em', marginLeft: '0.5em', fontFamily: 'Arial, sans-serif' }}>SPARK</div>
                                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em', marginTop: '6px' }}>CAMPUS CONNECTIONS</div>
                            </div>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <p className="font-serif" style={{ color: 'var(--text-main)', fontSize: '1.05rem', margin: '0 0 8px' }}>
                                The premier dating network for university students.
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
                                Version 2.0 • Made with ❤️ for Students
                            </p>
                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <span className="about-badge" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem' }}>🎓 Campus Only</span>
                                <span className="about-badge" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem' }}>🔒 Secure</span>
                                <span className="about-badge" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem' }}>✨ Free Forever</span>
                            </div>
                        </div>
                    </div>

                    <div className="settings-item flex items-center justify-between p-4 cursor-pointer hover:bg-elevated transition-colors border-t border-spark-border" onClick={() => navigate('/feedback')}>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-rounded text-spark">chat_bubble</span>
                            <div>
                                <h4 className="font-medium">Pulse Feedback</h4>
                                <p className="text-xs text-muted">Suggest improvements or report issues</p>
                            </div>
                        </div>
                        <span className="material-symbols-rounded text-muted">chevron_right</span>
                    </div>
                </div>}

                {/* Login section — Instagram-style "Log in" section */}
                {show.logins && <div className="settings-section">
                    <div className="settings-section-header">
                        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>login</span>
                        <div>
                            <h3>Logins</h3>
                            <p className="settings-section-desc">Signed in as {user?.email || 'your account'}</p>
                        </div>
                    </div>

                    {user && user.is_admin === 1 && (
                        <div className="settings-item admin-link" onClick={() => navigate('/admin')} style={{ borderTop: '1px solid var(--border)', marginTop: 10 }}>
                            <div className="settings-item-left">
                                <span className="material-symbols-rounded" style={{ color: 'var(--primary)' }}>shield_person</span>
                                <div>
                                    <span className="settings-item-title" style={{ color: 'var(--primary)', fontWeight: 700 }}>Admin Command Center</span>
                                    <span className="settings-item-sub">Manage reports and verifications</span>
                                </div>
                            </div>
                            <span className="material-symbols-rounded settings-chevron" style={{ color: 'var(--primary)' }}>chevron_right</span>
                        </div>
                    )}

                    <button className="settings-logout-btn" onClick={handleLogout}>
                        <span className="material-symbols-rounded">logout</span>
                        Log out
                    </button>
                </div>}

                {/* Danger Zone */}
                {show.danger && <div className="settings-section danger-zone">
                    <div className="settings-section-header">
                        <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--danger)' }}>dangerous</span>
                        <div>
                            <h3 style={{ color: 'var(--danger)' }}>Danger zone</h3>
                            <p className="settings-section-desc">These actions are irreversible</p>
                        </div>
                    </div>
                    <div className="settings-item" onClick={deactivateAccount}>
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded" style={{ color: 'var(--warning, #f59e0b)' }}>pause_circle</span>
                            <div>
                                <span className="settings-item-title">Deactivate Account</span>
                                <span className="settings-item-sub">Temporarily hide — reactivate by logging in again</span>
                            </div>
                        </div>
                        <span className="material-symbols-rounded settings-chevron">chevron_right</span>
                    </div>
                    <div className="settings-item" onClick={deleteAccount}>
                        <div className="settings-item-left">
                            <span className="material-symbols-rounded" style={{ color: 'var(--danger)' }}>delete_forever</span>
                            <div>
                                <span className="settings-item-title" style={{ color: 'var(--danger)' }}>Delete Account</span>
                                <span className="settings-item-sub">Permanently remove all your data</span>
                            </div>
                        </div>
                        <span className="material-symbols-rounded settings-chevron" style={{ color: 'var(--danger)' }}>chevron_right</span>
                    </div>
                </div>}
            </div>
        </div>
    );
}
