import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleRequest = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            return showToast('Please enter your email', 'error');
        }

        setLoading(true);
        try {
            const data = await apiFetch('/api/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email: email.toLowerCase() }),
            });
            showToast(data.message, 'success');
            setSent(true);
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    };

    return (
        <div className="auth-page view-animate">
            <div className="auth-header">
                <button
                    className="btn-icon"
                    onClick={() => navigate('/login')}
                    style={{ background: 'var(--bg-elevated)', borderRadius: '50%', color: 'var(--text)' }}
                >
                    <span className="material-symbols-rounded">arrow_back</span>
                </button>
                <h2 className="font-serif">Access Protocol</h2>
            </div>

            <div className="auth-body">
                <div className="auth-card holographic" style={{ padding: '32px' }}>
                    {!sent ? (
                        <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="auth-icon-large" style={{ margin: '0 auto 16px', background: 'var(--primary-soft)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '3.5rem', color: 'var(--primary)' }}>
                                    lock_reset
                                </span>
                            </div>
                            <h3 className="font-serif" style={{ textAlign: 'center', marginBottom: '8px', fontSize: '1.5rem' }}>Forgot Password?</h3>
                            <p className="auth-hint" style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--text-muted)' }}>
                                Enter your registered university email to receive a secure reset link.
                            </p>

                            <div className="input-group">
                                <label>University Identity</label>
                                <input
                                    className="input-field"
                                    type="email"
                                    placeholder="your.email@university.edu"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '16px' }}>
                                {loading ? <div className="spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} /> : 'Send Reset Link'}
                            </button>
                        </form>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div className="auth-icon-large" style={{ margin: '0 auto 24px', background: 'rgba(16, 185, 129, 0.15)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '3.5rem', color: '#10B981' }}>
                                    mark_email_read
                                </span>
                            </div>
                            <h3 className="font-serif" style={{ marginBottom: '16px', fontSize: '1.5rem' }}>Protocol Dispatched</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '32px' }}>
                                We've sent a secure reset protocol to <strong>{email}</strong>. Check your inbox (and spam folder) to set a new pass-key.
                            </p>
                            <button className="btn-ghost" onClick={() => navigate('/login')} style={{ width: '100%', border: '1px solid var(--border)' }}>
                                Return to Login
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
