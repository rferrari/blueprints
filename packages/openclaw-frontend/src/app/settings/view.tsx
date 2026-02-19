'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { useAgent } from '@/hooks/use-agent';
import { useNotification } from '@/components/notification-provider';
import { SecurityLevel, Profile } from '@eliza-manager/shared';
import { BottomNav } from '@/components/bottom-nav';
import { apiPatch, apiFetch } from '@/lib/api';
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
    const { agent, loading: agentLoading, refetch, deployAgent, purgeAgent, startAgent, stopAgent } = useAgent();
    const { showNotification } = useNotification();

    const [activeTab, setActiveTab] = useState<TabType>('agent');
    const [agentName, setAgentName] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [saving, setSaving] = useState(false);
    const [agentToggling, setAgentToggling] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [apiKeyStatus, setApiKeyStatus] = useState<'configured' | 'missing'>('missing');
    const [jsonContent, setJsonContent] = useState('');
    const [profile, setProfile] = useState<Profile | null>(null);
    const [securityLevel, setSecurityLevel] = useState<SecurityLevel>(SecurityLevel.STANDARD);
    const [leaseBilling, setLeaseBilling] = useState<{
        usageUsd: number;
        limitUsd: number | null;
        expiresAt: string | null;
        hasLease: boolean;
    } | null>(null);

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
            if (currentlyEnabled) {
                await stopAgent();
                showNotification('Agent shutdown requested', 'success');
            } else {
                await startAgent();
                showNotification('Agent startup requested', 'success');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to toggle agent';
            showNotification(message, 'error');
        } finally {
            setAgentToggling(false);
        }
    };

    const handleLaunchAgent = async () => {
        setAgentToggling(true);
        try {
            await deployAgent();
            showNotification('Agent launched successfully', 'success');
        } catch (err: unknown) {
            showNotification('Failed to launch agent', 'error');
        } finally {
            setAgentToggling(false);
        }
    };

    const handleTerminateAgent = async () => {
        if (!confirm('Are you sure you want to PERMANENTLY delete this agent? Everything will be wiped.')) return;
        setAgentToggling(true);
        try {
            await purgeAgent();
            showNotification('Agent terminated and removed', 'success');
        } catch (err: unknown) {
            showNotification('Failed to terminate agent', 'error');
        } finally {
            setAgentToggling(false);
        }
    };

    // Initialize state from agent once loaded
    useEffect(() => {
        if (!user) return;
        const fetchProfile = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (data) setProfile(data);
        };
        fetchProfile();
    }, [user, supabase]);

    // Fetch lease billing info whenever billing tab opens
    useEffect(() => {
        if (activeTab !== 'billing') return;
        const fetchBilling = async () => {
            try {
                const leases = await apiFetch<any[]>('/managed-keys/lease');
                const active = leases?.find((l: any) => l.status === 'active');
                if (active) {
                    const mk = active.managed_provider_keys as any;
                    const limitUsd: number | null = mk?.monthly_limit_usd ?? mk?.daily_limit_usd ?? null;
                    setLeaseBilling({
                        usageUsd: Number(active.usage_usd) || 0,
                        limitUsd: limitUsd !== null ? Number(limitUsd) : null,
                        expiresAt: active.expires_at,
                        hasLease: true,
                    });
                } else {
                    setLeaseBilling({ usageUsd: 0, limitUsd: null, expiresAt: null, hasLease: false });
                }
            } catch {
                setLeaseBilling({ usageUsd: 0, limitUsd: null, expiresAt: null, hasLease: false });
            }
        };
        fetchBilling();
    }, [activeTab]);

    useEffect(() => {
        if (agent) {
            const desired = Array.isArray(agent.agent_desired_state) ? agent.agent_desired_state[0] : agent.agent_desired_state;
            const metadata = (desired as any)?.metadata || {};
            setSecurityLevel(metadata.security_level ?? SecurityLevel.STANDARD);

            // ... existing login
            const config = (desired as any)?.config || {};
            setAgentName(agent.name || '');
            setSystemPrompt((config.agents?.defaults?.system_prompt as string) || '');
            setJsonContent(JSON.stringify(config, null, 2));

            const providers = (config as any).models?.providers || {};
            const hasKey = !!(providers.openrouter?.apiKey || providers.anthropic?.apiKey || providers.openai?.apiKey);
            setApiKeyStatus(hasKey ? 'configured' : 'missing');
        }
    }, [agent]);

    const handleUpdateSecurity = async (level: SecurityLevel) => {
        if (!agent) return;
        setSecurityLevel(level);
        try {
            await apiPatch(`/agents/${agent.id}/config`, {
                metadata: { security_level: level }
            });
            showNotification('Security level updated', 'success');
            await refetch(true);
        } catch (err: any) {
            showNotification('Failed to update security: ' + err.message, 'error');
        }
    };

    const handleSaveAgent = async () => {
        if (!agent) return;
        setSaving(true);
        try {
            await apiPatch(`/agents/${agent.id}/config`, { name: agentName });
            showNotification('Agent updated', 'success');
            refetch();
        } catch (err: unknown) {
            showNotification('Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveApiKey = async () => {
        if (!agent || !apiKey) return;
        setSaving(true);
        try {
            const desiredStateData = agent.agent_desired_state;
            const desiredState = Array.isArray(desiredStateData)
                ? desiredStateData[0]
                : (desiredStateData as any);

            const currentConfig = (desiredState?.config || {}) as Record<string, any>;

            // OpenClaw config structure for API keys
            const newConfig = {
                ...currentConfig,
                models: {
                    ...(currentConfig.models || {}),
                    providers: {
                        ...(currentConfig.models?.providers || {}),
                        openrouter: {
                            ...(currentConfig.models?.providers?.openrouter || {}),
                            apiKey: apiKey
                        }
                    }
                },
                // Also update auth profiles for backward compatibility or different openclaw versions
                auth: {
                    ...(currentConfig.auth || {}),
                    profiles: {
                        ...(currentConfig.auth?.profiles || {}),
                        default: {
                            ...(currentConfig.auth?.profiles?.default || {}),
                            provider: 'openrouter',
                            mode: 'api_key',
                            key: apiKey
                        }
                    }
                }
            };

            await apiPatch(`/agents/${agent.id}/config`, {
                config: newConfig
            });

            setApiKeyStatus('configured');
            setApiKey('');
            showNotification('API key saved', 'success');
            refetch();
        } catch (err: unknown) {
            console.error('Failed to save API key:', err);
            showNotification('Failed to update API key', 'error');
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
            } catch (err: unknown) {
                throw new Error('Invalid JSON format');
            }

            await apiPatch(`/agents/${agent.id}/config`, { config: parsed });

            showNotification('Configuration updated', 'success');
            refetch();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save JSON';
            showNotification(message, 'error');
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

    // Derived state for cleaner JSX
    const desiredStateData = agent?.agent_desired_state;
    const desiredState = Array.isArray(desiredStateData)
        ? desiredStateData[0]
        : (desiredStateData as any);
    const currentlyEnabled = desiredState?.enabled ?? false;

    const config = (desiredState?.config || {}) as Record<string, any>;
    const rawGatewayToken = config.gateway?.auth?.token || '';

    // Helper to check if a value is encrypted (format: IV:TEXT)
    const isEncrypted = (val: string) => {
        if (!val || typeof val !== 'string' || !val.includes(':')) return false;
        const [iv, text] = val.split(':');
        return iv.length === 32 && /^[0-9a-f]+$/i.test(iv) && /^[0-9a-f]+$/i.test(text);
    };

    const gatewayToken = isEncrypted(rawGatewayToken)
        ? `${rawGatewayToken.substring(0, 8)}... (encrypted)`
        : rawGatewayToken;

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
                        {!agent ? (
                            <div className="glass-card rounded-2xl overflow-hidden p-8 text-center border-2 border-dashed border-primary/20 bg-primary/5">
                                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                                    <Brain size={40} className="text-primary animate-pulse" />
                                </div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter mb-3 italic">Launch Your neural agent</h2>
                                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-8 font-medium leading-relaxed">
                                    Ready to deploy your customized OpenClaw agent? We'll initialize a secure sandbox environment and link your neural pathways.
                                </p>
                                <button
                                    onClick={handleLaunchAgent}
                                    disabled={agentToggling}
                                    className="w-full max-w-xs py-4 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                                >
                                    Launch my agent
                                </button>
                            </div>
                        ) : (agent as any).isPurging ? (
                            <div className="glass-card rounded-2xl overflow-hidden p-8 text-center border-2 border-dashed border-red-500/20 bg-red-500/5 animate-pulse">
                                <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                                    <Loader2 size={40} className="text-red-500 animate-spin" />
                                </div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter mb-3 italic">Decommissioning Agent</h2>
                                <p className="text-sm text-red-400/80 max-w-sm mx-auto mb-4 font-medium leading-relaxed">
                                    Finalizing memory purge and dissolving neural pathways. This process cannot be undone.
                                </p>
                                <div className="text-[10px] font-black uppercase tracking-widest text-red-400/50">
                                    Worker Status: Cleaning up Docker & Filesystem...
                                </div>
                            </div>
                        ) : (
                            <>
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
                                                    agent?.agent_actual_state?.status === 'running' ? "bg-green-500 animate-pulse" : "bg-muted-foreground/50"
                                                )} />
                                                {agent?.agent_actual_state?.status || 'stopped'}
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

                                {/* Terminate Section */}
                                <div className="pt-8 pb-4">
                                    <button
                                        onClick={handleTerminateAgent}
                                        disabled={agentToggling}
                                        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-red-500/20 text-red-500 hover:bg-red-500/10 active:scale-[0.98] text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                    >
                                        <AlertTriangle size={16} />
                                        terminate agent (remove agent)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                        {/* Security */}
                        <CollapsibleCard title="Environment Security" icon={<Shield size={18} />} defaultOpen>
                            <div className="space-y-4">
                                <div className="grid gap-3">
                                    {[
                                        { level: SecurityLevel.STANDARD, label: 'Standard', desc: 'Secure Sandbox: Read-only rootfs, no network privileges, dropped caps. Recommended.' },
                                        { level: SecurityLevel.ADVANCED, label: 'Advanced', desc: 'Extended isolation: Adds SYS_ADMIN capability for specialized tools. Still readonly root.' },
                                        { level: SecurityLevel.PRO, label: 'Pro', desc: 'Full Development: Adds writeable rootfs and NET_ADMIN. For complex agent tasks.' },
                                        { level: SecurityLevel.ROOT, label: 'Root (Super Admin)', desc: 'UNSAFE: Full host level access as root user. Use with extreme caution.', adminOnly: true }
                                    ]
                                        .filter(opt => !opt.adminOnly || profile?.role === 'super_admin')
                                        .map((opt) => (
                                            <button
                                                key={opt.level}
                                                onClick={() => handleUpdateSecurity(opt.level)}
                                                className={cn(
                                                    "group relative flex flex-col items-start gap-1 px-4 py-3 rounded-xl border text-left transition-all",
                                                    securityLevel === opt.level
                                                        ? "bg-primary/10 border-primary shadow-[0_4px_12px_rgba(var(--primary-rgb),0.1)]"
                                                        : "bg-white/5 border-white/10 hover:border-white/20 active:bg-white/10"
                                                )}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className={cn(
                                                        "text-sm font-semibold",
                                                        securityLevel === opt.level ? "text-primary" : "text-white"
                                                    )}>
                                                        {opt.label} Isolation
                                                    </span>
                                                    {securityLevel === opt.level && (
                                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    {opt.desc}
                                                </p>
                                            </button>
                                        ))}
                                </div>

                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/80">
                                    <div className="flex gap-3">
                                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                        <p className="text-[11px] leading-relaxed">
                                            <strong>Warning:</strong> Changing security settings requires an agent restart to take effect.
                                            Higher levels grant the agent more access to the underlying system, which should only be used if trusted.
                                        </p>
                                    </div>
                                </div>
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

                        {/* Gateway Access */}
                        <CollapsibleCard title="Gateway Access" icon={<Zap size={18} />} defaultOpen>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-primary/80">API Gateway Token</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-primary font-mono text-xs select-all flex items-center">
                                            {gatewayToken || 'auto-generating...'}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed flex items-center gap-1.5">
                                        <Shield size={10} className="text-primary/50" />
                                        {isEncrypted(rawGatewayToken)
                                            ? 'Token is encrypted at rest for your security. Update to change.'
                                            : 'Use this token in your client applications to authenticate with this agent.'}
                                    </p>
                                </div>
                            </div>
                        </CollapsibleCard>
                    </div>
                )}

                {activeTab === 'billing' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
                        <CollapsibleCard title="Wallet & Usage" icon={<CreditCard size={18} />} defaultOpen>
                            <div className="space-y-5">
                                {/* Stats grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    {/* Credits */}
                                    <div className="flex flex-col items-center py-4 px-2 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Credits</p>
                                        <span className="text-xl font-black text-white">
                                            {leaseBilling?.hasLease && leaseBilling.limitUsd !== null
                                                ? `$${leaseBilling.limitUsd.toFixed(2)}`
                                                : '∞'}
                                        </span>
                                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">limit</p>
                                    </div>
                                    {/* Usage */}
                                    <div className="flex flex-col items-center py-4 px-2 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Usage</p>
                                        <span className="text-xl font-black text-amber-400">
                                            ${(leaseBilling?.usageUsd ?? 0).toFixed(3)}
                                        </span>
                                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">spent</p>
                                    </div>
                                    {/* Available */}
                                    <div className="flex flex-col items-center py-4 px-2 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Available</p>
                                        <span className={cn(
                                            'text-xl font-black',
                                            (() => {
                                                if (!leaseBilling?.hasLease || leaseBilling.limitUsd === null) return 'text-green-400';
                                                const avail = leaseBilling.limitUsd - leaseBilling.usageUsd;
                                                return avail <= 0 ? 'text-red-400' : avail < leaseBilling.limitUsd * 0.2 ? 'text-yellow-400' : 'text-green-400';
                                            })()
                                        )}>
                                            {leaseBilling?.hasLease && leaseBilling.limitUsd !== null
                                                ? `$${Math.max(0, leaseBilling.limitUsd - leaseBilling.usageUsd).toFixed(2)}`
                                                : '∞'}
                                        </span>
                                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">remaining</p>
                                    </div>
                                </div>

                                {/* Expiry / Status */}
                                {leaseBilling?.hasLease && leaseBilling.expiresAt && (
                                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs text-muted-foreground">
                                        <span className="font-bold uppercase tracking-widest text-[10px]">Lease Expires</span>
                                        <span className="font-mono">
                                            {new Date(leaseBilling.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                )}

                                {/* Warning if no lease or exhausted */}
                                {leaseBilling && !leaseBilling.hasLease && (
                                    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                        <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-yellow-200 uppercase tracking-wide">No Active Lease</p>
                                            <p className="text-xs text-yellow-200/60 mt-1 leading-relaxed">
                                                No shared API key is linked to your agent. Go to Agent settings and re-sync your key.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {leaseBilling?.hasLease && leaseBilling.limitUsd !== null && (leaseBilling.limitUsd - leaseBilling.usageUsd) <= 0 && (
                                    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                        <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-bold text-red-200 uppercase tracking-wide">Credits Exhausted</p>
                                            <p className="text-xs text-red-200/60 mt-1 leading-relaxed">
                                                Your agent will pause until credits are renewed. Contact support or top up.
                                            </p>
                                        </div>
                                    </div>
                                )}

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
                        close session (logout)
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
