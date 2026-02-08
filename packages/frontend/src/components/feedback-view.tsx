'use client';

import React, { useState } from 'react';
import { Bot, Sparkles, Send, Loader2, Zap, MessageSquare, Rocket } from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function FeedbackView() {
    const [rating, setRating] = useState(4);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
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
                body: JSON.stringify({ rating, comment })
            });

            if (res.ok) {
                setSuccess(true);
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

    if (success) {
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
                    onClick={() => { setSuccess(false); setRating(0); setComment(''); }}
                    className="mt-10 px-10 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                    Send Another Transmission
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <header className="mb-8 md:mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                    <MessageSquare size={14} className="text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Direct Feed</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 italic">Platform <span className="text-primary">Sentiment</span></h1>
                <p className="text-muted-foreground font-medium max-w-xl text-sm md:text-base">
                    Communicate directly with the engineering team. Your ratings and suggestions directly influence the blueprint roadmap.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="glass-card rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Sparkles size={120} className="text-primary" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Overall Experience Grade</label>
                            <div className="flex gap-4">
                                {[1, 2, 3, 4, 5].map((bot) => (
                                    <button
                                        key={bot}
                                        type="button"
                                        onClick={() => setRating(bot)}
                                        className={`size-14 rounded-2xl flex items-center justify-center transition-all ${bot <= rating
                                            ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/20'
                                            : 'bg-white/5 text-muted-foreground/30 hover:bg-white/10 hover:text-muted-foreground'
                                            }`}
                                    >
                                        <Bot size={28} />
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-between px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                                <span>Critical System Error</span>
                                <span>Ascended Intelligence</span>
                            </div>
                        </div>

                        <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/20 relative overflow-hidden">
                            <div className="flex items-center gap-4 mb-2">
                                <Zap size={20} className="text-primary" />
                                <span className="text-xs font-bold text-white">Why it matters</span>
                            </div>
                            <p className="text-[10px] leading-relaxed text-muted-foreground font-medium">
                                We are in a rapid development phase. Your grades help our marketing and engineering teams prioritize which features go live next.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Data Transmission</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={8}
                                placeholder="Feature requests, bug reports, or just ideas on how to make Blueprints better..."
                                className="w-full bg-slate-950/50 border border-white/5 rounded-[2rem] p-8 outline-none focus:border-primary/50 transition-all font-medium text-sm custom-scrollbar"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !rating}
                            className="w-full py-6 bg-primary text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-primary/90 active:scale-95 shadow-2xl shadow-primary/30 relative overflow-hidden group disabled:opacity-50"
                        >
                            <div className="absolute inset-0 bg-gradient-unicorn opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="relative flex items-center justify-center gap-3">
                                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                {isSubmitting ? 'Syncing...' : 'Submit Feedback'}
                            </span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
