'use client';

import React, { useState } from 'react';
import {
    CreditCard, Wallet, Bot, Sparkles,
    Loader2, Rocket, ArrowRight, ArrowLeft,
    CircleDollarSign, Cpu, Binary, Gem
} from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface SurveyFeedbackWizardProps {
    onClose: () => void;
    plan?: 'Pro' | 'Enterprise';
}

type Step = 'protocol' | 'survey' | 'feedback' | 'success';

export default function SurveyFeedbackWizard({ onClose, plan }: SurveyFeedbackWizardProps) {
    const [step, setStep] = useState<Step>('protocol');
    const [surveyId, setSurveyId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const [pricingFeedback, setPricingFeedback] = useState<Record<string, 'good' | 'high' | 'low' | null>>({
        'Basic': 'good',
        'Premium': 'good',
        'Advanced': 'good',
        'Super': 'good',
        'Supreme': 'good'
    });
    const [rating, setRating] = useState(4);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const supabase = createClient();

    const syncData = async (isFinal = false) => {
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/upgrade-feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    id: surveyId,
                    plan_selected: plan,
                    payment_method: paymentMethod || 'unselected',
                    desired_plans: Object.entries(pricingFeedback).map(([name, val]) => ({ plan: name, feedback: val })),
                    rating,
                    comments: feedback
                })
            });

            if (res.ok) {
                const result = await res.json();
                if (result.data?.id) setSurveyId(result.data.id);
                if (isFinal) setStep('success');
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error('Sync failed:', errorData);
                if (isFinal) {
                    // Allow completion even if final sync fails but we have data? 
                    // No, let's alert but we've been syncing all along.
                    alert(`Neural transmission failed: ${errorData.message || 'Unknown error'}`);
                }
            }
        } catch (err) {
            console.error('Network error during sync:', err);
            if (isFinal) alert('Connection failed. Please check your network.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const nextStep = () => {
        syncData(); // Partial save on every continue
        if (step === 'protocol') setStep('survey');
        else if (step === 'survey') setStep('feedback');
    };

    const prevStep = () => {
        if (step === 'survey') setStep('protocol');
        else if (step === 'feedback') setStep('survey');
    };

    if (step === 'success') {
        return (
            <div className="flex flex-col items-center text-center p-12 space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="size-24 rounded-[2.5rem] bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400">
                    <Rocket size={48} className="animate-bounce" />
                </div>
                <div>
                    <h2 className="text-4xl font-black tracking-tighter mb-4 text-white">Thank You!</h2>
                    <p className="text-muted-foreground font-medium text-lg max-w-md mx-auto">
                        Your feedback helps us build a better platform. We appreciate you taking the time to share your thoughts!
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="px-10 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/90 transition-all active:scale-95 shadow-xl"
                >
                    Return to Cluster
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
            {/* Header */}
            <header>
                <div className="flex items-center justify-between mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                        <Sparkles size={14} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Quick Survey</span>
                    </div>
                </div>
                <h2 className="text-4xl font-black tracking-tighter text-white">
                    Help Us <span className="text-transparent bg-clip-text bg-gradient-unicorn">Improve</span>
                </h2>
                <p className="mt-4 text-muted-foreground font-medium">
                    Share your thoughts to help shape the future of the platform. Your feedback directly influences our roadmap.
                </p>
            </header>

            {/* Step Content */}
            <div className="glass-card rounded-[3rem] p-10 border border-white/5 relative overflow-hidden bg-white/[0.01]">
                {step === 'protocol' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white">Preferred Payment Method</h3>
                            <p className="text-sm text-muted-foreground">How would you prefer to pay for premium features?</p>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { id: 'card', label: 'Credit Card', icon: CreditCard },
                                { id: 'crypto', label: 'Crypto', icon: Wallet },
                                { id: 'usdc', label: 'USDC', icon: CircleDollarSign },
                                { id: 'eth', label: 'ETH', icon: Cpu },
                                { id: 'btc', label: 'BTC', icon: Binary },
                                { id: 'sol', label: 'Sol', icon: Gem }
                            ].map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id)}
                                    className={`p-6 rounded-3xl border transition-all text-left group relative overflow-hidden ${paymentMethod === method.id
                                        ? 'border-primary bg-primary/10'
                                        : 'border-white/5 bg-white/5 hover:border-white/10'
                                        }`}
                                >
                                    <div className={`size-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${paymentMethod === method.id ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground'
                                        }`}>
                                        <method.icon size={20} />
                                    </div>
                                    <div className="font-bold text-sm text-white mb-0.5">{method.label}</div>
                                    <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Protocol {method.id === 'card' ? 'Fiat' : 'Assets'}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'survey' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white">Pricing Feedback</h3>
                            <p className="text-sm text-muted-foreground">Help us understand your pricing expectations for these tiers.</p>
                        </div>
                        <div className="space-y-3">
                            {[
                                { name: 'Basic', price: 'Free' },
                                { name: 'Premium', price: '$9.99' },
                                { name: 'Advanced', price: '$59.99' },
                                { name: 'Super', price: '$99.99' },
                                { name: 'Supreme', price: '$199.99' }
                            ].map((p) => (
                                <div key={p.name} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/20 transition-all">
                                    <div className="flex flex-col">
                                        <span className="font-black text-xs uppercase tracking-widest text-primary">{p.name}</span>
                                        <span className="text-lg font-black text-white">{p.price}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'low', label: 'Too Low' },
                                            { id: 'good', label: 'Fair' },
                                            { id: 'high', label: 'Too High' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setPricingFeedback(prev => ({ ...prev, [p.name]: opt.id as 'good' | 'high' | 'low' }))}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${pricingFeedback[p.name] === opt.id
                                                    ? 'bg-primary text-white'
                                                    : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'feedback' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white">Additional Thoughts</h3>
                            <p className="text-sm text-muted-foreground">Share any other feedback or suggestions you have for us.</p>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-widest">Overall Experience Grade</label>
                            <div className="max-w-[328px]">
                                <div className="flex gap-3">
                                    {[1, 2, 3, 4, 5].map((val) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setRating(val)}
                                            className={`size-14 rounded-2xl flex items-center justify-center transition-all ${val <= rating
                                                ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/20'
                                                : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            <Bot size={28} />
                                        </button>
                                    ))}
                                </div>
                                <div className="flex justify-between px-1 mt-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">
                                    <span className="text-destructive">Poor</span>
                                    <span className="text-amber-400">Excellent</span>
                                </div>
                            </div>
                        </div>

                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            rows={4}
                            placeholder="Tell us everything. We read every transmission."
                            className="w-full bg-white/5 border border-white/5 rounded-2xl p-6 outline-none focus:border-primary/50 text-sm font-medium custom-scrollbar"
                        />
                    </div>
                )}

                {/* Footer Controls */}
                <div className="mt-12 flex items-center justify-between pt-8 border-t border-white/5">
                    {step !== 'protocol' ? (
                        <button
                            onClick={prevStep}
                            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex gap-4">
                        {step === 'feedback' ? (
                            <button
                                onClick={() => syncData(true)}
                                disabled={isSubmitting}
                                className="px-10 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-primary/90 active:scale-95 shadow-xl shadow-primary/20 flex items-center gap-3"
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                                {isSubmitting ? 'Syncing...' : 'Complete Application'}
                            </button>
                        ) : (
                            <button
                                onClick={nextStep}
                                disabled={isSubmitting}
                                className="px-10 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-white/90 active:scale-95 shadow-xl flex items-center gap-3 disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <>Continue <ArrowRight size={16} /></>}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <p className="text-center text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.3em]">
                Release Candidate Phase <span className="mx-2">|</span> Powered by AntiGravity Intelligence
            </p>
        </div>
    );
}
