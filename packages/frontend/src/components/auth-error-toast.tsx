'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AuthErrorToast() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
            // Initial render delay to allow animation
            setTimeout(() => {
                setErrorMsg(errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, ' ')) : 'An authentication error occurred.');
                setIsVisible(true);
            }, 100);
        }
    }, [searchParams]);

    const handleDismiss = () => {
        setIsVisible(false);
        // Clean up URL without reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    };

    if (!isVisible && !errorMsg) return null;

    return (
        <div
            className={cn(
                "fixed top-6 right-6 z-[100] max-w-sm w-full transition-all duration-500 ease-out transform",
                isVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
            )}
        >
            <div className="glass-card bg-red-500/10 border-red-500/20 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex items-start gap-4">
                <div className="p-2 bg-red-500/20 rounded-xl shrink-0">
                    <AlertTriangle className="size-5 text-red-500" />
                </div>

                <div className="flex-1 pt-1">
                    <h4 className="text-sm font-bold text-white mb-1">Authentication Failed</h4>
                    <p className="text-xs text-red-200 font-medium leading-relaxed">
                        {errorMsg}
                    </p>
                </div>

                <button
                    onClick={handleDismiss}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
