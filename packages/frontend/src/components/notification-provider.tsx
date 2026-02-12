'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Info, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
    id: string;
    message: string;
    type: NotificationType;
    title?: string;
}

interface NotificationContextType {
    showNotification: (message: string, type?: NotificationType, title?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const showNotification = useCallback((message: string, type: NotificationType = 'info', title?: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications((prev) => [...prev, { id, message, type, title }]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            removeNotification(id);
        }, 5000);
    }, [removeNotification]);

    const contextValue = useMemo(() => ({ showNotification }), [showNotification]);

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-6 right-6 z-[100] flex flex-col gap-4 w-full max-w-sm pointer-events-none">
                {notifications.map((notification) => (
                    <NotificationToast
                        key={notification.id}
                        notification={notification}
                        onDismiss={() => removeNotification(notification.id)}
                    />
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

function NotificationToast({ notification, onDismiss }: { notification: Notification; onDismiss: () => void }) {
    const icons = {
        success: <CheckCircle className="size-5 text-green-500" />,
        error: <AlertCircle className="size-5 text-red-500" />,
        warning: <AlertTriangle className="size-5 text-amber-500" />,
        info: <Info className="size-5 text-blue-500" />
    };

    const colors = {
        success: "bg-green-500/10 border-green-500/20 text-green-200",
        error: "bg-red-500/10 border-red-500/20 text-red-200",
        warning: "bg-amber-500/10 border-amber-500/20 text-amber-200",
        info: "bg-blue-500/10 border-blue-500/20 text-blue-200"
    };

    const titles = {
        success: "Success",
        error: "Error",
        warning: "Warning",
        info: "Notification"
    };

    return (
        <div className={cn(
            "pointer-events-auto glass-card rounded-2xl p-4 shadow-2xl backdrop-blur-xl border transition-all duration-300 animate-in slide-in-from-right-full fade-in",
            colors[notification.type]
        )}>
            <div className="flex items-start gap-4">
                <div className={cn("p-2 rounded-xl shrink-0 bg-white/5")}>
                    {icons[notification.type]}
                </div>

                <div className="flex-1 pt-1">
                    <h4 className="text-sm font-bold text-white mb-1">
                        {notification.title || titles[notification.type]}
                    </h4>
                    <p className="text-xs font-medium leading-relaxed opacity-80">
                        {notification.message}
                    </p>
                </div>

                <button
                    onClick={onDismiss}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
