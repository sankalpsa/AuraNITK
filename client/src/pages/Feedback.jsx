import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function Feedback() {
    const [type, setType] = useState('Improvement');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message) return showToast('Please describe your feedback.', 'error');

        setLoading(true);
        try {
            await apiFetch('/api/feedback', {
                method: 'POST',
                body: JSON.stringify({ type, message })
            });
            showToast('Feedback sent! The developers have been notified. ✨', 'success');
            setTimeout(() => navigate('/discover'), 2000);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="feedback-page view-animate p-safe">
            <div className="max-w-md mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button className="btn-icon bg-elevated" onClick={() => navigate(-1)}>
                        <span className="material-symbols-rounded">arrow_back</span>
                    </button>
                    <h1 className="text-2xl font-serif">Pulse Feedback</h1>
                </div>

                <div className="auth-card holographic" style={{ padding: '24px' }}>
                    <p className="text-muted mb-8 text-sm leading-relaxed">
                        Have a suggestion or caught a glitch? Help us refine the 
                        <span className="text-spark font-medium"> SPARK</span> experience. 
                        Your thoughts go directly to our engineering core.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="input-group">
                            <label className="text-xs uppercase tracking-widest text-muted mb-2 block">Category</label>
                            <select 
                                className="input-field w-full outline-none" 
                                value={type} 
                                onChange={(e) => setType(e.target.value)}
                            >
                                <option value="Improvement">Improvement Idea</option>
                                <option value="Bug Report">Glitch / Bug Report</option>
                                <option value="Feature Request">New Feature Request</option>
                                <option value="UX/UI">Design Feedback</option>
                                <option value="Other">Something Else</option>
                            </select>
                        </div>

                        <div className="input-group">
                            <label className="text-xs uppercase tracking-widest text-muted mb-2 block">Details</label>
                            <textarea 
                                className="input-field w-full outline-none min-h-[150px] resize-none"
                                placeholder="Describe it here... Be as specific as you can!"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                required
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading || !message}
                            className="btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <div className="spinner w-5 h-5" />
                            ) : (
                                <>
                                    <span>Transmit Feedback</span>
                                    <span className="material-symbols-rounded text-lg group-hover:translate-x-1 transition-transform">send</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[10px] text-muted uppercase tracking-[0.2em]">
                        Your SPARK identity is attached for context
                    </p>
                </div>
            </div>
        </div>
    );
}
