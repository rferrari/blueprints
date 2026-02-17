'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
    id: string;
    message: string;
    type: NotificationType;
}

interface NotificationContextType {
    showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType>({
    showNotification: () => { },
});

export const useNotification = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 4000);
    }, []);

    const dismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const iconMap = {
        success: <CheckCircle size={18} className="text-green-400" />,
        error: <AlertTriangle size={18} className="text-red-400" />,
        info: <Info size={18} className="text-blue-400" />,
    };

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-[90vw] sm:max-w-sm">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className="glass rounded-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300"
                    >
                        {iconMap[n.type]}
                        <span className="text-sm flex-1">{n.message}</span>
                        <button
                            onClick={() => dismiss(n.id)}
                            className="text-muted-foreground hover:text-white transition-colors p-1"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}
