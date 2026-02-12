'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase';
import {
    Bot,
    Sparkles,
    ArrowRight,
    Zap,
    Shield,
    Cpu,
    Globe,
    MessageSquare,
    ChevronRight,
    Star,
    Check,
    RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotification } from '@/components/notification-provider';

export default function LandingPage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showNotification } = useNotification();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                router.push('/dashboard');
            } else {
                setUser(null);
                setLoading(false);
            }
        };
        checkUser();
    }, [supabase, router]);

    useEffect(() => {
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
            const message = errorDescription
                ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
                : 'An authentication error occurred.';
            showNotification(message, 'error', 'Authentication Failed');

            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, [searchParams, showNotification]);

    const FeatureCard = ({ icon: Icon, title, description, delay }: any) => (
        <div
            className="glass-card rounded-[2.5rem] p-8 border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-500 group animate-in fade-in slide-in-from-bottom-8"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="size-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-500">
                <Icon size={28} className="text-primary group-hover:scale-110 transition-transform duration-500" />
            </div>
            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-muted-foreground leading-relaxed text-sm font-medium">{description}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-background relative overflow-hidden selection:bg-primary/30">
            {/* Background Decorations */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] translate-y-1/2 animate-pulse delay-1000" />


            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/50 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-gradient-unicorn p-0.5 shadow-lg shadow-primary/20">
                            <div className="w-full h-full bg-background rounded-[calc(0.75rem-2px)] flex items-center justify-center">
                                <Bot size={20} className="text-white" />
                            </div>
                        </div>
                        <span className="text-xl font-black tracking-tighter uppercase hidden md:block">Blue<span className="text-primary">prints</span></span>
                    </div>

                    <div className="flex items-center gap-8">
                        <div className="hidden md:flex items-center gap-6 text-sm font-bold text-muted-foreground uppercase tracking-widest">
                            <a href="#features" className="hover:text-white transition-colors">Infrastructure</a>
                            <a href="#plans" className="hover:text-white transition-colors">Plans</a>
                        </div>
                        {loading ? (
                            <div className="size-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        ) : user ? (
                            <Link
                                href="/dashboard"
                                className="px-6 py-2.5 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 shadow-xl shadow-white/10"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <div className="flex items-center gap-3 md:gap-4">
                                <Link href="/login" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors">
                                    <span className="hidden md:inline">Sign In</span>
                                    <span className="md:hidden"><Zap size={20} /></span>
                                </Link>
                                <Link
                                    href="/signup"
                                    className="px-4 md:px-6 py-2.5 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 shadow-xl shadow-primary/20 flex items-center gap-2"
                                >
                                    <span className="hidden md:inline">Get Started</span>
                                    <span className="md:hidden"><Sparkles size={18} /></span>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-48 pb-32 px-6">
                <div className="max-w-5xl mx-auto text-center relative">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Sparkles size={14} className="text-amber-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Next-Gen Multi-Agent Orchestrator</span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        Agentic Intelligence <br />
                        <span className="text-transparent bg-clip-text bg-gradient-unicorn">Redefined.</span>
                    </h1>

                    <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        Deploy, manage, and orchestrate autonomous AI clusters with enterprise-grade precision.
                        Bring your agents to life in seconds.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <Link
                            href={user ? "/dashboard" : "/signup"}
                            className="w-full sm:w-auto px-10 py-5 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3"
                        >
                            {user ? 'Launch Dashboard' : 'Deploy Your First Agent'}
                            <ArrowRight size={18} />
                        </Link>
                        <a
                            href="#features"
                            className="w-full sm:w-auto px-10 py-5 glass border border-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            View Blueprint
                        </a>
                    </div>
                </div>
            </section>

            {/* Powered By Section */}
            <div className="py-12 border-y border-white/5 bg-white/[0.02]">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-8">Powering the Next Generation of AI Agents</p>
                    <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded bg-white text-black flex items-center justify-center font-bold text-xs">EO</div>
                            <span className="font-bold text-lg text-white">ElizaOS</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded bg-blue-500 flex items-center justify-center text-white">
                                <Zap size={16} fill="currentColor" />
                            </div>
                            <span className="font-bold text-lg text-white">OpenClaw</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded bg-purple-500 flex items-center justify-center text-white">
                                <Bot size={16} />
                            </div>
                            <span className="font-bold text-lg text-white">Blueprints Engine</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Grid */}
            <section id="features" className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <h2 className="text-4xl font-black tracking-tighter mb-4">Core Infrastructure</h2>
                        <p className="text-muted-foreground font-medium">Built for scale, designed for performance.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={Zap}
                            title="Instant Deployment"
                            description="From blueprint to execution in under 60 seconds. Our automated pipeline handles the heavy lifting."
                            delay={100}
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Multi-Tenant Isolation"
                            description="Compute resources and memory contexts are cryptographically isolated for maximum security."
                            delay={200}
                        />
                        <FeatureCard
                            icon={RefreshCw}
                            title="Zero-Downtime Clusters"
                            description="Hot-reload capabilities allow adding, removing, or updating agents instantly without restarting containers."
                            delay={300}
                        />
                        <FeatureCard
                            icon={Globe}
                            title="Connectors"
                            description="Native integrations with Discord, Telegram, X, and Farcaster right out of the box."
                            delay={400}
                        />
                        <FeatureCard
                            icon={MessageSquare}
                            title="Neural Link"
                            description="High-performance chat interface for direct communication with your autonomous cluster."
                            delay={500}
                        />
                        <FeatureCard
                            icon={Star}
                            title="Tiered Ecosystem"
                            description="Scale from a single free agent to a massive enterprise cluster with granular control."
                            delay={600}
                        />
                    </div>
                </div>
            </section>

            {/* Plans Section */}
            <section id="plans" className="py-32 px-6 border-t border-white/5 bg-white/[0.02]">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-24">
                        <h2 className="text-4xl font-black tracking-tighter mb-4">Scalable Plans</h2>
                        <p className="text-muted-foreground font-medium">Choose the perfect tier for your operations.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Free Tier */}
                        <div className="glass-card rounded-[2.5rem] p-8 md:p-12 border-white/5 flex flex-col relative overflow-hidden group hover:border-white/10 transition-colors">
                            <h3 className="text-xl font-bold mb-2">Starter</h3>
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-black tracking-tighter">$0</span>
                                <span className="text-muted-foreground font-medium text-sm">/month</span>
                            </div>
                            <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-8">Perfect for experimenting with autonomous agents.</p>

                            <ul className="space-y-4 mb-10 flex-1">
                                <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                                    <Check size={16} className="text-white" /> 1 Active Agent
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                                    <Check size={16} className="text-white" /> Community Support
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                                    <Check size={16} className="text-white" /> Basic Plugins
                                </li>
                            </ul>

                            <Link href="/signup" className="w-full py-4 text-center rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all">
                                Get Started
                            </Link>
                        </div>

                        {/* Pro Tier */}
                        <div className="glass-card rounded-[2.5rem] p-8 md:p-12 border-primary/20 bg-primary/5 flex flex-col relative overflow-hidden group hover:border-primary/40 transition-colors">
                            <div className="absolute top-0 right-0 px-6 py-2 bg-gradient-unicorn text-[10px] font-black uppercase tracking-widest text-white rounded-bl-2xl">
                                Most Popular
                            </div>
                            <h3 className="text-xl font-bold mb-2 text-white">Pro</h3>
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-black tracking-tighter">$29</span>
                                <span className="text-muted-foreground font-medium text-sm">/month</span>
                            </div>
                            <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-8">For power users building complex swarms.</p>

                            <ul className="space-y-4 mb-10 flex-1">
                                <li className="flex items-center gap-3 text-sm font-bold text-white">
                                    <Check size={16} className="text-primary" /> 10 Active Agents
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-white">
                                    <Check size={16} className="text-primary" /> Priority Support
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-white">
                                    <Check size={16} className="text-primary" /> All Pro Plugins
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-white">
                                    <Check size={16} className="text-primary" /> Early Access Features
                                </li>
                            </ul>

                            <button className="w-full py-4 relative group overflow-hidden rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary/20">
                                <div className="absolute inset-0 bg-gradient-unicorn opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <span className="relative">Upgrade Now</span>
                            </button>
                        </div>

                        {/* Enterprise Tier */}
                        <div className="glass-card rounded-[2.5rem] p-8 md:p-12 border-white/5 flex flex-col relative overflow-hidden group hover:border-white/10 transition-colors">
                            <h3 className="text-xl font-bold mb-2">Enterprise</h3>
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-black tracking-tighter">Custom</span>
                            </div>
                            <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-8">Dedicated infrastructure for global scale.</p>

                            <ul className="space-y-4 mb-10 flex-1">
                                <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                                    <Check size={16} className="text-white" /> Unlimited Agents
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                                    <Check size={16} className="text-white" /> Private Cloud VPC
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                                    <Check size={16} className="text-white" /> 24/7 Dedicated Support
                                </li>
                                <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                                    <Check size={16} className="text-white" /> Custom SLAs
                                </li>
                            </ul>

                            <a href="mailto:sales@blankspace.ai" className="w-full py-4 text-center rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all">
                                Contact Sales
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-48 px-6">
                <div className="max-w-4xl mx-auto relative">
                    <div className="glass-card rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
                        {/* Inner Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 pointer-events-none" />

                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-8 relative z-10">
                            Ready to orchestrate <br />
                            the future?
                        </h2>

                        <p className="text-lg text-muted-foreground font-medium mb-12 max-w-lg mx-auto relative z-10">
                            Join the growing ecosystem of autonomous agent managers and scale your AI workflows today.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
                            <Link
                                href={user ? "/dashboard" : "/signup"}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-12 py-6 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 shadow-2xl shadow-primary/20 group"
                            >
                                {user ? 'Enter Dashboard' : 'Initialize Your Cluster'}
                                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link
                                href="/contact"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-12 py-6 glass border border-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95 group"
                            >
                                <MessageSquare size={18} />
                                Talk with our Agent
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3 opacity-50">
                        <Bot size={24} />
                        <span className="text-lg font-black tracking-tighter uppercase">Blue<span className="text-primary">prints</span></span>
                    </div>

                    <div className="flex gap-12 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        <Link href="/documentation" className="hover:text-white transition-colors">Documentation</Link>
                        <Link href="/infrastructure" className="hover:text-white transition-colors">Infrastructure</Link>
                        <Link href="/terms" className="hover:text-white transition-colors">Terms of Phase</Link>
                    </div>

                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-30">
                        &copy; 2026 Blueprints Manager Cluster. Powered by Blankspace
                    </p>
                </div>
            </footer>
        </div>
    );
}
