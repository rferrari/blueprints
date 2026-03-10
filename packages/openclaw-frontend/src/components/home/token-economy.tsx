'use client';

import React from 'react';
import { Coins, TrendingUp, Wallet, ArrowUpRight, BarChart3, Database } from 'lucide-react';

export function TokenEconomy() {
    return (
        <section className="py-24 bg-background relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[150px] -z-10" />

            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase">
                        AGENT ECONOMY 2.0
                    </h2>
                    <p className="text-muted-foreground font-medium max-w-2xl mx-auto">
                        Power your agents with a dual-token system designed for scalability, yield, and fair usage.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
                    {/* Platform Token: BLUE */}
                    <div className="p-8 rounded-[3rem] bg-white/[0.03] border border-white/10 hover:border-primary/40 transition-all group">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30 group-hover:scale-110 transition-transform">
                                    <Coins size={32} className="text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">BLUEPRINT (BLUE)</h3>
                                    <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em] leading-none mt-1">Platform Governance Asset</p>
                                </div>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
                                <TrendingUp size={12} className="text-green-400" />
                                <span className="text-[10px] font-black tracking-widest">+12.4%</span>
                            </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-8 font-medium leading-relaxed">
                            The capital asset of Blueprints. Stake $BLUE to receive daily usage credits, unlock higher security tiers, or participate in governance.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Price (Est.)</p>
                                <p className="text-xl font-black">$4.82</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Market Cap</p>
                                <p className="text-xl font-black">$18.2M</p>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-2">
                            <span className="px-3 py-1 rounded-lg bg-primary/10 text-[10px] font-black uppercase tracking-widest text-primary border border-primary/20">Stake for Yield</span>
                            <span className="px-3 py-1 rounded-lg bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 border border-white/10 hover:text-white/80 transition-colors cursor-pointer">Mint Credits</span>
                        </div>
                    </div>

                    {/* Usage Token: CREDIT */}
                    <div className="p-8 rounded-[3rem] bg-white/[0.03] border border-white/10 hover:border-blue-400/40 transition-all group">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform">
                                    <Database size={32} className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">CREDITS (CRD)</h3>
                                    <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em] leading-none mt-1">Computational Energy</p>
                                </div>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-2 text-white/40">
                                <Wallet size={12} />
                                <span className="text-[10px] font-black tracking-widest underline underline-offset-4 decoration-primary cursor-pointer">Recharge</span>
                            </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-8 font-medium leading-relaxed">
                            CREDITS power every AI inference on the platform. $1 CRD equals approximately 1 day of base agent operations. Non-speculative, utility-first value.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">Status</p>
                                <p className="text-xl font-black">STABLE</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">24h Usage</p>
                                <p className="text-xl font-black">2.4M Units</p>
                            </div>
                        </div>

                        <ul className="mt-8 space-y-2">
                            <li className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <span>Earned daily via $BLUE Staking</span>
                            </li>
                            <li className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <span>Direct Pay-as-you-go purchase</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Combined Stats Banner */}
                <div className="p-8 rounded-[2rem] bg-gradient-to-r from-primary/10 via-background to-blue-500/10 border border-white/5 flex flex-wrap justify-center gap-12 md:gap-24 grayscale group-hover:grayscale-0 transition-all">
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Staked</p>
                        <p className="text-2xl font-black tracking-tighter italic">42.5M BLUE</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Monthly Active Agents</p>
                        <p className="text-2xl font-black tracking-tighter italic">12,842</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">API Throughput</p>
                        <p className="text-2xl font-black tracking-tighter italic">1.2B TKN/D</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
