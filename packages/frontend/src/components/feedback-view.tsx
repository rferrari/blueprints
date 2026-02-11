'use client';

import React, { useState } from 'react';
import { Bot, Sparkles, Send, Loader2, Zap, MessageSquare, Rocket } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import SurveyFeedbackWizard from './survey-feedback-wizard';

export default function FeedbackView() {
    const [rating, setRating] = useState(4);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showSurvey, setShowSurvey] = useState(false);
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ rating, comment: feedback })
            });

            if (res.ok) {
                setSubmitted(true);
            } else {
                const errorData = await res.json().catch(() => ({}));
                alert(`Neutral link failed: ${errorData.message || 'Transmission error'}`);
            }
        } catch (err) {
            console.error(err);
            alert('Connection failed. Please check your network.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (showSurvey) {
        return (
            <SurveyFeedbackWizard
                onClose={() => {
                    setShowSurvey(false);
                    setSubmitted(false);
                    setRating(4);
                    setFeedback('');
                }}
            />
        );
    }

    if (submitted) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="size-24 rounded-[2.5rem] bg-green-500/20 flex items-center justify-center border border-green-500/30 text-green-400 mb-8">
                    <Rocket size={48} className="animate-bounce" />
                </div>
                <h2 className="text-4xl font-black tracking-tighter mb-4 text-center">Protocol Complete</h2>
                <p className="text-muted-foreground font-medium text-lg max-w-md mx-auto text-center">
                    Your feedback has been assimilated into our core intelligence. Thank you for shaping the future.
                </p>
                <button
                    onClick={() => setShowSurvey(true)}
                    className="mt-10 px-10 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                    Quick Survey
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            {/* Feedback Hero - Matching Marketplace Style */}
            <div className="relative p-10 rounded-[3rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-white/5 overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <MessageSquare size={160} />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">Neural Feedback</span>
                    </div>
                    <h2 className="text-4xl font-black tracking-tight mb-4">Share Your <span className="text-transparent bg-clip-text bg-gradient-unicorn">Experience</span></h2>
                    <p className="text-muted-foreground font-medium text-lg">Help us improve the platform by sharing your thoughts and experiences.</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto">
                <div className="glass-card rounded-[3rem] p-10 md:p-16 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5">
                        <Sparkles size={120} />
                    </div>

                    <div className="relative z-10">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {/* Rating */}
                            <div>
                                <label className="block text-sm font-bold text-muted-foreground mb-4 ml-1 uppercase tracking-widest">
                                    Overall Experience Rating
                                </label>
                                <div className="max-w-[328px]">
                                    <div className="flex gap-3">
                                        {[1, 2, 3, 4, 5].map(val => (
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

                            {/* Feedback */}
                            <div className="group">
                                <label className="block text-sm font-bold text-muted-foreground mb-3 ml-1 uppercase tracking-widest transition-colors group-focus-within:text-primary">
                                    Additional Comments
                                </label>
                                <textarea
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    rows={6}
                                    placeholder="Share your thoughts, suggestions, or issues..."
                                    className="w-full bg-white/5 border border-white/10 rounded-3xl py-5 px-6 outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-medium leading-relaxed placeholder:text-muted-foreground/20"
                                />
                            </div>

                            {/* Submit */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full relative group overflow-hidden rounded-3xl bg-primary py-5 font-black text-white text-sm uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    <div className="absolute inset-0 bg-gradient-unicorn opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    <span className="relative flex items-center justify-center gap-3">
                                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                        {isSubmitting ? 'Transmitting...' : 'Submit Feedback'}
                                    </span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
