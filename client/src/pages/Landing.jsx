import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
    const navigate = useNavigate();
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

    useEffect(() => {
        // Floating ember particles
        const container = document.createElement('div');
        container.className = 'global-particles';
        document.body.appendChild(container);

        const count = 40;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'spark-ember';
            const size = 2 + Math.random() * 5;
            p.style.cssText = `
                left: ${Math.random() * 100}vw;
                top: ${Math.random() * 100}vh;
                width: ${size}px;
                height: ${size}px;
                --dur: ${10 + Math.random() * 20}s;
                --delay: ${-Math.random() * 15}s;
                opacity: ${0.15 + Math.random() * 0.4};
                animation: ember-float var(--dur) linear infinite;
                animation-delay: var(--delay);
                background: radial-gradient(circle, rgba(255, 94, 0, 0.9), rgba(255, 42, 84, 0.5));
                border-radius: 50%;
                filter: blur(${Math.random() > 0.5 ? 1 : 0}px);
                box-shadow: 0 0 ${6 + Math.random() * 10}px rgba(255, 42, 84, 0.6);
                position: absolute;
                pointer-events: none;
            `;
            container.appendChild(p);
        }

        // Mouse-move glow effect
        const handleMouseMove = (e) => {
            setMousePos({
                x: (e.clientX / window.innerWidth) * 100,
                y: (e.clientY / window.innerHeight) * 100
            });
        };
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <div className="landing-page view-animate spark-cosmic-bg">

            {/* Animated spark embers layer */}
            <div className="stardust-layer">
                {[...Array(60)].map((_, i) => (
                    <div
                        key={i}
                        className="stardust"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            '--duration': `${3 + Math.random() * 7}s`,
                            animationDelay: `${Math.random() * 5}s`,
                            width: `${1 + Math.random() * 2}px`,
                            height: `${1 + Math.random() * 2}px`
                        }}
                    />
                ))}
            </div>

            {/* Hero */}
            <div className="hero-section" style={{ position: 'relative', zIndex: 10 }}>
                <div className="hero-eyebrow">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--primary)' }}>local_fire_department</span>
                        Where Chemistry Meets Ambition
                        <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--primary)' }}>local_fire_department</span>
                    </span>
                </div>

                <h1 className="hero-title font-serif">
                    Experience <span className="text-spark spark-text-flicker">SPARK</span>
                </h1>

                <p className="hero-tagline" style={{ fontStyle: 'italic', fontFamily: "'Cormorant Garamond', serif" }}>
                    Beyond swiping. Pure energy.
                </p>
                <p className="hero-subtext">
                    The ultra-premium social circle for university elites.
                    <br />Where every connection sets the night on fire.
                </p>

                <div className="hero-actions">
                    <button
                        className="hero-cta btn-primary btn-spark-pulse spark-ignite-btn"
                        onClick={() => navigate('/signup')}
                    >
                        <span className="material-symbols-rounded">local_fire_department</span>
                        Ignite Now
                    </button>
                    <button className="btn-ghost" onClick={() => navigate('/login')}>
                        <span className="material-symbols-rounded">login</span>
                        Member Access
                    </button>
                </div>

                {/* Stats for social proof */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: '40px', marginTop: '60px',
                    flexWrap: 'wrap'
                }}>
                    {[
                        { num: '100+', label: 'Connections Made' },
                        { num: '50+', label: 'Active Members' },
                        { num: '∞', label: 'Chemistry' }
                    ].map((stat, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{
                                fontSize: '2rem', fontWeight: 800,
                                background: 'var(--gradient-primary)',
                                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                                color: 'transparent'
                            }}>{stat.num}</div>
                            <div style={{
                                fontSize: '0.8rem', color: 'var(--text-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: 4
                            }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Features */}
            <div className="landing-features">
                <h3 className="font-serif">
                    Why <span className="text-spark">SPARK</span> Burns Brighter
                </h3>
                <div className="features-grid">
                    <div className="feature-card holographic">
                        <div style={{
                            width: 60, height: 60, borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(255,42,84,0.2), rgba(255,94,0,0.1))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 30px rgba(255,42,84,0.2)'
                        }}>
                            <span className="material-symbols-rounded" style={{ color: '#FF4D79', fontSize: '2rem' }}>shield_person</span>
                        </div>
                        <h4>Elite Verification</h4>
                        <p>Access exclusive to verified university members. No fakes, no bots — only real connections.</p>
                    </div>
                    <div className="feature-card holographic">
                        <div style={{
                            width: 60, height: 60, borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(255,94,0,0.2), rgba(255,176,0,0.1))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 30px rgba(255,94,0,0.2)'
                        }}>
                            <span className="material-symbols-rounded" style={{ color: '#FF5E00', fontSize: '2rem' }}>diversity_2</span>
                        </div>
                        <h4>Vibe Alignment</h4>
                        <p>Matching that transcends simple interests. Find someone who truly gets you.</p>
                    </div>
                    <div className="feature-card holographic">
                        <div style={{
                            width: 60, height: 60, borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 30px rgba(16,185,129,0.2)'
                        }}>
                            <span className="material-symbols-rounded" style={{ color: '#10B981', fontSize: '2rem' }}>all_inclusive</span>
                        </div>
                        <h4>Infinite Dialogue</h4>
                        <p>Real-time crystalline chat. Send texts, photos, reactions — keep the flame alive.</p>
                    </div>
                    <div className="feature-card holographic">
                        <div style={{
                            width: 60, height: 60, borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(255,176,0,0.2), rgba(255,176,0,0.1))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 30px rgba(255,176,0,0.2)'
                        }}>
                            <span className="material-symbols-rounded" style={{ color: '#FFB000', fontSize: '2rem' }}>blur_on</span>
                        </div>
                        <h4>Total Discretion</h4>
                        <p>Your privacy is sacred. Anonymous likes, hidden profiles, complete control.</p>
                    </div>
                </div>
            </div>

            {/* Final CTA */}
            <div style={{
                textAlign: 'center', padding: '80px 20px 120px',
                position: 'relative', zIndex: 10
            }}>
                <h2 className="font-serif" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginBottom: '16px' }}>
                    Ready to <span className="text-spark">ignite</span> something?
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '1.1rem' }}>
                    Your campus. Your SPARK. Your story.
                </p>
                <button
                    className="btn-primary btn-spark-pulse spark-ignite-btn"
                    onClick={() => navigate('/signup')}
                    style={{ padding: '16px 40px', fontSize: '1.1rem' }}
                >
                    <span className="material-symbols-rounded">local_fire_department</span>
                    Join SPARK Now
                </button>
            </div>
        </div>
    );
}
