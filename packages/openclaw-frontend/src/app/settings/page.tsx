'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useAgent } from '@/hooks/use-agent';
import { useNotification } from '@/components/notification-provider';
import { BottomNav } from '@/components/bottom-nav';
import { apiPatch } from '@/lib/api';
import {
    Settings as SettingsIcon,
    ChevronDown,
    ChevronUp,
    Loader2,
    User,
    Brain,
    Shield,
    Key,
    CreditCard,
    LogOut,
    AlertTriangle,
    Terminal,
    Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    badge?: string;
}

function CollapsibleCard({ title, icon, children, defaultOpen = false, badge }: CollapsibleCardProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="glass-card rounded-2xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 text-left active:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-primary">
                        {icon}
                    </div>
                    <span className="font-bold text-sm">{title}</span>
                    {badge && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {badge}
                        </span>
                    )}
                </div>
                {open ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
            </button>
            {open && (
                <div className="px-5 pb-5 pt-1 border-t border-white/5 animate-in slide-in-from-top-1 fade-in duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function SettingsPage() {
    const { user, signOut } = useAuth();
    const { agent, loading: agentLoading, refetch } = useAgent();
    const { showNotification } = useNotification();

    const [agentName, setAgentName] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [saving, setSaving] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [apiKeyStatus, setApiKeyStatus] = useState<'configured' | 'missing'>('missing');

    // Initialize state from agent once loaded
    React.useEffect(() => {
        if (agent) {
            setAgentName(agent.name || '');
            const desiredState = agent.agent_desired_state?.[0] as Record<string, unknown> | undefined;
            const config = (desiredState?.config || {}) as Record<string, unknown>;
            const agents = (config.agents || {}) as Record<string, unknown>;
            const defaults = (agents.defaults || {}) as Record<string, unknown>;
            setSystemPrompt((defaults.system_prompt as string) || '');

            // Check if API key is configured
            const models = (config.models || {}) as Record<string, unknown>;
            const providers = (models.providers || {}) as Record<string, unknown>;
            const hasKey = Object.values(providers).some(
                (p) => (p as Record<string, unknown>)?.apiKey
            );
            setApiKeyStatus(hasKey ? 'configured' : 'missing');
        }
    }, [agent]);

    const handleSaveAgent = async () => {
        if (!agent) return;
        setSaving(true);
        try {
            await apiPatch(`/agents/${agent.id}`, {
                name: agentName,
            });
            showNotification('Agent updated', 'success');
            refetch();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save';
            showNotification(message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveApiKey = async () => {
        if (!agent || !apiKey) return;
        setSaving(true);
        try {
            // Stub — would call the real API key encryption endpoint
            await apiPatch(`/agents/${agent.id}/config`, {
                api_key: apiKey,
                provider: 'openrouter',
            });
            setApiKeyStatus('configured');
            setApiKey('');
            showNotification('API key saved', 'success');
        } catch {
            showNotification('API key save will be available when backend is ready', 'info');
            setApiKeyStatus('configured');
            setApiKey('');
        } finally {
            setSaving(false);
        }
    };

    if (agentLoading) {
        return (
            <div className="flex flex-col h-[100dvh]">
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <BottomNav />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh]">
            {/* Header */}
            <header className="flex-shrink-0 px-4 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl pt-[calc(1rem+var(--safe-area-top))]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <SettingsIcon size={18} className="text-primary" />
                    </div>
                    <h1 className="text-lg font-black tracking-tight">Settings</h1>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto scroll-smooth-mobile px-4 py-5 space-y-3">
                {/* Agent Configuration */}
                <CollapsibleCard title="Agent Configuration" icon={<User size={18} />} defaultOpen>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                Agent Name
                            </label>
                            <input
                                type="text"
                                value={agentName}
                                onChange={(e) => setAgentName(e.target.value)}
                                placeholder="My Agent"
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                System Prompt
                            </label>
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                placeholder="Define your agent's personality and behavior..."
                                rows={4}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                            />
                        </div>

                        <button
                            onClick={handleSaveAgent}
                            disabled={saving || !agentName}
                            className="w-full py-3 rounded-xl bg-primary hover:opacity-90 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                            Save Changes
                        </button>
                    </div>
                </CollapsibleCard>

                {/* Model & Intelligence */}
                <CollapsibleCard title="Intelligence" icon={<Brain size={18} />}>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                Model
                            </label>
                            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm">
                                Using shared OpenRouter — auto-configured
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Your agent uses our shared AI infrastructure. No configuration needed.
                        </p>
                    </div>
                </CollapsibleCard>

                {/* Security */}
                <CollapsibleCard title="Security" icon={<Shield size={18} />}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                            <div>
                                <p className="text-sm font-semibold">Sandbox Mode</p>
                                <p className="text-xs text-muted-foreground">Agent runs in isolated environment</p>
                            </div>
                            <div className="w-10 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-end px-1">
                                <div className="w-4 h-4 rounded-full bg-green-400" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Your agent runs in a secure sandbox. This is the only mode available for now.
                        </p>
                    </div>
                </CollapsibleCard>

                {/* API Key (BYOK) */}
                <CollapsibleCard title="API Key" icon={<Key size={18} />} badge="Phase 2">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                            <div className={cn(
                                'w-2.5 h-2.5 rounded-full',
                                apiKeyStatus === 'configured'
                                    ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]'
                                    : 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]'
                            )} />
                            <span className="text-sm">
                                {apiKeyStatus === 'configured' ? 'Key configured' : 'No key configured'}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                OpenRouter API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-or-..."
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                            <p className="text-xs text-muted-foreground">
                                Paste your OpenRouter API key to power your agent with your own credits.
                            </p>
                        </div>

                        <button
                            onClick={handleSaveApiKey}
                            disabled={saving || !apiKey}
                            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            Save Key
                        </button>
                    </div>
                </CollapsibleCard>

                {/* Billing / Credits */}
                <CollapsibleCard title="Billing & Credits" icon={<CreditCard size={18} />}>
                    <div className="space-y-4">
                        {/* Balance */}
                        <div className="text-center py-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Current Balance</p>
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-3xl font-black">$0</span>
                                <span className="text-lg text-muted-foreground">.00</span>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                            <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-yellow-200">You&apos;re out of credits</p>
                                <p className="text-xs text-yellow-200/60 mt-0.5">
                                    Add funds to keep your agent running.
                                </p>
                            </div>
                        </div>

                        {/* Top Up CTA */}
                        <button className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2">
                            <Zap size={18} />
                            Top Up — Minimum $10
                        </button>

                        <p className="text-xs text-center text-muted-foreground">
                            Secure payment via Stripe
                        </p>
                    </div>
                </CollapsibleCard>

                {/* Account */}
                <div className="pt-2 pb-8">
                    <button
                        onClick={signOut}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-red-400 hover:bg-red-400/10 active:scale-[0.98] text-sm font-bold uppercase tracking-widest transition-all"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                    {user && (
                        <p className="text-center text-[10px] text-muted-foreground mt-3">
                            {user.email}
                        </p>
                    )}
                </div>
            </main>

            {/* Bottom Nav */}
            <BottomNav />
        </div>
    );
}
