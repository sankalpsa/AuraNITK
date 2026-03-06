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
        if (!email.endsWith('@nitk.edu.in')) {
            return showToast('Use your @nitk.edu.in email', 'error');
        }
        if (!password) return showToast('Enter your password', 'error');

        setLoading(true);
        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: email.toLowerCase(), password }),
            });
            login(data.token, data.user);
            showToast(`Welcome back, ${data.user.name}! 💕`, 'success');
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
                <button className="btn-icon" onClick={() => navigate('/')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2>Log In</h2>
            </div>

            <div className="auth-body">
                <form onSubmit={handleLogin}>
                    <div className="auth-icon-large">
                        <span className="material-symbols-outlined fill-icon" style={{ fontSize: '3rem', color: 'var(--primary)' }}>
                            favorite
                        </span>
                    </div>
                    <h3>Welcome Back</h3>
                    <p className="auth-hint">Sign in to your Aura account</p>

                    <div className="input-group">
                        <label>Email</label>
                        <input
                            className="input-field"
                            type="email"
                            placeholder="your.name@nitk.edu.in"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="input-group">
                        <label>Password</label>
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
                                    border: 'none', cursor: 'pointer', padding: 0
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: 20 }}>
                                    {showPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <button className="btn-primary" type="submit" disabled={loading}>
                        {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Log In'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Don't have an account? </span>
                    <button className="link-btn" onClick={() => navigate('/signup')}>Sign Up</button>
                </div>
            </div>
        </div>
    );
}
