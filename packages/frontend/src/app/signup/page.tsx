'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Bot, Sparkles, ArrowRight, Github, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name }
            }
        });

        if (error) {
            if (error.message.includes('User already registered')) {
                setError('A user with this email address already exists. Please try to sign in instead.');
            } else if (error.message.includes('Password should be at least 6 characters')) {
                setError('Password is too short. Please use at least 6 characters.');
            }
            else {
                setError(error.message);
            }
        } else {
            router.push('/login?message=Check your email to confirm your account');
        }
        setLoading(false);
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
            {/* Background Decorations */}
            <div className="absolute top-1/3 -right-20 w-80 h-80 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/3 -left-20 w-80 h-80 bg-pink-500/10 rounded-full blur-[120px] animate-pulse delay-700" />

            <div className="w-full max-w-lg relative z-10">
                <div className="glass-card rounded-[3rem] p-8 md:p-12 shadow-2xl border-white/5 bg-white/[0.02]">
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
                            Join the <span className="text-transparent bg-clip-text bg-gradient-unicorn text-glow">Future</span>
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg max-w-[320px]">
                            Scale your AI orchestration from solo agents to global clusters.
                        </p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-6">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="group">
                                <label className="block text-sm font-bold text-muted-foreground mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Elon Musk"
                                    className="w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 focus:border-primary/50 focus:bg-white/[0.08] outline-none transition-all duration-300 placeholder:text-muted-foreground/30 font-medium"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="group">
                                <label className="block text-sm font-bold text-muted-foreground mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    placeholder="your@email.com"
                                    className="w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 focus:border-primary/50 focus:bg-white/[0.08] outline-none transition-all duration-300 placeholder:text-muted-foreground/30 font-medium"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="group">
                                <label className="block text-sm font-bold text-muted-foreground mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                                    Secure Password
                                </label>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 focus:border-primary/50 focus:bg-white/[0.08] outline-none transition-all duration-300 placeholder:text-muted-foreground/30 font-medium"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <p className="text-[10px] text-muted-foreground/40 mt-2 ml-1 font-bold uppercase tracking-widest">At least 8 characters with 1 symbol</p>
                            </div>
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
                                {loading ? 'Orchestrating...' : 'Initialize Account'}
                                {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                            </span>
                        </button>
                    </form>

                    <div className="mt-8 flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/5">
                        <ShieldCheck size={18} className="text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">SOC2 Type II & GDPR Compliant Infrastructure</span>
                    </div>

                    <p className="mt-10 text-center text-sm font-medium text-muted-foreground">
                        Already part of the network?{' '}
                        <Link href="/login" className="text-white hover:text-primary transition-colors font-bold underline decoration-primary/30 underline-offset-4">
                            Secure sign in
                        </Link>
                    </p>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/20">Powered by Blankspace Agentic Intelligence</p>
                </div>
            </div>
        </div>
    );
}
