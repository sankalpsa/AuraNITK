import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
    const navigate = useNavigate();

    useEffect(() => {
        // Floating particles for the whole screen
        const container = document.createElement('div');
        container.className = 'global-particles';
        document.body.appendChild(container);

        const emojis = ['💕', '💖', '✨', '💫', '🌸', '💝', '🎀', '💗'];
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            const size = 0.8 + Math.random() * 2;
            p.style.cssText = `
                left: ${Math.random() * 100}vw;
                top: ${Math.random() * 100}vh;
                --dur: ${8 + Math.random() * 12}s;
                --delay: ${-Math.random() * 10}s;
                font-size: ${size}rem;
                filter: blur(${Math.random() > 0.8 ? '1px' : '0'});
                animation-delay: var(--delay);
                animation-duration: var(--dur);
            `;
            container.appendChild(p);
        }

        return () => {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        };
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
                    <button className="btn-ghost" onClick={() => navigate('/login')}>
                        <span className="material-symbols-outlined">login</span>
                        Log In
                    </button>
                </div>
            </div>
            <div className="landing-features">
                <h3>Why NITKnot?</h3>
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
