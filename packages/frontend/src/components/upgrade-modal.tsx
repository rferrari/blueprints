'use client';

import React, { useState } from 'react';
import { Check, Shield, Sparkles, Rocket } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlan?: string;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
    const [applyingPlan, setApplyingPlan] = useState<'Pro' | 'Enterprise' | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const supabase = createClient();

    if (!isOpen) return null;

    const handleApply = async (plan: 'Pro' | 'Enterprise') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Save to upgrade_feedback table
            await supabase.from('upgrade_feedback').insert({
                user_id: user.id,
                plan: plan.toLowerCase(),
                payment_method: 'waitlist', // Default for now
            });

            setApplyingPlan(plan);
            setShowSuccess(true);
        } catch (error) {
            console.error('Failed to save upgrade application:', error);
            // Still show success to user
            setApplyingPlan(plan);
            setShowSuccess(true);
        }
    };

    const handleClose = () => {
        setShowSuccess(false);
        setApplyingPlan(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={onClose} />

            <div className="relative w-full max-w-5xl glass-card rounded-[3rem] p-8 md:p-12 shadow-2xl border-white/5 bg-white/[0.02] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                        <Sparkles size={14} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Upgrade Your Capacity</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">Choose Your Power Source</h2>
                    <p className="text-muted-foreground font-medium max-w-lg mx-auto">
                        Scale your agent infrastructure with dedicated compute and priority support.
                    </p>
                </div>

                {showSuccess ? (
                    <div className="flex flex-col items-center text-center p-8 space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="size-20 rounded-[2rem] bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400">
                            <Rocket size={40} className="animate-bounce" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tighter mb-3 text-white">You're on the Waitlist!</h2>
                            <p className="text-muted-foreground font-medium max-w-md mx-auto">
                                Thank you for your interest in <span className="text-primary font-bold">{applyingPlan}</span> tier.
                                Our team will contact you soon via email to discuss your upgrade.
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="px-8 py-3 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 shadow-xl"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Starter */}
                        <div className="p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] flex flex-col relative overflow-hidden group hover:border-white/10 transition-colors">
                            <h3 className="text-xl font-bold mb-2">Starter</h3>
                            <div className="mb-6"><span className="text-3xl font-black">Free</span></div>
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-sm font-medium text-muted-foreground"><Check size={16} className="text-white" /> 1 Active Agent</li>
                                <li className="flex items-center gap-3 text-sm font-medium text-muted-foreground"><Check size={16} className="text-white" /> Shared Compute</li>
                                <li className="flex items-center gap-3 text-sm font-medium text-muted-foreground"><Check size={16} className="text-white" /> Community Support</li>
                            </ul>
                            <button className="w-full py-4 rounded-xl border border-white/10 font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-colors cursor-default opacity-50">Current Plan</button>
                        </div>

                        {/* Pro */}
                        <div className="p-8 rounded-[2rem] border border-primary/50 bg-primary/5 flex flex-col relative overflow-hidden ring-4 ring-primary/10">
                            <div className="absolute top-0 right-0 bg-primary px-4 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest text-white">Popular</div>
                            <h3 className="text-xl font-bold mb-2 text-white">Pro</h3>
                            <div className="mb-6"><span className="text-3xl font-black">$29</span><span className="text-sm font-bold text-muted-foreground">/mo</span></div>
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-sm font-bold text-white"><Check size={16} className="text-primary" /> 10 Active Agents</li>
                                <li className="flex items-center gap-3 text-sm font-bold text-white"><Check size={16} className="text-primary" /> 4GB Neural Memory</li>
                                <li className="flex items-center gap-3 text-sm font-bold text-white"><Check size={16} className="text-primary" /> Priority Processing</li>
                                <li className="flex items-center gap-3 text-sm font-bold text-white"><Check size={16} className="text-primary" /> Email Support</li>
                            </ul>
                            <button
                                onClick={() => handleApply('Pro')}
                                className="w-full py-4 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                            >
                                Apply Now
                            </button>
                        </div>

                        {/* Enterprise */}
                        <div className="p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] flex flex-col relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                            <h3 className="text-xl font-bold mb-2">Enterprise</h3>
                            <div className="mb-6"><span className="text-3xl font-black">Custom</span></div>
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-sm font-medium text-muted-foreground"><Shield size={16} className="text-purple-400" /> Unlimited Agents</li>
                                <li className="flex items-center gap-3 text-sm font-medium text-muted-foreground"><Shield size={16} className="text-purple-400" /> Isolated VPC</li>
                                <li className="flex items-center gap-3 text-sm font-medium text-muted-foreground"><Shield size={16} className="text-purple-400" /> Custom Models</li>
                                <li className="flex items-center gap-3 text-sm font-medium text-muted-foreground"><Shield size={16} className="text-purple-400" /> 24/7 SLA</li>
                            </ul>
                            <button
                                onClick={() => handleApply('Enterprise')}
                                className="w-full py-4 rounded-xl border border-white/10 font-bold text-xs uppercase tracking-widest hover:bg-white text-black transition-all"
                            >
                                Contact Sales
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <button onClick={handleClose} className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-white transition-colors">Dismiss</button>
                </div>
            </div>
        </div>
    );
}
