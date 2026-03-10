'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Terminal, Globe, Award, Zap, Shield, Users } from 'lucide-react';
import { AnimatedBackground } from '@/components/home/animated-background';
import { Footer } from '@/components/home/footer';

export default function AboutPage() {
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

            <main className="flex-1 pt-32 pb-20 relative overflow-hidden">
                <AnimatedBackground />

                <div className="max-w-4xl mx-auto px-6 relative z-10 font-inter">
                    <div className="space-y-12">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
                                <Globe size={14} />
                                <span>Part of blank.space</span>
                            </div>
                            <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic uppercase text-glow">
                                BEYOND THE<br />INTERFACE.
                            </h1>
                            <p className="text-xl text-muted-foreground font-medium leading-relaxed">
                                Blueprints is more than just a platform; it&apos;s the culmination of a decade of engineering excellence at the intersection of decentralization and artificial intelligence.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 glass-card">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                    <Award className="text-indigo-400" size={24} />
                                </div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter">10+ Years of Blockchain</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                                    Our team has been building in the Web3 space since the early days of Ethereum. We understand the nuances of non-custodial systems, sovereign identity, and decentralized compute.
                                </p>
                            </div>

                            <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 glass-card">
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                                    <Zap className="text-purple-400" size={24} />
                                </div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter">AI Pioneers</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                                    From early transformer models to the latest agentic frameworks, we&apos;ve been integrating intelligent systems into production environments for over a decade.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-8 py-12 border-y border-white/5">
                            <h2 className="text-3xl font-black italic uppercase tracking-tighter">THE BLANK.SPACE VISION</h2>
                            <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                                As part of the <a href="https://blank.space" target="_blank" className="text-primary hover:underline underline-offset-4">blank.space</a> ecosystem, Blueprints shares a singular mission: to provide the infrastructure for a sovereign future. We believe that AI should be personal, private, and powerful.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
                                    <Users size={16} className="text-muted-foreground" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Global Team</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
                                    <Shield size={16} className="text-muted-foreground" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Privacy First</span>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5">
                                    <Terminal size={16} className="text-muted-foreground" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Dev Focused</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-center pt-12 pb-20">
                            <p className="text-sm text-muted-foreground mb-8 font-medium italic">
                                &quot;We don&apos;t just build products; we build blueprints for the next era of human-machine collaboration.&quot;
                            </p>
                            <a
                                href="https://github.com/blankdotspace/"
                                target="_blank"
                                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Explorer Github
                            </a>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
