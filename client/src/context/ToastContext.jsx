import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toast, setToast] = useState({ message: '', type: '', visible: false });
    const timerRef = useRef(null);

    const showToast = useCallback((message, type = '', duration = 3000) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setToast({ message, type, visible: true });
        timerRef.current = setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, duration);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className={`toast ${toast.type} ${toast.visible ? '' : 'hidden'}`}>
                {toast.message}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
