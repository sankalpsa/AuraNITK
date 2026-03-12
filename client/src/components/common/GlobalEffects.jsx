import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function GlobalEffects() {
    const location = useLocation();
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

    useEffect(() => {
        // Floating ember particles (Global)
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

        const count = 30; // Slightly fewer particles for global background
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'spark-ember';
            const size = 1 + Math.random() * 4;
            p.style.cssText = `
                left: ${Math.random() * 100}vw;
                top: ${Math.random() * 100}vh;
                width: ${size}px;
                height: ${size}px;
                --dur: ${15 + Math.random() * 25}s;
                --delay: ${-Math.random() * 20}s;
                opacity: ${0.1 + Math.random() * 0.3};
                animation: ember-float var(--dur) linear infinite;
                animation-delay: var(--delay);
                background: radial-gradient(circle, rgba(255, 94, 0, 0.6), rgba(255, 42, 84, 0.4));
                border-radius: 50%;
                filter: blur(1px);
                box-shadow: 0 0 ${4 + Math.random() * 8}px rgba(255, 42, 84, 0.3);
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

    // Don't render glow on landing page if it has its own, 
    // but actually let's make it truly global and remove it from Landing.jsx later.
    return (
        <div
            className="mouse-glow"
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                pointerEvents: 'none',
                zIndex: -1, // Behind content
                background: `radial-gradient(800px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 42, 84, 0.08), transparent 50%)`,
                transition: 'background 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
        />
    );
}
