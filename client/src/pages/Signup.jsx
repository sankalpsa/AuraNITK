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
                }}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2>Create Account</h2>
            </div>

            <div className="auth-body">
                {step === 'email' && (
                    <form onSubmit={handleSendOtp}>
                        <div className="auth-icon-large">
                            <span className="material-symbols-outlined fill-icon" style={{ fontSize: '3rem', color: 'var(--primary)' }}>mail</span>
                        </div>
                        <h3>Your NITK Email</h3>
                        <p className="auth-hint">We'll verify you're a real NITK student</p>
                        <div className="input-group">
                            <input className="input-field" type="email" placeholder="your.name@nitk.edu.in"
                                value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                        </div>
                        <button className="btn-primary" type="submit" disabled={loading}>
                            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Send OTP'}
                        </button>
                    </form>
                )}

                {step === 'otp' && (
                    <form onSubmit={handleVerifyOtp}>
                        <div className="auth-icon-large">
                            <span className="material-symbols-outlined fill-icon" style={{ fontSize: '3rem', color: 'var(--primary)' }}>pin</span>
                        </div>
                        <h3>Verify OTP</h3>
                        <p className="auth-hint">Enter the 6-digit code sent to {email}</p>
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
                        <button className="btn-primary" type="submit" disabled={loading}>
                            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Verify'}
                        </button>
                        <button type="button" className="btn-ghost" onClick={handleSendOtp} disabled={loading}>Resend OTP</button>
                    </form>
                )}

                {step === 'details' && (
                    <form onSubmit={handleSignup} className="signup-details-form">
                        <h3>About You</h3>
                        <div className="input-group"><label>Name *</label>
                            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div className="input-group"><label>Password *</label>
                            <input className="input-field" type="password" placeholder="Min 6 characters"
                                value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>
                        <div className="input-row">
                            <div className="input-group"><label>Age *</label>
                                <input className="input-field" type="number" min={17} max={30}
                                    value={age} onChange={(e) => setAge(e.target.value)} required />
                            </div>
                            <div className="input-group"><label>Gender *</label>
                                <select className="input-field" value={gender} onChange={(e) => setGender(e.target.value)} required>
                                    <option value="">Select</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div className="input-row">
                            <div className="input-group"><label>Branch *</label>
                                <select className="input-field" value={branch} onChange={(e) => setBranch(e.target.value)} required>
                                    <option value="">Select</option>
                                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div className="input-group"><label>Year *</label>
                                <select className="input-field" value={year} onChange={(e) => setYear(e.target.value)} required>
                                    <option value="">Select</option>
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="input-group"><label>Bio</label>
                            <textarea className="textarea-field" placeholder="Tell us about yourself..."
                                value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} />
                        </div>
                        <div className="input-group"><label>Interests (pick up to 8)</label>
                            <div className="interest-tags">
                                {INTEREST_OPTIONS.map(i => (
                                    <button key={i} type="button"
                                        className={`interest-tag ${interests.includes(i) ? 'selected' : ''}`}
                                        onClick={() => toggleInterest(i)}>{i}</button>
                                ))}
                            </div>
                        </div>
                        <button className="btn-primary" type="submit" disabled={loading}>
                            {loading ? <div className="spinner" style={{ width: 18, height: 18 }} /> : 'Create Account 🚀'}
                        </button>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Already have an account? </span>
                    <button className="link-btn" onClick={() => navigate('/login')}>Log In</button>
                </div>
            </div>
        </div>
    );
}
