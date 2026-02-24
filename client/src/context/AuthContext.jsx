import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getToken, setToken as storeToken, clearToken, getCachedUser, setCachedUser, apiFetch } from '../services/api';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getCachedUser());
    const [token, setTokenState] = useState(() => getToken());
    const [socket, setSocket] = useState(null);
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

    // Socket initialization
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

        socketRef.current = s;
        setSocket(s);

        return () => {
            s.disconnect();
            socketRef.current = null;
        };
    }, [token]);

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
