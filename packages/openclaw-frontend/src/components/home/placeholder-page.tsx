'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Construction, Terminal } from 'lucide-react';
import { AnimatedBackground } from '@/components/home/animated-background';
import { Footer } from '@/components/home/footer';

export default function PlaceholderPage({ title = "Coming Soon" }: { title?: string }) {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <Terminal size={20} className="text-primary" />
                        </div>
                        <span className="text-xl font-black tracking-tighter italic uppercase">Blueprints</span>
                    </Link>
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Back to Home
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center pt-40 p-6 relative overflow-hidden">
                <AnimatedBackground />

                <div className="text-center space-y-8 relative z-10 w-full max-w-2xl mx-auto">
                    <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto animate-bounce">
                        <Construction size={48} className="text-primary" />
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic uppercase text-glow">
                        {title}
                    </h1>

                    <p className="text-xl text-muted-foreground font-medium max-w-md mx-auto">
                        We&apos;re currently building this section of the Blueprints ecosystem. Stay tuned for updates!
                    </p>

                    <div className="pt-8">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Back to Home
                        </Link>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
