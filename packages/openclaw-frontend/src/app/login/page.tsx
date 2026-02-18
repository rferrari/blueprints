'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useNotification } from '@/components/notification-provider';
import { Terminal, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
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
                            className="w-full px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
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
                            className="w-full px-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className="w-full py-4 rounded-2xl bg-primary hover:opacity-90 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Signing in…
                            </>
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
