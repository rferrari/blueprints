'use client';

import React from 'react';
import { ShieldCheck, Cloud, RefreshCw, Lock } from 'lucide-react';

const tiers = [
    {
        name: 'Standard',
        desc: 'Workspace-only access. Equivalent to a secure sandbox.',
        features: ['Jailed environment', 'Root-only FS', 'Non-root user']
    },
    {
        name: 'Pro',
        desc: 'Advanced observability for agent builders.',
        features: ['SYS_ADMIN cap', 'Observability enabled', 'Diagnostic grade']
    },
    {
        name: 'Advanced',
        desc: 'Full container control for enterprise automation.',
        features: ['Root access', 'NET_ADMIN cap', 'Read/Write / access']
    }
];

export function ManagedInfra() {
    return (
        <section className="py-24 bg-background relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col lg:flex-row gap-16 items-center">
                    <div className="flex-1 space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-widest">
                            <ShieldCheck size={14} />
                            <span>Expertly Managed</span>
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase leading-none">
                            WE HANDLE THE INFRA,<br />YOU HANDLE THE GENIUS.
                        </h2>
                        <p className="text-lg text-muted-foreground font-medium max-w-xl">
                            Stop wasting time on Docker configs, volume permissions, and security patches. Our team manages the entire orchestration layer so your Blueprints are always ready.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <Cloud className="text-primary mt-1" size={24} />
                                <div>
                                    <h4 className="font-bold uppercase tracking-wider text-sm">Always-On Hosting</h4>
                                    <p className="text-xs text-muted-foreground">Your agents run 24/7 on high-performance nodes with automated scaling.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <RefreshCw className="text-primary mt-1" size={24} />
                                <div>
                                    <h4 className="font-bold uppercase tracking-wider text-sm">Automated Updates</h4>
                                    <p className="text-xs text-muted-foreground">Get the latest ElizaOS and Blueprints framework updates pushed seamlessly.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 gap-4">
                        {tiers.map((tier, i) => (
                            <div key={i} className="p-6 rounded-3xl glass-card relative group overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Lock size={64} />
                                </div>
                                <h3 className="text-xl font-black uppercase tracking-tighter italic mb-2">{tier.name}</h3>
                                <p className="text-sm text-muted-foreground mb-4 font-medium">{tier.desc}</p>
                                <div className="flex flex-wrap gap-2">
                                    {tier.features.map((f, j) => (
                                        <span key={j} className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-black uppercase tracking-widest text-primary/80">
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
