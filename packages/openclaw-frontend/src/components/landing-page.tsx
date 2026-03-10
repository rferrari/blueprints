'use client';

import React from 'react';
import { Hero } from './home/hero';
import { Features } from './home/features';
import { ValueProp } from './home/value-prop';
import { ManagedInfra } from './home/managed-infra';
import { ManagedKeys } from './home/managed-keys';
import { TokenEconomy } from './home/token-economy';
import { FAQ } from './home/faq';
import { Footer } from './home/footer';
import Link from 'next/link';
import { Terminal } from 'lucide-react';

export function LandingPage() {
    return (
        <div className="min-h-screen bg-background selection:bg-primary/30">
            {/* Header / Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Terminal size={18} className="text-primary" />
                        </div>
                        <span className="text-lg font-black tracking-tighter italic uppercase">Blueprints</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-xs font-black uppercase tracking-widest hover:text-primary transition-colors">Features</a>
                        <Link href="/about" className="text-xs font-black uppercase tracking-widest hover:text-primary transition-colors">About</Link>
                        <a href="#faq" className="text-xs font-black uppercase tracking-widest hover:text-primary transition-colors">FAQ</a>
                    </nav>

                    <div className="flex items-center gap-4">
                        <Link href="/login" className="text-xs font-black uppercase tracking-widest hover:text-primary transition-colors">
                            Sign In
                        </Link>
                        <Link
                            href="/signup"
                            className="hidden sm:block px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                <Hero />
                <div id="features"><Features /></div>
                <ManagedInfra />
                <ManagedKeys />
                <TokenEconomy />
                <div id="about"><ValueProp /></div>
                <div id="faq"><FAQ /></div>
            </main>

            <Footer />
        </div>
    );
}
