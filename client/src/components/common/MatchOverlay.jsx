import { useEffect, useRef } from 'react';
import { defaultAvatar } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function MatchOverlay({ matchedUser, matchId, onClose, onChat }) {
    const { user } = useAuth();
    const overlayRef = useRef(null);

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
        <div className="match-overlay">
            <div className="match-content">
                <div className="match-hearts">💕</div>
                <h2 className="match-title">It's a Match!</h2>
                <p className="match-subtitle">
                    You and <span>{matchedUser.name}</span> liked each other
                </p>
                <div className="match-photos">
                    <img
                        className="match-photo"
                        src={user?.photo || defaultAvatar(user?.name)}
                        alt="You"
                        onError={(e) => { e.target.src = defaultAvatar(user?.name); }}
                    />
                    <div className="match-heart-center">❤️</div>
                    <img
                        className="match-photo"
                        src={matchedUser.photo || defaultAvatar(matchedUser.name)}
                        alt="Match"
                        onError={(e) => { e.target.src = defaultAvatar(matchedUser.name); }}
                    />
                </div>
                <button className="btn-primary match-btn" onClick={onClose}>
                    Keep Swiping 💫
                </button>
                <button className="btn-ghost match-btn" onClick={onChat}>
                    Send Message 💬
                </button>
            </div>
        </div>
    );
}
