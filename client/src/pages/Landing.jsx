import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) navigate('/discover', { replace: true });
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        // Floating particles
        const hero = document.querySelector('.hero-section');
        if (!hero) return;
        const emojis = ['💕', '💖', '✨', '💫', '🌸', '💝', '🎀', '💗'];
        hero.querySelectorAll('.particle').forEach(p => p.remove());
        for (let i = 0; i < 12; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            p.style.cssText = `
        left: ${Math.random() * 100}%;
        top: ${20 + Math.random() * 70}%;
        --dur: ${4 + Math.random() * 6}s;
        --delay: ${-Math.random() * 6}s;
        font-size: ${0.7 + Math.random() * 1.2}rem;
        animation-delay: var(--delay);
        animation-duration: var(--dur);
      `;
            hero.appendChild(p);
        }
    }, []);

    return (
        <div className="landing-page view-animate">
            <div className="hero-section">
                <div className="hero-eyebrow">NITK Surathkal · Est. 2025</div>
                <div className="hero-logo">NITKnot</div>
                <p className="hero-tagline">Swipe. Match. Connect.</p>
                <p className="hero-subtext">
                    The dating app made exclusively for NITK Surathkal students.
                    Find your campus connection today.
                </p>
                <div className="hero-actions">
                    <button className="hero-cta btn-primary" onClick={() => navigate('/signup')}>
                        <span className="material-symbols-outlined fill-icon">favorite</span>
                        Start Swiping
                    </button>
                    <button className="btn-secondary" onClick={() => navigate('/login')}>
                        <span className="material-symbols-outlined">login</span>
                        Log In
                    </button>
                </div>
            </div>
            <div className="landing-features" style={{ padding: '32px 20px 60px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>
                    Why NITKnot?
                </h3>
                <div className="features-grid">
                    <div className="feature-card">
                        <span className="material-symbols-outlined fill-icon">verified_user</span>
                        <h4>NITK Verified</h4>
                        <p>Only real students with nitk.edu.in emails</p>
                    </div>
                    <div className="feature-card">
                        <span className="material-symbols-outlined fill-icon">style</span>
                        <h4>Smart Matching</h4>
                        <p>Matches based on shared interests</p>
                    </div>
                    <div className="feature-card">
                        <span className="material-symbols-outlined fill-icon">chat_bubble</span>
                        <h4>Real-time Chat</h4>
                        <p>Message instantly with your matches</p>
                    </div>
                    <div className="feature-card">
                        <span className="material-symbols-outlined fill-icon">security</span>
                        <h4>Safe & Private</h4>
                        <p>Easy reporting, anonymous until match</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
