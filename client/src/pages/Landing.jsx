import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
    const navigate = useNavigate();

    useEffect(() => {
        // Constellation Particles
        const container = document.createElement('div');
        container.className = 'global-particles';
        document.body.appendChild(container);

        const count = 50;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'constellation-point';
            const size = 2 + Math.random() * 4;
            p.style.cssText = `
                left: ${Math.random() * 100}vw;
                top: ${Math.random() * 100}vh;
                width: ${size}px;
                height: ${size}px;
                --dur: ${15 + Math.random() * 20}s;
                --delay: ${-Math.random() * 20}s;
                opacity: ${0.2 + Math.random() * 0.5};
                animation: float-nebula var(--dur) linear infinite;
                animation-delay: var(--delay);
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
                <div className="hero-eyebrow">A New Dimension of Connection · Est. 2025</div>
                <h1 className="hero-title font-serif">
                    Experience <span className="text-aurora">Aura</span>
                </h1>
                <p className="hero-tagline">Beyond swiping. Pure energy.</p>
                <p className="hero-subtext">
                    The ultra-premium social circle for university elites.
                    Where ambition meets attraction.
                </p>
                <div className="hero-actions">
                    <button className="hero-cta btn-primary" onClick={() => navigate('/signup')}>
                        <span className="material-symbols-rounded">auto_awesome</span>
                        Ascend Now
                    </button>
                    <button className="btn-ghost" onClick={() => navigate('/login')}>
                        <span className="material-symbols-rounded">login</span>
                        Member Access
                    </button>
                </div>
            </div>

            <div className="landing-features">
                <h3 className="font-serif">The Celestial Standard</h3>
                <div className="features-grid">
                    <div className="feature-card holographic">
                        <span className="material-symbols-rounded" style={{ color: 'var(--accent-cyan)', fontSize: '2.5rem' }}>shield_person</span>
                        <h4>Elite Verification</h4>
                        <p>Access exclusive to verified university members</p>
                    </div>
                    <div className="feature-card holographic">
                        <span className="material-symbols-rounded" style={{ color: 'var(--accent-magenta)', fontSize: '2.5rem' }}>diversity_2</span>
                        <h4>Vibe Alignment</h4>
                        <p>Matching that transcends simple interests</p>
                    </div>
                    <div className="feature-card holographic">
                        <span className="material-symbols-rounded" style={{ color: 'var(--accent-emerald)', fontSize: '2.5rem' }}>all_inclusive</span>
                        <h4>Infinite Dialogue</h4>
                        <p>Real-time crystalline chat experience</p>
                    </div>
                    <div className="feature-card holographic">
                        <span className="material-symbols-rounded" style={{ color: 'var(--accent-amber)', fontSize: '2.5rem' }}>blur_on</span>
                        <h4>Total Discretion</h4>
                        <p>Your privacy is our highest frequency</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
