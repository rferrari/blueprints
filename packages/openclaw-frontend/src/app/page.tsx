'use client';

import React from 'react';
import { useAuth } from '@/components/auth-provider';
import { useAgent } from '@/hooks/use-agent';
import { ChatScreen } from '@/components/chat-screen';
import { BottomNav } from '@/components/bottom-nav';
import { Terminal, Loader2, AlertTriangle } from 'lucide-react';

export default function HomePage() {
    const { user, loading: authLoading } = useAuth();
    const { agent, loading: agentLoading, error } = useAgent();

    // Auth loading
    if (authLoading) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    // Not authenticated — auth-provider will redirect
    if (!user) return null;

    // Agent loading / creating
    if (agentLoading) {
        return (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-4">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-glow">
                    <Terminal className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-lg font-black tracking-tight">Setting up your agent</h2>
                    <p className="text-sm text-muted-foreground">This only takes a moment…</p>
                </div>
                <Loader2 className="w-5 h-5 text-primary/60 animate-spin mt-2" />
            </div>
        );
    }

    // Error state
    if (error || !agent) {
        return (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 gap-4">
                <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-lg font-black tracking-tight">Something went wrong</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        {error || 'Unable to load your agent. Please try again.'}
                    </p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-sm font-bold uppercase tracking-widest transition-all active:scale-[0.98]"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh]">
            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-background/80 backdrop-blur-xl pt-[calc(0.75rem+var(--safe-area-top))]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Terminal size={18} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black tracking-tight leading-tight">{agent.name}</h1>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Online</p>
                    </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
            </header>

            {/* Chat */}
            <main className="flex-1 min-h-0">
                <ChatScreen agent={agent} />
            </main>

            {/* Bottom Nav */}
            <BottomNav />
        </div>
    );
}
