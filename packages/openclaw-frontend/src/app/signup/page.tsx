'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useNotification } from '@/components/notification-provider';
import { Terminal, Loader2 } from 'lucide-react';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();
    const { showNotification } = useNotification();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        if (password.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        setLoading(true);

        try {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            showNotification('Check your email to confirm your account', 'success');
            router.replace('/login');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Signup failed';
            showNotification(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12">
            <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse-subtle pointer-events-none" />

            <div className="w-full max-w-sm space-y-8 relative z-10">
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 mb-2">
                        <Terminal className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">
                        Create Account
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Get your AI agent running in seconds
                    </p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
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
                            placeholder="Min 6 characters"
                            autoComplete="new-password"
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
                                Creating account…
                            </>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <a href="/login" className="text-primary font-semibold hover:underline">
                        Sign in
                    </a>
                </p>
            </div>
        </div>
    );
}
