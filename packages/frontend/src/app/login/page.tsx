'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase';
import { Bot, Sparkles, ArrowRight, Github } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

function LoginPageContent() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [isMagicLinkLogin, setIsMagicLinkLogin] = useState(false);
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const message = searchParams?.get('message');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (isMagicLinkLogin) {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}`,
                },
            });

            if (error) {
                setError(error.message);
            } else {
                setMagicLinkSent(true);
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                router.push('/dashboard');
            }
        }
        setLoading(false);
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
            {/* Background Decorations */}
            <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-purple-500/20 rounded-full blur-[120px] animate-pulse delay-1000" />

            <div className="w-full max-w-md relative z-10">
                <div className="glass-card rounded-[2.5rem] p-8 md:p-12 shadow-2xl border-white/5 bg-white/[0.02]">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="size-16 rounded-2xl bg-gradient-unicorn p-0.5 shadow-lg shadow-primary/20 mb-6 group animate-glow">
                            <div className="w-full h-full bg-background rounded-[calc(1rem-2px)] flex items-center justify-center">
                                <Bot size={32} className="text-white group-hover:scale-110 transition-transform duration-300" />
                            </div>
                        </div>
                        <h1 className="text-4xl font-black tracking-tight mb-3">
                            Eliza <span className="text-transparent bg-clip-text bg-gradient-unicorn">Manager</span>
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg max-w-[280px]">
                            The future of AI orchestration starts here.
                        </p>
                    </div>

                    {message && (
                        <div className="rounded-2xl bg-green-500/10 border border-green-500/20 p-4 text-sm font-medium text-green-400 animate-in fade-in slide-in-from-top-2 duration-300 mb-6">
                            {message}
                        </div>
                    )}

                    {magicLinkSent ? (
                        <div className="rounded-2xl bg-primary/10 border border-primary/20 p-6 text-center animate-in fade-in slide-in-from-top-2 duration-300">
                            <h3 className="font-bold text-lg mb-2">Magic Link Sent!</h3>
                            <p className="text-muted-foreground text-sm">
                                Check your email for a link to sign in. You can close this tab.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-4">
                                <div className="group">
                                    <label htmlFor="email" className="block text-sm font-bold text-muted-foreground mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                                        Email Address
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        placeholder="your@email.com"
                                        className="w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 focus:border-primary/50 focus:bg-white/[0.08] outline-none transition-all duration-300 placeholder:text-muted-foreground/30"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                {!isMagicLinkLogin && (
                                    <div className="group">
                                        <label htmlFor="password" title="Password must be at least 6 characters" className="block text-sm font-bold text-muted-foreground mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                                            Password
                                        </label>
                                        <input
                                            id="password"
                                            type="password"
                                            required={!isMagicLinkLogin}
                                            placeholder="••••••••"
                                            className="w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 focus:border-primary/50 focus:bg-white/[0.08] outline-none transition-all duration-300 placeholder:text-muted-foreground/30"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-2 duration-300">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full relative group overflow-hidden rounded-2xl bg-primary py-4 font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                <div className="absolute inset-0 bg-gradient-unicorn opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <span className="relative flex items-center justify-center gap-2">
                                    {loading ? (isMagicLinkLogin ? 'Sending...' : 'Orchestrating...') : (isMagicLinkLogin ? 'Send Magic Link' : 'Sign In Now')}
                                    {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                                </span>
                            </button>
                        </form>
                    )}

                    <div className="mt-8 flex items-center gap-4">
                        <div className="h-px flex-1 bg-white/5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Or carry on with</span>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            onClick={() => setIsMagicLinkLogin(!isMagicLinkLogin)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/[0.08] border border-white/5 rounded-2xl transition-colors font-semibold text-sm">
                            <Sparkles size={18} className="text-amber-400" />
                            {isMagicLinkLogin ? 'Sign in with password instead' : 'Sign in with Magic Link'}
                        </button>
                    </div>

                    <p className="mt-10 text-center text-sm font-medium text-muted-foreground">
                        New to the orchestration?{' '}
                        <Link href="/signup" className="text-white hover:text-primary transition-colors font-bold underline decoration-primary/30 underline-offset-4">
                            Create your account
                        </Link>
                    </p>
                </div>

                <div className="mt-8 flex justify-center gap-8 text-xs font-bold uppercase tracking-widest text-muted-foreground/30">
                    <a href="#" className="hover:text-muted-foreground transition-colors">Documentation</a>
                    <a href="#" className="hover:text-muted-foreground transition-colors">Privacy</a>
                    <a href="#" className="hover:text-muted-foreground transition-colors">Terms</a>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LoginPageContent />
        </Suspense>
    );
}
