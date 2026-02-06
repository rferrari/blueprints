'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase';
import { Bot, Sparkles, ArrowRight, Github, X } from 'lucide-react';
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
                    <div className="absolute top-6 right-6 z-20">
                        <Link href="/" className="p-2 text-muted-foreground/50 hover:text-white transition-colors rounded-xl hover:bg-white/5 block">
                            <X size={24} />
                        </Link>
                    </div>

                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="size-16 rounded-2xl bg-gradient-unicorn p-0.5 shadow-lg shadow-primary/20 mb-6 group animate-glow">
                            <div className="w-full h-full bg-background rounded-[calc(1rem-2px)] flex items-center justify-center">
                                <Bot size={32} className="text-white group-hover:scale-110 transition-transform duration-300" />
                            </div>
                        </div>
                        <h1 className="text-4xl font-black tracking-tight mb-3">
                            Blue<span className="text-transparent bg-clip-text bg-gradient-unicorn">prints</span>
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
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
                                className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/[0.08] border border-white/5 rounded-2xl transition-all active:scale-95 group"
                            >
                                <svg className="size-5 grayscale group-hover:grayscale-0 transition-all opacity-60 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4" /><path d="M12.24 24.0008C15.4765 24.0008 18.2059 22.9382 20.1945 21.1039L16.3275 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.24 24.0008Z" fill="#34A853" /><path d="M5.50253 14.3003C5.00236 12.8099 5.00236 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z" fill="#FBBC05" /><path d="M12.24 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.24 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.24 4.74966Z" fill="#EA4335" /></svg>
                                <span className="text-xs font-bold text-muted-foreground group-hover:text-white transition-colors">Google</span>
                            </button>
                            <button
                                onClick={() => supabase.auth.signInWithOAuth({ provider: 'github' })}
                                className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/[0.08] border border-white/5 rounded-2xl transition-all active:scale-95 group"
                            >
                                <Github size={18} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                                <span className="text-xs font-bold text-muted-foreground group-hover:text-white transition-colors">GitHub</span>
                            </button>
                        </div>
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
