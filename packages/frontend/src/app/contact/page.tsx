'use client';

import React from 'react';
import { Bot, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import SupportChat from '@/components/support-chat';

export default function ContactPage() {
    return (
        <div className="h-screen bg-background relative flex flex-col overflow-hidden selection:bg-primary/30">
            {/* Background Decorations - Wrapped to prevent overflow scroll height issues */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] -translate-x-1/3 translate-y-1/3" />
            </div>

            {/* Fixed Header */}
            <header className="h-20 shrink-0 border-b border-white/5 bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 z-50">
                <Link
                    href="/"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest transition-colors border border-white/5 hover:border-white/10"
                >
                    <ChevronLeft size={16} />
                    <span className="hidden sm:inline">Back</span>
                </Link>

                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-gradient-unicorn p-0.5 shadow-lg">
                        <div className="w-full h-full bg-background rounded-[calc(0.75rem-2px)] flex items-center justify-center">
                            <Bot size={20} className="text-white" />
                        </div>
                    </div>
                    <div className="text-right">
                        <h1 className="font-black tracking-tight text-lg">Neural Support</h1>
                        <div className="flex items-center justify-end gap-1.5">
                            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Agent Online</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Support Chat Container */}
            <div className="flex-1 relative z-0 overflow-hidden">
                <SupportChat />
            </div>
        </div>
    );
}
