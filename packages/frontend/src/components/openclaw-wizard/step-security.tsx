'use client';

import React from 'react';
import { UserTier, SecurityLevel, resolveSecurityLevel } from '@eliza-manager/shared';
import { Shield, Lock, Unlock, Check, ShieldCheck } from 'lucide-react';

interface StepSecurityProps {
    tier: UserTier;
    securityLevel: SecurityLevel;
    setSecurityLevel: (level: SecurityLevel) => void;
    name: string;
}

export function StepSecurity({ tier, securityLevel, setSecurityLevel, name }: StepSecurityProps) {
    return (
        <div className="space-y-6">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                Configure the operating privileges for **{name}**. Higher levels require higher User Tiers.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    {
                        level: SecurityLevel.STANDARD,
                        title: 'Standard',
                        icon: <Shield size={24} className="text-green-400" />,
                        desc: 'Workspace access and read-only system.'
                    },
                    {
                        level: SecurityLevel.PRO,
                        title: 'Professional',
                        icon: <Lock size={24} className="text-amber-400" />,
                        desc: 'Read-only system access with limited privileges.'
                    },
                    {
                        level: SecurityLevel.ADVANCED,
                        title: 'Advanced',
                        icon: <Unlock size={24} className="text-red-500" />,
                        desc: 'Full container access with elevated privileges.'
                    }
                ].map((opt) => {
                    const allowed = resolveSecurityLevel(tier, opt.level) === opt.level;
                    const isSelected = securityLevel === opt.level;

                    return (
                        <button
                            key={opt.level}
                            onClick={() => allowed && setSecurityLevel(opt.level)}
                            disabled={!allowed}
                            className={`p-6 rounded-3xl border text-left transition-all flex flex-col gap-4 relative overflow-hidden ${isSelected
                                ? 'border-primary bg-primary/10 ring-4 ring-primary/10'
                                : allowed
                                    ? 'border-white/5 bg-white/5 hover:border-white/10'
                                    : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                                }`}
                        >
                            <div className="flex justify-between items-start w-full">
                                <div className="p-3 rounded-2xl bg-white/5">
                                    {opt.icon}
                                </div>
                                {isSelected && <div className="text-primary"><Check size={20} /></div>}
                                {!allowed && <div className="text-muted-foreground px-2 py-1 rounded bg-white/5 text-[10px] font-black uppercase">Locked</div>}
                            </div>
                            <div>
                                <h4 className="font-black text-sm uppercase tracking-widest mb-2">{opt.title}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium flex gap-3 items-center">
                <ShieldCheck size={16} />
                <span>
                    Your current tier is <strong>{tier.toUpperCase()}</strong>.
                    {tier === 'free' && " Upgrade to Pro for Privileged access."}
                </span>
            </div>
        </div>
    );
}
