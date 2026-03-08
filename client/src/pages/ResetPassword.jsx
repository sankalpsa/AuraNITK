import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        if (password.length < 4) return showToast('Password must be at least 4 characters', 'error');
        if (password !== confirm) return showToast('Passwords do not match', 'error');

        setLoading(true);
        try {
            const data = await apiFetch('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, newPassword: password }),
            });
            showToast(data.message, 'success');
            setSuccess(true);
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
                <h2 className="font-serif">New Pass-key</h2>
            </div>

            <div className="auth-body">
                <div className="auth-card holographic" style={{ padding: '32px' }}>
                    {!success ? (
                        <form onSubmit={handleReset}>
                            <div className="auth-icon-large" style={{ margin: '0 auto 16px', background: 'var(--primary-soft)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '3.5rem', color: 'var(--primary)' }}>
                                    key
                                </span>
                            </div>
                            <h3 className="font-serif" style={{ textAlign: 'center', marginBottom: '8px', fontSize: '1.5rem' }}>Secure Protocol</h3>
                            <p className="auth-hint" style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--text-muted)' }}>
                                Establish a new access key for your Aura account.
                            </p>

                            <div className="input-group">
                                <label>New Pass-key</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="input-field"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Min 4 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoFocus
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

                            <div className="input-group" style={{ marginTop: '16px' }}>
                                <label>Confirm Pass-key</label>
                                <input
                                    className="input-field"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Confirm your choice"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    required
                                />
                            </div>

                            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '32px' }}>
                                {loading ? <div className="spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} /> : 'Confirm Protocol'}
                            </button>
                        </form>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div className="auth-icon-large" style={{ margin: '0 auto 24px', background: 'rgba(16, 185, 129, 0.15)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '3.5rem', color: '#10B981' }}>
                                    how_to_reg
                                </span>
                            </div>
                            <h3 className="font-serif" style={{ marginBottom: '16px', fontSize: '1.5rem' }}>Access Restored</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '32px' }}>
                                Your new pass-key has been permanently established in our system. You may now return to the dimension.
                            </p>
                            <button className="btn-primary" onClick={() => navigate('/login')} style={{ width: '100%' }}>
                                Re-enter Aura
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
