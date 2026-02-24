import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { showToast } = useToast();

    const [step, setStep] = useState('email'); // email | otp | password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const otpRefs = useRef([]);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!email.endsWith('@nitk.edu.in')) {
            return showToast('Use your @nitk.edu.in email', 'error');
        }
        setLoading(true);
        try {
            await apiFetch('/api/auth/send-otp', {
                method: 'POST',
                body: JSON.stringify({ email: email.toLowerCase() }),
            });
            showToast('OTP sent to your email! 📧', 'success');
            setStep('otp');
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    };

    const handleOtpInput = (idx, val) => {
        if (val.length > 1) val = val.slice(-1);
        const newOtp = [...otp];
        newOtp[idx] = val;
        setOtp(newOtp);
        if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    };

    const handleOtpKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
            otpRefs.current[idx - 1]?.focus();
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) return showToast('Enter the 6-digit code', 'error');
        setLoading(true);
        try {
            await apiFetch('/api/auth/verify-otp', {
                method: 'POST',
                body: JSON.stringify({ email: email.toLowerCase(), otp: code }),
            });
            showToast('Email verified! ✅ Enter your password.', 'success');
            setStep('password');
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!password) return showToast('Enter your password', 'error');
        setLoading(true);
        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: email.toLowerCase(), password }),
            });
            login(data.token, data.user);
            showToast(`Welcome back, ${data.user.name}! 💕`, 'success');
            navigate('/discover', { replace: true });
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    };

    return (
        <div className="auth-page view-animate">
            <div className="auth-header">
                <button className="btn-icon" onClick={() => {
                    if (step === 'password') setStep('otp');
                    else if (step === 'otp') setStep('email');
                    else navigate('/');
                }}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2>Log In</h2>
            </div>

            <div className="auth-body">
                {step === 'email' && (
                    <form onSubmit={handleSendOtp}>
                        <div className="auth-icon-large">
                            <span className="material-symbols-outlined fill-icon" style={{ fontSize: '3rem', color: 'var(--primary)' }}>
                                mail
                            </span>
                        </div>
                        <h3>Your NITK Email</h3>
                        <p className="auth-hint">We'll send a verification code to your email</p>
                        <div className="input-group">
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
                        <button className="btn-primary" type="submit" disabled={loading}>
                            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Send OTP'}
                        </button>
                    </form>
                )}

                {step === 'otp' && (
                    <form onSubmit={handleVerifyOtp}>
                        <div className="auth-icon-large">
                            <span className="material-symbols-outlined fill-icon" style={{ fontSize: '3rem', color: 'var(--primary)' }}>
                                pin
                            </span>
                        </div>
                        <h3>Verify OTP</h3>
                        <p className="auth-hint">Enter the 6-digit code sent to {email}</p>
                        <div className="otp-inputs">
                            {otp.map((digit, idx) => (
                                <input
                                    key={idx}
                                    ref={el => otpRefs.current[idx] = el}
                                    className="otp-input"
                                    type="tel"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleOtpInput(idx, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                    autoFocus={idx === 0}
                                />
                            ))}
                        </div>
                        <button className="btn-primary" type="submit" disabled={loading}>
                            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Verify'}
                        </button>
                        <button type="button" className="btn-ghost" onClick={handleSendOtp} disabled={loading}>
                            Resend OTP
                        </button>
                    </form>
                )}

                {step === 'password' && (
                    <form onSubmit={handleLogin}>
                        <div className="auth-icon-large">
                            <span className="material-symbols-outlined fill-icon" style={{ fontSize: '3rem', color: 'var(--primary)' }}>
                                lock
                            </span>
                        </div>
                        <h3>Enter Password</h3>
                        <p className="auth-hint">Welcome back to NITKnot</p>
                        <div className="input-group">
                            <input
                                className="input-field"
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <button className="btn-primary" type="submit" disabled={loading}>
                            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Log In'}
                        </button>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Don't have an account? </span>
                    <button className="link-btn" onClick={() => navigate('/signup')}>Sign Up</button>
                </div>
            </div>
        </div>
    );
}
