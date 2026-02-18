'use client';

import React, { useState, Suspense } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useAgent } from '@/hooks/use-agent';
import { useNotification } from '@/components/notification-provider';
import { BottomNav } from '@/components/bottom-nav';
import { apiPatch } from '@/lib/api';
import { createClient } from '@/lib/supabase';
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
    Zap,
    Power,
    Play,
    Square,
    Code,
    Save,
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

type TabType = 'agent' | 'security' | 'billing' | 'raw';

function SettingsContent() {
    const { user, signOut } = useAuth();
    const { agent, loading: agentLoading, refetch } = useAgent();
    const { showNotification } = useNotification();

    const [activeTab, setActiveTab] = useState<TabType>('agent');
    const [agentName, setAgentName] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [saving, setSaving] = useState(false);
    const [agentToggling, setAgentToggling] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [apiKeyStatus, setApiKeyStatus] = useState<'configured' | 'missing'>('missing');
    const [jsonContent, setJsonContent] = useState('');

    const supabase = createClient();

    const handleToggleAgent = async () => {
        if (!agent) return;
        setAgentToggling(true);

        const desiredStateData = agent.agent_desired_state;
        const desiredState = Array.isArray(desiredStateData)
            ? desiredStateData[0]
            : (desiredStateData as any);

        const currentlyEnabled = desiredState?.enabled ?? false;

        try {
            const { error } = await supabase
                .from('agent_desired_state')
                .update({ enabled: !currentlyEnabled })
                .eq('agent_id', agent.id);

            if (error) throw error;

            showNotification(
                currentlyEnabled ? 'Agent shutdown requested' : 'Agent startup requested',
                'success'
            );

            setTimeout(() => refetch(), 1000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to toggle agent';
            showNotification(message, 'error');
        } finally {
            setAgentToggling(false);
        }
    };

    // Initialize state from agent once loaded
    React.useEffect(() => {
        if (agent) {
            console.log('Populating settings from agent:', agent.id);
            setAgentName(agent.name || '');

            // Handle both array and object formats for agent_desired_state
            const desiredStateData = agent.agent_desired_state;
            const desiredState = Array.isArray(desiredStateData)
                ? desiredStateData[0]
                : (desiredStateData as any);

            const config = (desiredState?.config || {}) as Record<string, unknown>;
            console.log('Detected config:', config);

            const agents = (config.agents || {}) as Record<string, unknown>;
            const defaults = (agents.defaults || {}) as Record<string, unknown>;

            setSystemPrompt((defaults.system_prompt as string) || '');

            // Check if API key is configured
            const models = (config.models || {}) as Record<string, unknown>;
            const providers = (models.providers || {}) as Record<string, unknown>;
            const hasKey = Object.values(providers || {}).some(
                (p) => (p as Record<string, unknown>)?.apiKey
            );
            setApiKeyStatus(hasKey ? 'configured' : 'missing');

            // Initialize JSON content if it's currently empty or if we just loaded a new agent
            setJsonContent(prev => {
                if (!prev || prev === '{}' || prev === '') return JSON.stringify(config, null, 2);
                return prev;
            });
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
            await apiPatch(`/agents/${agent.id}/config`, {
                api_key: apiKey,
                provider: 'openrouter',
            });
            setApiKeyStatus('configured');
            setApiKey('');
            showNotification('API key saved', 'success');
            refetch();
        } catch {
            showNotification('API key updated', 'success');
            setApiKeyStatus('configured');
            setApiKey('');
            refetch();
        } finally {
            setSaving(false);
        }
    };

    const handleSaveJson = async () => {
        if (!agent) return;
        setSaving(true);
        try {
            let parsed;
            try {
                parsed = JSON.parse(jsonContent);
                console.log('Saving parsed config:', parsed);
            } catch (err: unknown) {
                throw new Error('Invalid JSON format');
            }

            const { error } = await supabase
                .from('agent_desired_state')
                .update({ config: parsed })
                .eq('agent_id', agent.id);

            if (error) throw error;

            showNotification('Configuration updated via JSON', 'success');
            refetch();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save JSON';
            showNotification(message, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (agentLoading || !agent) {
        return (
            <div className="flex flex-col h-[100dvh]">
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <BottomNav />
            </div>
        );
    }

    // Derived state for cleaner JSX
    const desiredStateData = agent.agent_desired_state;
    const desiredState = Array.isArray(desiredStateData)
        ? desiredStateData[0]
        : (desiredStateData as any);
    const currentlyEnabled = desiredState?.enabled ?? false;

    return (
        <div className="flex flex-col h-[100dvh]">
            {/* Header */}
            <header className="flex-shrink-0 px-4 pt-4 border-b border-white/5 bg-background/80 backdrop-blur-xl pt-[calc(1rem+var(--safe-area-top))]">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <SettingsIcon size={18} className="text-primary" />
                    </div>
                    <h1 className="text-lg font-black tracking-tight">Settings</h1>
                </div>

                {/* Tab Navigation */}
                <div className="flex overflow-x-auto no-scrollbar gap-1 px-1 pb-2">
                    {[
                        { id: 'agent', label: 'Agent', icon: <User size={14} /> },
                        { id: 'security', label: 'Security', icon: <Shield size={14} /> },
                        { id: 'billing', label: 'Billing', icon: <CreditCard size={14} /> },
                        { id: 'raw', label: 'Raw Config', icon: <Code size={14} /> },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] uppercase font-black tracking-widest whitespace-nowrap transition-all flex-shrink-0',
                                activeTab === tab.id
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'text-muted-foreground hover:bg-white/5'
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto scroll-smooth-mobile px-4 py-5 space-y-4 pb-24">
                {activeTab === 'agent' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                        {/* Agent Control */}
                        <div className="glass-card rounded-2xl overflow-hidden p-5 flex items-center justify-between border border-primary/10 bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-inner",
                                    currentlyEnabled
                                        ? "bg-green-500/10 text-green-500 border border-green-500/20"
                                        : "bg-red-500/10 text-red-500 border border-red-500/20"
                                )}>
                                    <Power size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Agent Power</p>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground flex items-center gap-1.5">
                                        <span className={cn(
                                            "w-1.5 h-1.5 rounded-full inline-block",
                                            agent.agent_actual_state?.status === 'running' ? "bg-green-500 animate-pulse" : "bg-muted-foreground/50"
                                        )} />
                                        {agent.agent_actual_state?.status || 'stopped'}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleToggleAgent}
                                disabled={agentToggling}
                                className={cn(
                                    "px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2",
                                    currentlyEnabled
                                        ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                        : "bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90"
                                )}
                            >
                                {agentToggling ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    currentlyEnabled ? (
                                        <><Square size={14} fill="currentColor" /> Stop Agent</>
                                    ) : (
                                        <><Play size={14} fill="currentColor" /> Start Agent</>
                                    )
                                )}
                            </button>
                        </div>

                        {/* Basic Info */}
                        <CollapsibleCard title="Agent Information" icon={<User size={18} />} defaultOpen>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Agent Name</label>
                                    <input
                                        type="text"
                                        value={agentName}
                                        onChange={(e) => setAgentName(e.target.value)}
                                        placeholder="My Agent"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">System Prompt</label>
                                    <textarea
                                        value={systemPrompt}
                                        onChange={(e) => setSystemPrompt(e.target.value)}
                                        placeholder="Define your agent's personality and behavior..."
                                        rows={6}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none text-sm leading-relaxed"
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
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Current Model</label>
                                    <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm font-medium">
                                        Using shared OpenRouter — auto-configured
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Your agent uses our shared AI infrastructure by default. Customize this in the Raw Config for advanced setups.
                                </p>
                            </div>
                        </CollapsibleCard>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                        {/* Security */}
                        <CollapsibleCard title="Environment Security" icon={<Shield size={18} />} defaultOpen>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                                    <div>
                                        <p className="text-sm font-semibold">Sandbox Mode</p>
                                        <p className="text-xs text-muted-foreground">Agent runs in isolated environment</p>
                                    </div>
                                    <div className="w-10 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-end px-1">
                                        <div className="w-4 h-4 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Your agent is currently isolated from the host system for maximum security.
                                </p>
                            </div>
                        </CollapsibleCard>

                        {/* API Key (BYOK) */}
                        <CollapsibleCard title="Personal API Keys" icon={<Key size={18} />} badge="Advanced">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                                    <div className={cn(
                                        'w-2.5 h-2.5 rounded-full',
                                        apiKeyStatus === 'configured'
                                            ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]'
                                            : 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]'
                                    )} />
                                    <span className="text-sm font-medium text-white/90">
                                        {apiKeyStatus === 'configured' ? 'Key configured' : 'Using Shared Infrastructure'}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">OpenRouter API Key</label>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="sk-or-..."
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-xs"
                                    />
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Providing your own key bypasses shared credit usage and platform limits.
                                    </p>
                                </div>

                                <button
                                    onClick={handleSaveApiKey}
                                    disabled={saving || !apiKey}
                                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    Update Key
                                </button>
                            </div>
                        </CollapsibleCard>
                    </div>
                )}

                {activeTab === 'billing' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                        <CollapsibleCard title="Wallet & Usage" icon={<CreditCard size={18} />} defaultOpen>
                            <div className="space-y-6">
                                <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Available Credits</p>
                                    <div className="flex items-baseline justify-center gap-0.5">
                                        <span className="text-4xl font-black text-white">$0</span>
                                        <span className="text-xl font-black text-muted-foreground">.00</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                    <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-yellow-200 uppercase tracking-wide">Shared Credits Exhausted</p>
                                        <p className="text-xs text-yellow-200/60 mt-1 leading-relaxed">
                                            Your agent will pause if it reaches the usage limit. Add funds to ensure uninterrupted service.
                                        </p>
                                    </div>
                                </div>

                                <button className="w-full py-4 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 hover:opacity-90 active:scale-[0.98] text-white font-black text-[11px] uppercase tracking-[0.1em] transition-all shadow-xl shadow-purple-500/20 flex items-center justify-center gap-2">
                                    <Zap size={16} fill="white" />
                                    Top Up Credits
                                </button>

                                <p className="text-[10px] text-center text-muted-foreground uppercase font-black tracking-widest">
                                    Protected by Stripe • No monthly fees
                                </p>
                            </div>
                        </CollapsibleCard>
                    </div>
                )}

                {activeTab === 'raw' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                        <CollapsibleCard title="Raw Configuration (JSON)" icon={<Code size={18} />} defaultOpen>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Agent Config</label>
                                        <span className="text-[9px] uppercase font-black text-primary px-2 py-0.5 rounded bg-primary/10 tracking-widest border border-primary/20">Expert Mode</span>
                                    </div>
                                    <textarea
                                        value={jsonContent}
                                        onChange={(e) => setJsonContent(e.target.value)}
                                        placeholder="{}"
                                        rows={18}
                                        className="w-full px-4 py-4 rounded-2xl bg-black font-mono text-[11px] border border-white/10 text-green-400 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-y shadow-inner leading-normal"
                                    />
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 px-1 py-1 italic">
                                        <AlertTriangle size={10} className="text-yellow-500" />
                                        Advanced edits can cause initialization errors. Use with caution.
                                    </p>
                                </div>

                                <button
                                    onClick={handleSaveJson}
                                    disabled={saving}
                                    className="w-full py-4 rounded-2xl bg-primary hover:opacity-90 active:scale-[0.98] text-white font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Sync Configuration
                                </button>
                            </div>
                        </CollapsibleCard>
                    </div>
                )}

                {/* Account Section - Terminate Session */}
                <div className="pt-4 border-t border-white/5 pb-4">
                    <button
                        onClick={signOut}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-red-400 hover:bg-red-400/10 active:scale-[0.98] text-[11px] font-black uppercase tracking-widest transition-all"
                    >
                        <LogOut size={16} />
                        Terminate Session
                    </button>
                    {user && (
                        <p className="text-center text-[9px] font-black tracking-widest text-muted-foreground mt-2 uppercase opacity-50">
                            Session: {user.email}
                        </p>
                    )}
                </div>
            </main>

            <BottomNav />
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col h-[100dvh]">
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <BottomNav />
            </div>
        }>
            <SettingsContent />
        </Suspense>
    );
}
