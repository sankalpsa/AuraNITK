import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { showToast } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            return showToast('Please enter your email', 'error');
        }
        if (!password) return showToast('Enter your password', 'error');

        setLoading(true);
        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: email.toLowerCase(), password }),
            });
            login(data.token, data.user);
            showToast(`Welcome back, ${data.user.name}! ✨`, 'success');
            // Deliberately NOT calling navigate('/discover') here.
            // When login() updates the AuthContext, the <PublicRoute> wrapper
            // will automatically re-render and navigate the user to /discover.
            // Doing it programmatically at the same time causes a router race condition.
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
                    onClick={() => navigate('/')}
                    style={{ background: 'var(--bg-elevated)', borderRadius: '50%', color: 'var(--text)' }}
                >
                    <span className="material-symbols-rounded">arrow_back</span>
                </button>
                <h2 className="font-serif">Log In</h2>
            </div>

            <div className="auth-body">
                <div className="auth-card holographic">
                    <form onSubmit={handleLogin}>
                        <div className="auth-icon-large">
                            <span className="material-symbols-rounded" style={{ fontSize: '3.5rem' }}>
                                auto_awesome
                            </span>
                        </div>
                        <h3 style={{ textAlign: 'center', marginBottom: '8px' }}>Dimensional Re-entry</h3>
                        <p className="auth-hint" style={{ textAlign: 'center', marginBottom: '32px', color: 'var(--text-muted)' }}>
                            Sign in to your Aura account
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

                        <div className="input-group" style={{ marginTop: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ margin: 0 }}>Pass-key</label>
                                <button
                                    type="button"
                                    onClick={() => navigate('/forgot-password')}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary-light)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                                >
                                    Forgot Pass-key?
                                </button>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="input-field"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ paddingRight: 48 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: 12, top: '50%',
                                        transform: 'translateY(-50%)', background: 'none',
                                        border: 'none', cursor: 'pointer', padding: 0,
                                        display: 'flex', alignItems: 'center'
                                    }}
                                >
                                    <span className="material-symbols-rounded" style={{ color: 'var(--text-muted)', fontSize: 20 }}>
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '32px' }}>
                            {loading ? <div className="spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} /> : (
                                <>
                                    <span>Sync Aura</span>
                                    <span className="material-symbols-rounded">login</span>
                                </>
                            )}
                        </button>

                        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', width: '100%',
                                color: 'var(--text-muted)', fontSize: '0.85rem'
                            }}>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                                <span style={{ padding: '0 12px' }}>or</span>
                                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                            </div>

                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', borderRadius: '24px', overflow: 'hidden' }}>
                                <GoogleLogin
                                    onSuccess={async (credentialResponse) => {
                                        setLoading(true);
                                        try {
                                            const data = await apiFetch('/api/auth/google', {
                                                method: 'POST',
                                                body: JSON.stringify({ credential: credentialResponse.credential }),
                                            });
                                            login(data.token, data.user);
                                            showToast(`Welcome via Google, ${data.user.name}! ✨`, 'success');
                                        } catch (e) {
                                            showToast(e.message || 'Google login failed', 'error');
                                        }
                                        setLoading(false);
                                    }}
                                    onError={() => {
                                        showToast('Google login failed', 'error');
                                    }}
                                    theme="filled_black"
                                    size="large"
                                    text="signin_with"
                                    shape="circle"
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        First time in this dimension?{' '}
                        <button
                            onClick={() => navigate('/signup')}
                            style={{
                                background: 'none', border: 'none',
                                color: 'var(--primary-light)', cursor: 'pointer',
                                fontWeight: 600, padding: 0
                            }}
                        >
                            Create Account
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
