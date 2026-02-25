import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getToken, setToken as storeToken, clearToken, getCachedUser, setCachedUser, apiFetch } from '../services/api';
import { io } from 'socket.io-client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getCachedUser());
    const [token, setTokenState] = useState(() => getToken());
    const [socket, setSocket] = useState(null);
    const { showToast } = useToast();
    const socketRef = useRef(null);

    const login = useCallback((tokenVal, userData) => {
        storeToken(tokenVal);
        setCachedUser(userData);
        setTokenState(tokenVal);
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        clearToken();
        setTokenState(null);
        setUser(null);
        setSocket(null);
    }, []);

    const updateUser = useCallback((userData) => {
        setCachedUser(userData);
        setUser(userData);
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const data = await apiFetch('/api/auth/me');
            setCachedUser(data.user);
            setUser(data.user);
            return data.user;
        } catch (e) {
            if (e.message.includes('Session') || e.message.includes('expired')) {
                logout();
            }
            return null;
        }
    }, [logout]);

    // Socket initialization and Global Listeners
    useEffect(() => {
        if (!token || socketRef.current) return;

        const s = io({
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        s.on('connect', () => {
            const u = getCachedUser();
            if (u) s.emit('register', u.id);
        });

        // Global Listeners for Toasts / Notifications
        s.on('match_found', (data) => {
            showToast(`💖 Match! You and ${data.user.name} liked each other!`, 'success', 5000);
        });

        s.on('super_like_received', ({ name }) => {
            showToast(`⭐ ${name} super-liked you! Check your likes!`, 'info', 5000);
        });

        s.on('new_message', (msg) => {
            // Only show toast if not in that specific chat conversation
            const isChatConvo = window.location.pathname === '/chat/convo';
            if (!isChatConvo) {
                showToast(`💬 ${msg.sender_name}: ${msg.text || '📷 Photo'}`, 'info');
            }
        });

        socketRef.current = s;
        setSocket(s);

        return () => {
            if (s) {
                s.off('connect');
                s.off('match_found');
                s.off('super_like_received');
                s.off('new_message');
                s.disconnect();
            }
            socketRef.current = null;
        };
    }, [token, showToast]);

    const value = {
        user,
        token,
        socket,
        isAuthenticated: !!token,
        login,
        logout,
        updateUser,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
