import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const NAV_ITEMS = [
    { view: 'discover', icon: 'style', label: 'Discover', path: '/discover' },
    { view: 'connections', icon: 'people', label: 'Matches', path: '/connections' },
    { view: 'chat', icon: 'chat_bubble', label: 'Messages', path: '/chat' },
    { view: 'likes', icon: 'favorite', label: 'Likes', path: '/likes' },
    { view: 'profile', icon: 'person', label: 'Profile', path: '/profile' },
];

const MAIN_PATHS = ['/discover', '/connections', '/chat', '/likes', '/profile', '/settings'];

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const showNav = isAuthenticated && MAIN_PATHS.some(p => location.pathname.startsWith(p));

    useEffect(() => {
        if (!isAuthenticated) return;
        const updateBadge = async () => {
            try {
                const data = await apiFetch('/api/matches');
                const total = (data.matches || []).reduce((s, m) => s + (m.unread_count || 0), 0);
                setUnreadCount(total);
            } catch { /* ignore */ }
        };
        updateBadge();
        const interval = setInterval(updateBadge, 15000);
        return () => clearInterval(interval);
    }, [isAuthenticated, location.pathname]);

    return (
        <div id="layout">
            {showNav && (
                <nav className="bottom-nav">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.view}
                            className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                            onClick={() => navigate(item.path)}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                            {item.view === 'chat' && unreadCount > 0 && (
                                <span className="nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </button>
                    ))}
                </nav>
            )}
            <div className="app-container">
                <Outlet />
            </div>
        </div>
    );
}
