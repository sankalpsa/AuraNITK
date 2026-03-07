import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
    const navigate = useNavigate();

    useEffect(() => {
        // Floating particles for the whole screen
        const container = document.createElement('div');
        container.className = 'global-particles';
        document.body.appendChild(container);

        const emojis = ['✨', '💎', '🥂', '🌙', '⭐', '✨', '⚜️', '🥂'];
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
                <div className="hero-eyebrow">An Exclusive University Society · Est. 2025</div>
                <img src="/aura-logo.png" className="logo-img-large" alt="Aura Logo" style={{ marginBottom: 16 }} />
                <p className="hero-tagline">Elevate your baseline.</p>
                <p className="hero-subtext">
                    The premium dating circle for ambitious university students.
                    Curated connections await.
                </p>
                <div className="hero-actions">
                    <button className="hero-cta btn-primary" onClick={() => navigate('/signup')}>
                        <span className="material-symbols-outlined fill-icon">diamond</span>
                        Enter Aura
                    </button>
                    <button className="btn-ghost" onClick={() => navigate('/login')}>
                        <span className="material-symbols-outlined">key</span>
                        Member Login
                    </button>
                </div>
            </div>
            <div className="landing-features">
                <h3>The Aura Standard</h3>
                <div className="features-grid">
                    <div className="feature-card">
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)' }}>verified_user</span>
                        <h4>Strictly Verified</h4>
                        <p>Access requires an active university credential</p>
                    </div>
                    <div className="feature-card">
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)' }}>auto_awesome</span>
                        <h4>Curated Quality</h4>
                        <p>Intelligent matching based on shared lifestyles</p>
                    </div>
                    <div className="feature-card">
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)' }}>chat_bubble</span>
                        <h4>Seamless Dialogue</h4>
                        <p>End-to-end encrypted real-time messaging</p>
                    </div>
                    <div className="feature-card">
                        <span className="material-symbols-outlined fill-icon" style={{ color: 'var(--primary)' }}>security</span>
                        <h4>Absolute Privacy</h4>
                        <p>Anonymous browsing until a mutual match occurs</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
