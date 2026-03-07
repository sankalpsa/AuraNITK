import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

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
                            <label>Pass-key</label>
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
                    </form>
                </div>

                <div style={{ textAlign: 'center', marginTop: 20 }}>
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
