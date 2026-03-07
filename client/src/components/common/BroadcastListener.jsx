import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function BroadcastListener() {
    const { socket } = useAuth();
    const [announcement, setAnnouncement] = useState(null);

    useEffect(() => {
        if (!socket) return;

        const handleAnnouncement = (data) => {
            setAnnouncement(data);
            // Play a subtle notification sound if you want
            try {
                const audio = new Audio('https://res.cloudinary.com/dk9t667nj/video/upload/v1/notifications/broadcast_chime.mp3');
                audio.volume = 0.4;
                // audio.play().catch(() => {}); // Browsers might block auto-play
            } catch (e) { /* ignore */ }
        };

        socket.on('admin_announcement', handleAnnouncement);
        return () => socket.off('admin_announcement', handleAnnouncement);
    }, [socket]);

    if (!announcement) return null;

    return (
        <div className="broadcast-overlay view-animate">
            <div className={`broadcast-modal ${announcement.type || 'info'}`}>
                <div className="broadcast-badge">
                    <span className="material-symbols-rounded">campaign</span>
                    OFFICIAL CAMPUS NEWS
                </div>
                <h2>{announcement.title}</h2>
                <p>{announcement.message}</p>
                <div className="broadcast-footer">
                    <span className="broadcast-time">Sent by Administration</span>
                    <button className="broadcast-close" onClick={() => setAnnouncement(null)}>Acknowledge</button>
                </div>
            </div>
        </div>
    );
}
