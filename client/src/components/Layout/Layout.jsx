import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const NAV_ITEMS = [
    { view: 'discover', icon: 'style', label: 'Ignition', path: '/discover' },
    { view: 'connections', icon: 'people', label: 'Fusions', path: '/connections' },
    { view: 'chat', icon: 'chat_bubble', label: 'Whispers', path: '/chat' },
    { view: 'likes', icon: 'favorite', label: 'Resonance', path: '/likes' },
    { view: 'profile', icon: 'person', label: 'Manifest', path: '/profile' },
];

const MAIN_PATHS = ['/discover', '/connections', '/chat', '/likes', '/profile', '/settings'];
// Full-screen pages that have their own action bars — hide the bottom nav on these
const NO_NAV_PATHS = ['/profile/view', '/chat/convo'];

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const isNoNav = NO_NAV_PATHS.some(p => location.pathname.startsWith(p));
    const showNav = isAuthenticated && !isNoNav && MAIN_PATHS.some(p => location.pathname.startsWith(p));

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

    const isLanding = location.pathname === '/';

    return (
        <div id="layout">
            {showNav && (
                <nav className="bottom-nav-spark">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.view}
                            className={`nav-item-spark ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                            onClick={() => navigate(item.path)}
                        >
                            <span className="material-symbols-rounded">{item.icon}</span>
                            {item.view === 'chat' && unreadCount > 0 && (
                                <span className="nav-badge-spark">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </button>
                    ))}
                </nav>
            )}
            <div className={isLanding ? 'landing-wrapper' : 'app-container'}>
                <Outlet />
            </div>
        </div>
    );
}
