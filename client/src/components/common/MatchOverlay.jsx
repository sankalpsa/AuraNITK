import { useEffect } from 'react';
import { defaultAvatar } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function MatchOverlay({ matchedUser, onClose, onChat }) {
    const { user } = useAuth();


    useEffect(() => {
        // Spawn confetti
        const colors = ['#ff2d78', '#b721ff', '#21d4fd', '#ff6b35', '#ffdd00', '#00e96d'];
        const spawnConfetti = (x, y) => {
            for (let i = 0; i < 50; i++) {
                const el = document.createElement('div');
                el.className = 'confetti-piece';
                const angle = (Math.random() * 360) * Math.PI / 180;
                const velocity = 100 + Math.random() * 200;
                el.style.cssText = `
          left: ${x || 50}%;
          top: ${y || 40}%;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          width: ${4 + Math.random() * 8}px;
          height: ${4 + Math.random() * 8}px;
          border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
          --duration: ${1.5 + Math.random() * 2}s;
          --delay: ${Math.random() * 0.5}s;
          transform: translate(-50%, -50%);
          --dx: ${Math.cos(angle) * velocity}px;
          --dy: ${Math.sin(angle) * velocity - 80}px;
        `;
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 3500);
            }
        };

        setTimeout(() => spawnConfetti(50, 30), 200);
        setTimeout(() => spawnConfetti(20, 50), 500);
        setTimeout(() => spawnConfetti(80, 40), 800);
    }, []);

    if (!matchedUser) return null;

    return (
        <div className="match-overlay-spark view-animate">
            <div className="match-card-spark">
                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🌌</div>
                <h1 className="font-serif" style={{ fontSize: '2.5rem', marginBottom: '10px', background: 'var(--gradient-spark)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    FUSION IGNITED!
                </h1>
                <p style={{ opacity: 0.6, marginBottom: '40px' }}>A celestial resonance has been detected in the SPARK.</p>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '50px' }}>
                    <div className="match-photo-ring view-animate" style={{ animationDelay: '0.2s' }}>
                        <img
                            className="match-photo-spark"
                            src={user?.photo || defaultAvatar(user?.name)}
                            alt="You"
                        />
                    </div>
                    <div className="pulse-animation" style={{ fontSize: '2rem' }}>💖</div>
                    <div className="match-photo-ring view-animate" style={{ animationDelay: '0.4s' }}>
                        <img
                            className="match-photo-spark"
                            src={matchedUser.photo || defaultAvatar(matchedUser.name)}
                            alt="Match"
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <button className="btn-primary holographic" onClick={onChat} style={{ padding: '15px' }}>
                        Ignite Whisper
                    </button>
                    <button className="btn-secondary" onClick={onClose} style={{ padding: '15px' }}>
                        Fanning the Flames
                    </button>
                </div>
            </div>
        </div>
    );
}
