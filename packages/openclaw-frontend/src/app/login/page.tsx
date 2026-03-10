'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useNotification } from '@/components/notification-provider';
import { Terminal, Loader2, Activity } from 'lucide-react';
import { useServiceStatus } from '@/hooks/use-service-status';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { isDown, loading: checkingStatus } = useServiceStatus();
    const router = useRouter();
    const supabase = createClient();
    const { showNotification } = useNotification();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            router.replace('/');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Login failed';
            showNotification(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12">
            {/* Animated background accent */}
            <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse-subtle pointer-events-none" />

            <div className="w-full max-w-sm space-y-8 relative z-10">
                {/* Logo / Brand */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 mb-2">
                        <Terminal className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">
                        Blue<span className="text-primary">prints</span>
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Your AI Agent, Ready in Seconds
                    </p>
                </div>

                {/* Maintenance Message */}
                {isDown && !checkingStatus && (
                    <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500 glass-card">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Activity className="text-primary" size={24} />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-black italic uppercase tracking-tighter text-white">System Maintenance</h3>
                            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                We are currently optimizing the platform. <span className="text-primary italic">Running agents are not affected.</span> We&apos;ll be back shortly.
                            </p>
                        </div>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                            disabled={isDown}
                            className="w-full px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all disabled:opacity-50"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            disabled={isDown}
                            className="w-full px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all disabled:opacity-50"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !email || !password || isDown}
                        className="w-full py-4 rounded-2xl bg-primary hover:opacity-90 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Signing in…
                            </>
                        ) : isDown ? (
                            'Maintenance Mode'
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                {/* Signup Link */}
                <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <a href="/signup" className="text-primary font-semibold hover:underline">
                        Sign up
                    </a>
                </p>
            </div>
        </div>
    );
}
