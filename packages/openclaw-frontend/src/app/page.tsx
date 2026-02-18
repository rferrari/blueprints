'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useAgent } from '@/hooks/use-agent';
import { cn } from '@/lib/utils';
import { ChatScreen } from '@/components/chat-screen';
import { TerminalScreen } from '@/components/terminal-screen';
import { BottomNav } from '@/components/bottom-nav';
import { Terminal, Loader2, AlertTriangle, Cpu } from 'lucide-react';

function HomeContent() {
    const { user, loading: authLoading } = useAuth();
    const { agent, loading: agentLoading, error } = useAgent();
    const searchParams = useSearchParams();
    const currentView = searchParams.get('view') || 'chat';

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
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 overflow-hidden relative">
                {/* Background Glows */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse delay-700" />

                <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center">
                    {/* Forging Icon/Animation */}
                    <div className="relative w-32 h-32 mb-12">
                        <div className="absolute inset-0 rounded-3xl bg-primary/20 animate-ping opacity-20" />
                        <div className="absolute inset-0 rounded-3xl border-2 border-primary/30 animate-[spin_4s_linear_infinite]" />
                        <div className="absolute inset-4 rounded-2xl border border-primary/50 animate-[spin_3s_linear_infinite_reverse]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Cpu className="w-12 h-12 text-primary animate-pulse" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-black tracking-tighter mb-4 text-white uppercase italic">
                        Forging Your Agent
                    </h1>

                    <p className="text-muted-foreground font-medium mb-12 leading-relaxed">
                        Initializing neural pathways and establishing secure backend uplinks.
                    </p>

                    {/* Progress Steps */}
                    <div className="w-full space-y-4">
                        {[
                            { label: 'Neural Core Initialization', delay: '0s' },
                            { label: 'Cloud Synchronicity', delay: '1s' },
                            { label: 'Memory Bank Allocation', delay: '2s' }
                        ].map((step, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2"
                                style={{ animationDelay: step.delay }}
                            >
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                                <span className="text-xs font-black uppercase tracking-widest text-white/70">{step.label}</span>
                                <div className="ml-auto text-[10px] font-bold text-primary italic">ACTIVE</div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-opacity animate-pulse">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                        Securing Environment
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                    </div>
                </div>
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
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
                            {agent.agent_actual_state?.status === 'running' ? 'Online' : (agent.agent_actual_state?.status || 'Stopped')}
                        </p>
                    </div>
                </div>
                <div className={cn(
                    "w-2 h-2 rounded-full",
                    agent.agent_actual_state?.status === 'running'
                        ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
                        : "bg-red-400/50"
                )} />
            </header>

            {/* Main Content */}
            <main className="flex-1 min-h-0 relative">
                {/* Status Overlay for non-running state */}
                {agent.agent_actual_state?.status !== 'running' && (
                    <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-tighter mb-2 italic">Waiting for Agent</h2>
                        <p className="text-sm text-muted-foreground max-w-[240px] mb-8 font-medium">
                            Your agent is currently {agent.agent_actual_state?.status || 'stopped'}. Please ensure it's started in settings.
                        </p>
                        <Link
                            href="/settings"
                            className="px-6 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                        >
                            Open Settings
                        </Link>
                    </div>
                )}
                <div className={currentView === 'chat' ? 'h-full' : 'hidden h-full'}>
                    <ChatScreen agent={agent} />
                </div>
                <div className={currentView === 'terminal' ? 'h-full' : 'hidden h-full'}>
                    <TerminalScreen agent={agent} />
                </div>
            </main>

            {/* Bottom Nav */}
            <BottomNav />
        </div>
    );
}

export default function HomePage() {
    return (
        <Suspense fallback={
            <div className="min-h-[100dvh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        }>
            <HomeContent />
        </Suspense>
    );
}
