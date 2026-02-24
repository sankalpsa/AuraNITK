// ========================================
// NITKnot — API Service
// ========================================

const API = '';

export function getToken() {
    return localStorage.getItem('nk_token');
}

export function setToken(t) {
    localStorage.setItem('nk_token', t);
}

export function clearToken() {
    localStorage.removeItem('nk_token');
    localStorage.removeItem('nk_user');
}

export function getCachedUser() {
    try {
        return JSON.parse(localStorage.getItem('nk_user'));
    } catch {
        return null;
    }
}

export function setCachedUser(u) {
    localStorage.setItem('nk_user', JSON.stringify(u));
}

export async function apiFetch(path, opts = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
        res = await fetch(`${API}${path}`, { ...opts, headers });
    } catch {
        throw new Error('Network error — check your connection');
    }

    let data;
    try {
        data = await res.json();
    } catch {
        data = {};
    }

    if (!res.ok) {
        if (res.status === 401) {
            const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/register') ||
                path.includes('/auth/send-otp') || path.includes('/auth/verify-otp');
            if (!isAuthRoute) {
                clearToken();
                window.location.pathname = '/';
                throw new Error('Session expired. Please login again.');
            }
        }
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
}

export async function apiUpload(path, formData) {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let res;
    try {
        res = await fetch(`${API}${path}`, { method: 'POST', headers, body: formData });
    } catch {
        throw new Error('Network error — check your connection');
    }
    let data;
    try {
        data = await res.json();
    } catch {
        data = {};
    }
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
}

export function markAsRead(matchId) {
    apiFetch(`/api/messages/${matchId}/read`, { method: 'POST' }).catch(() => { });
}
