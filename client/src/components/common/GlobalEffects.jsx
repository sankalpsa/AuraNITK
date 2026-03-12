import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function GlobalEffects() {
    const location = useLocation();
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

    useEffect(() => {
        // Subtle floating dust particles (Global)
        const container = document.createElement('div');
        container.className = 'global-particles';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: -1;
            overflow: hidden;
        `;
        document.body.appendChild(container);

        const count = 12; // Fewer, subtler particles
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'spark-ember';
            const size = 1 + Math.random() * 3;
            p.style.cssText = `
                left: ${Math.random() * 100}vw;
                top: ${Math.random() * 100}vh;
                width: ${size}px;
                height: ${size}px;
                --dur: ${20 + Math.random() * 30}s;
                --delay: ${-Math.random() * 25}s;
                opacity: ${0.06 + Math.random() * 0.12};
                animation: ember-float var(--dur) linear infinite;
                animation-delay: var(--delay);
                background: radial-gradient(circle, rgba(196, 181, 253, 0.5), rgba(167, 139, 250, 0.3));
                border-radius: 50%;
                filter: blur(1px);
                box-shadow: 0 0 ${3 + Math.random() * 5}px rgba(167, 139, 250, 0.15);
                position: absolute;
                pointer-events: none;
            `;
            container.appendChild(p);
        }

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
        <div
            className="mouse-glow"
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                pointerEvents: 'none',
                zIndex: -1,
                background: `radial-gradient(500px circle at ${mousePos.x}% ${mousePos.y}%, rgba(139, 92, 246, 0.04), transparent 50%)`,
                transition: 'background 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
        />
    );
}
