'use client';

import React from 'react';
import { Key, Ghost, ShieldAlert, Sparkles } from 'lucide-react';

export function ManagedKeys() {
    return (
        <section className="py-24 bg-white/[0.02] border-y border-white/5">
            <div className="max-w-7xl mx-auto px-6 text-center">
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-8 animate-glow">
                        <Key size={40} className="text-primary" />
                    </div>

                    <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase">
                        ZERO KEY ANXIETY.
                    </h2>

                    <p className="text-lg md:text-xl text-muted-foreground font-medium">
                        Focus on building your agent&apos;s personality, not managing API keys. Our <span className="text-primary font-bold">Managed Provider Keys (MPK)</span> system handles the orchestration for you.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mt-16">
                        <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 glass-card">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <Sparkles className="text-purple-400" size={20} />
                            </div>
                            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Managed Leases</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                                Don&apos;t have an OpenAI or Claude key? No problem. Lease access through our shared provider pool and pay only for what you use. We handle rotation and limits.
                            </p>
                        </div>

                        <div className="p-8 rounded-[2rem] bg-white/5 border border-white/10 space-y-4 glass-card">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                <Ghost className="text-indigo-400" size={20} />
                            </div>
                            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">BYOK (Bring Your Own)</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                                Prefer your own billing? Simply drop your keys once. Our system securely injects them into your agent containers with zero leakage risk.
                            </p>
                        </div>
                    </div>

                    <div className="pt-12">
                        <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-primary text-sm font-bold uppercase tracking-widest glass-card">
                            <ShieldAlert size={18} className="animate-pulse" />
                            <span>Military Grade AES-256 Key Encryption</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
