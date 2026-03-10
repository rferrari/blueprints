'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Zap, Shield } from 'lucide-react';
import { AnimatedBackground } from './animated-background';

export function Hero() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden min-h-[80vh] flex items-center justify-center">
            <AnimatedBackground />

            <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <Bot size={14} />
                    <span>The Ultimate Agent Launchpad</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100 italic text-glow">
                    DEDICATED BLUEPRINTS.<br />AUTONOMOUS POWER.
                </h1>

                <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-10 font-medium animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    The alpha launchpad for high-performance AI agents. Deploy pre-configured Blueprints in seconds, manage with a professional-grade terminal, and scale effortlessly.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
                    <Link
                        href="/signup"
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        Start Free <ArrowRight size={18} />
                    </Link>
                    <Link
                        href="/login"
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-white font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        Sign In
                    </Link>
                </div>

                {/* Trust badges/Metrics */}
                <div className="mt-20 grid grid-cols-2 md:grid-cols-3 gap-8 max-w-4xl mx-auto opacity-50 grayscale animate-in fade-in duration-1000 delay-500">
                    <div className="flex flex-col items-center gap-2">
                        <Zap size={24} />
                        <span className="text-xs font-bold uppercase tracking-widest">Ultra Fast</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <Shield size={24} />
                        <span className="text-xs font-bold uppercase tracking-widest">Self-Hosted</span>
                    </div>
                    <div className="hidden md:flex flex-col items-center gap-2">
                        <Bot size={24} />
                        <span className="text-xs font-bold uppercase tracking-widest">50+ Tools</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
