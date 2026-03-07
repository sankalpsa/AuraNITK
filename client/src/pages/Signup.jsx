import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { INTEREST_OPTIONS, BRANCHES, YEARS } from '../constants';
import { extractNameFromEmail } from '../utils/helpers';

export default function Signup() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { showToast } = useToast();

    const [step, setStep] = useState('email'); // email | otp | details
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const otpRefs = useRef([]);

    // Profile details
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('');
    const [branch, setBranch] = useState('');
    const [year, setYear] = useState('');
    const [bio, setBio] = useState('');
    const [interests, setInterests] = useState([]);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            return showToast('Please enter your email', 'error');
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
            showToast('Email verified! ✅ Create your profile.', 'success');
            setName(extractNameFromEmail(email));
            setStep('details');
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    };

    const toggleInterest = (interest) => {
        if (interests.includes(interest)) {
            setInterests(interests.filter(i => i !== interest));
        } else if (interests.length < 8) {
            setInterests([...interests, interest]);
        } else {
            showToast('Max 8 interests', 'error');
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (!name || !password || !age || !gender || !branch || !year) {
            return showToast('Fill all required fields', 'error');
        }
        if (password.length < 6) return showToast('Password must be 6+ chars', 'error');
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 17 || ageNum > 30) {
            return showToast('Age must be 17-30', 'error');
        }

        setLoading(true);
        try {
            const data = await apiFetch('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email: email.toLowerCase(),
                    password,
                    name,
                    age: ageNum,
                    gender,
                    branch,
                    year,
                    bio,
                    interests,
                }),
            });
            login(data.token, data.user);
            showToast(`Welcome to Aura, ${data.user.name}! ✨`, 'success');
            // Deliberately NOT calling navigate('/discover') here.
            // The <PublicRoute> wrapper automatically handles redirection when auth state changes.
        } catch (e) {
            showToast(e.message, 'error');
        }
        setLoading(false);
    };

    return (
        <div className="auth-page view-animate">
            <div className="auth-header">
                <button className="btn-icon" onClick={() => {
                    if (step === 'details') setStep('otp');
                    else if (step === 'otp') setStep('email');
                    else navigate('/');
                }} style={{ background: 'var(--bg-elevated)', borderRadius: '50%', color: 'var(--text)' }}>
                    <span className="material-symbols-rounded">arrow_back</span>
                </button>
                <h2 className="font-serif">Create Account</h2>
            </div>

            <div className="auth-body">
                {step === 'email' && (
                    <div className="auth-card holographic">
                        <form onSubmit={handleSendOtp}>
                            <div className="auth-icon-large">
                                <span className="material-symbols-rounded" style={{ fontSize: '3rem' }}>alternate_email</span>
                            </div>
                            <h3 style={{ textAlign: 'center', marginBottom: '8px' }}>Your Student Portal</h3>
                            <p className="auth-hint" style={{ textAlign: 'center', marginBottom: '32px', color: 'var(--text-muted)' }}>
                                Verification required for university exclusivity.
                            </p>
                            <div className="input-group">
                                <label>University Email</label>
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
                            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '24px' }}>
                                {loading ? <div className="spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} /> : (
                                    <>
                                        <span>Initialize Verification</span>
                                        <span className="material-symbols-rounded">send</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="auth-card holographic">
                        <form onSubmit={handleVerifyOtp}>
                            <div className="auth-icon-large">
                                <span className="material-symbols-rounded" style={{ fontSize: '3rem' }}>lock_open</span>
                            </div>
                            <h3 style={{ textAlign: 'center', marginBottom: '8px' }}>Verify Identity</h3>
                            <p className="auth-hint" style={{ textAlign: 'center', marginBottom: '32px', color: 'var(--text-muted)' }}>
                                Enter the cosmic key sent to<br /><strong>{email}</strong>
                            </p>
                            <div className="otp-inputs">
                                {otp.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={el => otpRefs.current[idx] = el}
                                        className="otp-input" type="tel" maxLength={1} value={digit}
                                        onChange={(e) => handleOtpInput(idx, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                        autoFocus={idx === 0}
                                    />
                                ))}
                            </div>
                            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginBottom: '16px' }}>
                                {loading ? <div className="spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} /> : (
                                    <>
                                        <span>Unlock Aura</span>
                                        <span className="material-symbols-rounded">key_visualize</span>
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={handleSendOtp}
                                disabled={loading}
                                style={{ width: '100%', border: 'none', background: 'transparent' }}
                            >
                                Reissue code
                            </button>
                        </form>
                    </div>
                )}

                {step === 'details' && (
                    <div className="auth-card holographic" style={{ padding: '24px' }}>
                        <form onSubmit={handleSignup} className="signup-details-form">
                            <h3 style={{ marginBottom: '24px' }}>Profile Manifest</h3>

                            <div className="input-group">
                                <label>What should we call you? *</label>
                                <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
                            </div>

                            <div className="input-group">
                                <label>Secret Password *</label>
                                <input className="input-field" type="password" placeholder="Min 6 characters"
                                    value={password} onChange={(e) => setPassword(e.target.value)} required />
                            </div>

                            <div className="input-row" style={{ display: 'flex', gap: '12px' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label>Age *</label>
                                    <input className="input-field" type="number" min={17} max={30}
                                        value={age} onChange={(e) => setAge(e.target.value)} required />
                                </div>
                                <div className="input-group" style={{ flex: 2 }}>
                                    <label>Gender *</label>
                                    <select className="input-field" value={gender} onChange={(e) => setGender(e.target.value)} required>
                                        <option value="">Select...</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Non-binary">Non-binary</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Academic Sphere *</label>
                                <select className="input-field" value={branch} onChange={(e) => setBranch(e.target.value)} required>
                                    <option value="">Select Branch...</option>
                                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Journey Stage *</label>
                                <select className="input-field" value={year} onChange={(e) => setYear(e.target.value)} required>
                                    <option value="">Select Year...</option>
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Bio / Your Aura (Optional)</label>
                                <textarea className="textarea-field" rows={3} placeholder="Tell us your frequency..."
                                    value={bio} onChange={(e) => setBio(e.target.value)} />
                            </div>

                            <div className="interests-section" style={{ marginTop: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Celestial Interests ({interests.length}/8)
                                </label>
                                <div className="interests-pill-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {INTEREST_OPTIONS.map(interest => (
                                        <button
                                            key={interest}
                                            type="button"
                                            className={`interest-pill ${interests.includes(interest) ? 'active' : ''}`}
                                            onClick={() => toggleInterest(interest)}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: 'var(--radius-full)',
                                                border: '1px solid var(--border)',
                                                background: interests.includes(interest) ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                                                color: interests.includes(interest) ? 'white' : 'var(--text-secondary)',
                                                fontSize: '0.85rem',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            {interest}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '32px' }}>
                                {loading ? <div className="spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} /> : (
                                    <>
                                        <span>Manifest My Presence</span>
                                        <span className="material-symbols-rounded">check_circle</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Already have an account? </span>
                    <button className="link-btn" onClick={() => navigate('/login')}>Log In</button>
                </div>
            </div>
        </div>
    );
}
