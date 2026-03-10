'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const benefits = [
    'Complete Data Ownership',
    'Runs 24/7 Autonomously',
    'No Usage Restrictions',
    'Single Monthly VPS Fee',
    'Full Privacy & Security',
    'Active Developer Community'
];

export function ValueProp() {
    return (
        <section className="py-24 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8">
                        <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase">
                            Why Self-Host?
                        </h2>
                        <p className="text-lg text-muted-foreground font-medium max-w-xl">
                            Stop sending your sensitive data to third-party clouds. Bring the brain to your home turf and enjoy a set of unique advantages.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {benefits.map((benefit, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                        <CheckCircle2 size={14} className="text-primary" />
                                    </div>
                                    <span className="text-sm font-bold uppercase tracking-wider">{benefit}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 relative">
                        <div className="aspect-square w-full max-w-[500px] mx-auto rounded-[3rem] bg-gradient-unicorn opacity-10 blur-[80px] absolute inset-0 animate-pulse" />
                        <div className="relative p-8 rounded-[3rem] bg-white/5 border border-white/10 backdrop-blur-2xl">
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-400">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-sm uppercase tracking-widest">Self-Hosted</h4>
                                        <p className="text-xs text-muted-foreground font-medium">Full Control Enabled</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="h-4 w-full bg-white/5 rounded-full" />
                                    <div className="h-4 w-3/4 bg-white/5 rounded-full" />
                                    <div className="h-4 w-1/2 bg-white/5 rounded-full" />
                                </div>
                                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                                    <p className="text-xs text-primary font-bold uppercase tracking-widest text-center">
                                        Assistant Status: ACTIVE
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
