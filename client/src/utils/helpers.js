// ========================================
// Aura — Helper Utilities
// ========================================

export function defaultAvatar(name = 'user', size = 200) {
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&size=${size}`;
}

export function escapeHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

export function formatTime(t) {
    if (!t) return '';
    const d = new Date(t);
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'now';
    if (d.toDateString() === now.toDateString())
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 7 * 24 * 60 * 60 * 1000)
        return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function extractNameFromEmail(email) {
    const prefix = email.split('@')[0];
    const parts = prefix.split('.');
    const nameParts = parts.filter(p => /^[a-zA-Z]/.test(p));
    return nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ') || prefix;
}

export function getTimeAgo(t) {
    if (!t) return 'Active just now';
    const d = new Date(t);
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = Math.floor((now - d) / 1000); // seconds

    if (diff < 60) return 'Active now';
    if (diff < 3600) return `Active ${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `Active ${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'Active yesterday';
    return `Active ${Math.floor(diff / 86400)}d ago`;
}

