'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { UserTier, SecurityLevel, resolveSecurityLevel, TIER_CONFIG, OPENAI_ALLOWED_MODELS } from '@eliza-manager/shared';
import { Bot, Zap, Shield, Key, MessageSquare, ArrowRight, ArrowLeft, Check, Save, X, Loader2, Terminal, Cpu, Share2, Hash, Send, MessageCircle, Slack, ShieldCheck, Lock, Unlock, Plus, User, Activity } from 'lucide-react';

interface OpenClawWizardProps {
    agent: any;
    onSave: (config: any, metadata?: any, name?: string) => Promise<void>;
    onClose: () => void;
}

export default function OpenClawWizard({ agent, onSave, onClose }: OpenClawWizardProps) {
    const getOne = (val: any) => (Array.isArray(val) ? val[0] : val);
    const existingConfig = getOne(agent.agent_desired_state)?.config || {};
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [availableModels, setAvailableModels] = useState<any[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [jsonMode, setJsonMode] = useState(false);
    const [pastedJson, setPastedJson] = useState('');
    const [name, setName] = useState(agent.name || '');
    const [avatar, setAvatar] = useState(getOne(agent.agent_desired_state)?.metadata?.avatar || '');

    // Tier & Security
    const supabase = createClient();
    const [tier, setTier] = useState<UserTier>(UserTier.FREE);
    const [securityLevel, setSecurityLevel] = useState<SecurityLevel>(SecurityLevel.STANDARD);

    React.useEffect(() => {
        const fetchTier = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase.from('profiles').select('tier').eq('id', session.user.id).single();
                if (data) setTier(data.tier as UserTier);
            }
        };
        fetchTier();
    }, []);

    // Load initial security level from metadata if exists
    React.useEffect(() => {
        const existingLevel = getOne(agent.agent_desired_state)?.metadata?.security_level;
        if (existingLevel !== undefined) {
            setSecurityLevel(existingLevel);
        }
    }, [agent]);

    // Initial State derived from existing config or defaults
    const [config, setConfig] = useState({
        provider: existingConfig.auth?.profiles?.['default']?.provider || 'venice', // Default to Venice
        mode: 'api_key', // Enforce API Key
        token: existingConfig.models?.providers?.[existingConfig.auth?.profiles?.['default']?.provider]?.apiKey || '',
        gatewayToken: existingConfig.gateway?.auth?.token || Math.random().toString(36).substring(2, 15),
        modelId: existingConfig.agents?.defaults?.model?.primary?.split('/').pop() || 'llama-3.3-70b',

        // Channels
        channels: {
            blueprints_chat: true, // Mandatory
            telegram: !!existingConfig.channels?.telegram?.enabled,
            discord: !!existingConfig.channels?.discord?.enabled,
            whatsapp: !!existingConfig.channels?.whatsapp?.enabled,
            slack: !!existingConfig.channels?.slack?.enabled,
        },
        telegramToken: existingConfig.channels?.telegram?.botToken || '',
        discordToken: existingConfig.channels?.discord?.token || '',
        whatsappToken: existingConfig.channels?.whatsapp?.token || '',
        slackToken: existingConfig.channels?.slack?.token || '',

        ...existingConfig
    });

    const fetchModels = async (provider: string, token: string) => {
        if (!token) return;
        setFetchingModels(true);
        setModelError(null);
        try {
            let url = '';
            if (provider === 'venice') url = 'https://api.venice.ai/api/v1/models';
            else if (provider === 'openai') url = 'https://api.openai.com/v1/models';
            else if (provider === 'anthropic') {
                const models = [
                    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
                    { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' },
                    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
                ];
                setAvailableModels(models);
                if (!config.modelId || !models.find((m: any) => m.id === config.modelId)) {
                    setConfig((prev: any) => ({ ...prev, modelId: models[0].id }));
                }
                setFetchingModels(false);
                return;
            }

            if (!url) {
                setFetchingModels(false);
                return;
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`);
            const data = await res.json();

            if (data?.data && Array.isArray(data.data)) {
                let models: any[] = [];
                if (provider === 'venice') {
                    models = data.data
                        .filter((m: any) => m.model_spec?.capabilities?.supportsFunctionCalling === true)
                        .map((m: any) => ({ id: m.id, name: m.model_spec?.name || m.id }));
                } else if (provider === 'openai') {
                    models = data.data
                        .filter((m: any) => OPENAI_ALLOWED_MODELS.has(m.id))
                        .map((m: any) => ({ id: m.id, name: m.id }));
                } else {
                    models = data.data.map((m: any) => ({ id: m.id, name: m.id }));
                }

                models.sort((a: any, b: any) => a.name.localeCompare(b.name));
                setAvailableModels(models);

                if (!config.modelId || !models.find(m => m.id === config.modelId)) {
                    const defaultModel = models.find(m => m.id.includes('70b') || m.id.includes('gpt-4o')) || models[0];
                    if (defaultModel) setConfig((prev: any) => ({ ...prev, modelId: defaultModel.id }));
                }
            }
        } catch (err: any) {
            console.error('Fetch models error:', err);
            setModelError(err.message);
        } finally {
            setFetchingModels(false);
        }
    };

    const steps = [
        { id: 1, title: 'Neural Identity', icon: <User size={20} /> },
        { id: 2, title: 'Intelligence Provider', icon: <Zap size={20} /> },
        { id: 3, title: 'Model Selection', icon: <Cpu size={20} /> },
        { id: 4, title: 'Permissions & Security', icon: <Shield size={20} /> },
        { id: 5, title: 'Communication Channels', icon: <Share2 size={20} /> },
        { id: 6, title: 'Channel Configuration', icon: <MessageSquare size={20} /> },
    ];

    const handleSave = async () => {
        setSaving(true);
        try {
            // Channel Configuration
            const channelsConfig: any = {};
            // Mandatory blueprints_chat is now implicit, do not write to config.

            if (config.channels.telegram && config.telegramToken) channelsConfig.telegram = { enabled: true, botToken: config.telegramToken };
            if (config.channels.discord && config.discordToken) channelsConfig.discord = { enabled: true, token: config.discordToken };
            if (config.channels.slack && config.slackToken) channelsConfig.slack = { enabled: true, token: config.slackToken };
            if (config.channels.whatsapp && config.whatsappToken) channelsConfig.whatsapp = { enabled: true, token: config.whatsappToken };

            // Model Configuration
            let modelId = config.modelId || 'gpt-4o';
            let modelName = 'GPT-4o';
            let modelApi = 'openai-responses';
            let baseUrl = 'https://api.openai.com/v1';

            if (config.provider === 'anthropic') {
                modelId = config.modelId || 'claude-3-5-sonnet-latest';
                const found = availableModels.find((m: any) => m.id === modelId);
                modelName = found ? found.name || modelId : 'Claude 3.5 Sonnet';
                modelApi = 'anthropic-messages';
                baseUrl = 'https://api.anthropic.com';
            } else if (config.provider === 'venice') {
                modelId = config.modelId || 'llama-3.3-70b';
                const found = availableModels.find((m: any) => m.id === modelId);
                modelName = found ? found.name || modelId : 'Venice Model';
                modelApi = 'openai-completions';
                baseUrl = 'https://api.venice.ai/api/v1';
            } else if (config.provider === 'openai') {
                modelId = config.modelId || 'gpt-4o';
                const found = availableModels.find((m: any) => m.id === modelId);
                modelName = found ? found.name || modelId : 'OpenAI Model';
                modelApi = 'openai-responses';
                baseUrl = 'https://api.openai.com/v1';
            } else if (config.provider === 'blueprint_shared') {
                modelId = 'blueprint/shared-model';
                modelName = 'Blueprint Managed Intelligence';
                modelApi = 'openai-responses';
                baseUrl = 'https://api.blueprint.network/v1';
            }

            const finalConfig = {
                ...existingConfig,
                auth: {
                    ...(existingConfig.auth || {}),
                    profiles: {
                        ...(existingConfig.auth?.profiles || {}),
                        'default': {
                            provider: config.provider,
                            mode: 'api_key'
                        }
                    }
                },
                models: {
                    ...(existingConfig.models || {}),
                    providers: {
                        ...(existingConfig.models?.providers || {}),
                        [config.provider]: {
                            apiKey: config.token,
                            baseUrl,
                            models: [
                                { id: modelId, name: modelName, api: modelApi, compat: {} }
                            ]
                        }
                    }
                },
                agents: {
                    ...(existingConfig.agents || {}),
                    defaults: {
                        ...(existingConfig.agents?.defaults || {}),
                        workspace: `/home/node/.openclaw`,
                        model: {
                            ...(existingConfig.agents?.defaults?.model || {}),
                            primary: `${config.provider}/${modelId}`
                        },
                        models: {
                            ...(existingConfig.agents?.defaults?.models || {}),
                            [`${config.provider}/${modelId}`]: {}
                        }
                    }
                },
                gateway: {
                    ...(existingConfig.gateway || {}),
                    auth: {
                        ...(existingConfig.gateway?.auth || {}),
                        mode: 'token',
                        token: config.gatewayToken
                    },
                    bind: 'lan',
                    http: {
                        ...(existingConfig.gateway?.http || {}),
                        endpoints: {
                            ...(existingConfig.gateway?.http?.endpoints || {}),
                            chatCompletions: { enabled: true }
                        }
                    }
                },
                channels: {
                    ...(existingConfig.channels || {}),
                    ...channelsConfig
                }
            };

            await onSave(finalConfig, { security_level: securityLevel, avatar }, name);
            onClose();
        } catch (err) {
            console.error('Failed to save OpenClaw config:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleImportJson = () => {
        try {
            const parsed = JSON.parse(pastedJson);
            // Derive config from parsed JSON
            setConfig((prev: any) => ({ ...prev, ...parsed }));
            setJsonMode(false); // Switch back to wizard populated with JSON data
            // If the JSON had model info, etc, it will be reflected in later steps
        } catch (err: any) {
            alert('Invalid JSON: ' + err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" onClick={onClose} />

            <div className="bg-slate-950 border border-white/10 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-white/5 flex">
                    {steps.map((s) => (
                        <div
                            key={s.id}
                            className={`h-full transition-all duration-500 ${step >= s.id ? 'bg-primary' : 'bg-transparent'}`}
                            style={{ width: `${100 / steps.length}%` }}
                        />
                    ))}
                </div>

                <div className="p-10">
                    <header className="flex items-center justify-between mb-10">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                {steps.find(s => s.id === step)?.icon}
                            </div>
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-widest">{steps.find(s => s.id === step)?.title}</h2>
                                <p className="text-xs text-muted-foreground font-bold">Step {step} of {steps.length}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </header>

                    <div className="min-h-[300px] animate-in slide-in-from-right-4 duration-300">
                        {step === 1 && (
                            <div className="space-y-8">
                                {!jsonMode ? (
                                    <>
                                        <div className="space-y-6">
                                            <div className="flex flex-col gap-6 items-center">
                                                <div className="size-32 rounded-3xl bg-white/5 border-4 border-white/10 overflow-hidden relative group/avatar shadow-2xl">
                                                    {avatar ? (
                                                        <img src={avatar} className="w-full h-full object-cover" alt="Agent Avatar" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-white/10 bg-gradient-to-br from-white/5 to-transparent">
                                                            <User size={48} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="w-full space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Identity Callsign</label>
                                                        <input
                                                            type="text"
                                                            value={name}
                                                            onChange={(e) => setName(e.target.value)}
                                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-lg focus:border-primary outline-none transition-all placeholder:text-white/10"
                                                            placeholder="Ghost in the Shell..."
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avatar Visualization (URL)</label>
                                                        <input
                                                            type="text"
                                                            value={avatar}
                                                            onChange={(e) => setAvatar(e.target.value)}
                                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm focus:border-primary outline-none transition-all placeholder:text-white/10"
                                                            placeholder="https://images.unsplash.com/photo..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative py-4">
                                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                                            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30"><span className="bg-slate-950 px-4">OR</span></div>
                                        </div>

                                        <button
                                            onClick={() => setJsonMode(true)}
                                            className="w-full p-6 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center justify-center gap-4 group"
                                        >
                                            <Terminal size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                            <div className="text-left">
                                                <h4 className="font-black text-[10px] uppercase tracking-widest text-muted-foreground group-hover:text-white transition-colors">Direct Matrix Injection</h4>
                                                <p className="text-[10px] text-muted-foreground/40 font-medium italic">Paste raw OpenClaw JSON configuration</p>
                                            </div>
                                        </button>
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-primary">Neural Matrix JSON</label>
                                            <button onClick={() => setJsonMode(false)} className="text-[10px] font-black uppercase text-muted-foreground hover:text-white">Back to Wizard</button>
                                        </div>
                                        <textarea
                                            value={pastedJson}
                                            onChange={(e) => setPastedJson(e.target.value)}
                                            rows={12}
                                            className="w-full bg-black/40 border border-white/10 rounded-3xl p-6 font-mono text-[10px] focus:border-primary outline-none transition-all custom-scrollbar h-[350px]"
                                            placeholder={`{
  "auth": { ... },
  "gateway": { ... },
  "channels": { ... }
}`}
                                        />
                                        <button
                                            onClick={handleImportJson}
                                            disabled={!pastedJson}
                                            className="w-full py-4 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-primary/20"
                                        >
                                            <Activity size={16} /> Synchronize Neural Matrix
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Choose the primary intelligence source for **{name || agent.name}**.
                                </p>
                                <div className="grid grid-cols-1 gap-4">
                                    {[
                                        { id: 'blueprint_shared', name: 'BlueprintS Shared', desc: 'Free tier community intelligence (Rate Limited).', icon: <Share2 className="text-blue-400" /> },
                                        { id: 'venice', name: 'Venice AI', desc: 'Uncensored, private, and high-performance.', icon: <Cpu className="text-purple-400" /> },
                                        { id: 'anthropic', name: 'Anthropic Claude', desc: 'Optimized for reasoning and coding.', icon: <Bot className="text-orange-500" /> },
                                        { id: 'openai', name: 'OpenAI GPT', desc: 'Fast, reliable, and versatile.', icon: <Zap className="text-green-500" /> },
                                    ].map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setConfig({ ...config, provider: p.id })}
                                            className={`p-6 rounded-3xl border text-left transition-all flex items-center gap-6 ${config.provider === p.id ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                                        >
                                            <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
                                                {p.icon}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-black text-sm uppercase tracking-widest mb-1">{p.name}</h4>
                                                <p className="text-xs text-muted-foreground font-medium">{p.desc}</p>
                                            </div>
                                            {config.provider === p.id && <div className="size-6 rounded-full bg-primary flex items-center justify-center text-white"><Check size={14} /></div>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Authentication</label>
                                    {config.provider === 'blueprint_shared' ? (
                                        <div className="p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-4">
                                            <div className="p-2 rounded-full bg-blue-500/10 text-blue-400 mt-1">
                                                <ShieldCheck size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-blue-100 mb-2">Managed Access</h4>
                                                <p className="text-xs text-blue-200/60 leading-relaxed">
                                                    You are using the Blueprint Community shared pool. No manual API key is required.
                                                </p>
                                                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-blue-300">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Rate Limits Active
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative">
                                                <input
                                                    type="password"
                                                    value={config.token}
                                                    onChange={(e) => setConfig({ ...config, token: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-mono text-sm focus:border-primary outline-none transition-all"
                                                    placeholder={`sk-${config.provider.substring(0, 3)}...`}
                                                    autoFocus
                                                />
                                                <Key className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={20} />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground font-medium italic">
                                                * Your keys are encrypted locally before transmission.
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                        Select the neural model for **{name || agent.name}**.
                                    </p>
                                    <button
                                        onClick={() => fetchModels(config.provider, config.token)}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                                    >
                                        <Zap size={12} /> Refresh List
                                    </button>
                                </div>

                                {fetchingModels ? (
                                    <div className="h-[200px] flex flex-col items-center justify-center gap-4 bg-white/5 rounded-3xl border border-white/5 animate-pulse">
                                        <Loader2 size={32} className="animate-spin text-primary" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Synchronizing with Provider Registry...</p>
                                    </div>
                                ) : modelError ? (
                                    <div className="p-6 rounded-3xl border border-red-500/20 bg-red-500/5 text-center space-y-4">
                                        <p className="text-xs text-red-400 font-medium">{modelError}</p>
                                        <button
                                            onClick={() => setStep(2)}
                                            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
                                        >
                                            Check API Key
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {availableModels.map((m: any) => (
                                            <button
                                                key={m.id}
                                                onClick={() => setConfig({ ...config, modelId: m.id })}
                                                className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-4 ${config.modelId === m.id ? 'border-primary bg-primary/5' : 'border-white/5 bg-white/5 hover:border-white/10'}`}
                                            >
                                                <div className="size-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                                                    <Cpu size={16} className={config.modelId === m.id ? 'text-primary' : 'text-muted-foreground'} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-xs uppercase tracking-widest mb-0.5">{m.name || m.id}</h4>
                                                    <p className="text-[10px] text-muted-foreground font-mono opacity-50">{m.id}</p>
                                                </div>
                                                {config.modelId === m.id && <Check size={14} className="text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-6">
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Configure the operating privileges for **{name || agent.name}**. Higher levels require higher User Tiers.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        {
                                            level: SecurityLevel.STANDARD,
                                            title: 'Standard',
                                            icon: <Shield size={24} className="text-green-400" />,
                                            desc: 'Workspace access and read-only system.'
                                        },
                                        {
                                            level: SecurityLevel.PRO,
                                            title: 'Professional',
                                            icon: <Lock size={24} className="text-amber-400" />,
                                            desc: 'Read-only system access with limited privileges.'
                                        },
                                        {
                                            level: SecurityLevel.ADVANCED,
                                            title: 'Advanced',
                                            icon: <Unlock size={24} className="text-red-500" />,
                                            desc: 'Full container access with elevated privileges.'
                                        }
                                    ].map((opt) => {
                                        const allowed = resolveSecurityLevel(tier, opt.level) === opt.level;
                                        const isSelected = securityLevel === opt.level;

                                        return (
                                            <button
                                                key={opt.level}
                                                onClick={() => allowed && setSecurityLevel(opt.level)}
                                                disabled={!allowed}
                                                className={`p-6 rounded-3xl border text-left transition-all flex flex-col gap-4 relative overflow-hidden ${isSelected
                                                    ? 'border-primary bg-primary/10 ring-4 ring-primary/10'
                                                    : allowed
                                                        ? 'border-white/5 bg-white/5 hover:border-white/10'
                                                        : 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start w-full">
                                                    <div className="p-3 rounded-2xl bg-white/5">
                                                        {opt.icon}
                                                    </div>
                                                    {isSelected && <div className="text-primary"><Check size={20} /></div>}
                                                    {!allowed && <div className="text-muted-foreground px-2 py-1 rounded bg-white/5 text-[10px] font-black uppercase">Locked</div>}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-sm uppercase tracking-widest mb-2">{opt.title}</h4>
                                                    <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium flex gap-3 items-center">
                                    <ShieldCheck size={16} />
                                    <span>
                                        Your current tier is <strong>{tier.toUpperCase()}</strong>.
                                        {tier === 'free' && " Upgrade to Pro for Privileged access."}
                                    </span>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="space-y-8">
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Select which communication channels <strong>{name || agent.name}</strong> should be available on.
                                </p>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[
                                        { id: 'telegram', name: 'Telegram', icon: <Send size={20} className="text-blue-400" /> },
                                        { id: 'discord', name: 'Discord', icon: <Hash size={20} className="text-indigo-400" /> },
                                        { id: 'whatsapp', name: 'WhatsApp', icon: <MessageCircle size={20} className="text-green-400" /> },
                                        { id: 'slack', name: 'Slack', icon: <Slack size={20} className="text-amber-400" /> },
                                    ].map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setConfig({
                                                    ...config,
                                                    channels: { ...config.channels, [c.id]: !(config.channels as any)[c.id] }
                                                });
                                            }}
                                            className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-4 text-center ${(config.channels as any)[c.id]
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-white/5 bg-white/5 hover:bg-white/10 text-muted-foreground'
                                                }`}
                                        >
                                            <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
                                                {c.icon}
                                            </div>
                                            <span className="font-bold text-xs uppercase tracking-widest">{c.name}</span>
                                            {(config.channels as any)[c.id] && (
                                                <div className="absolute top-4 right-4 text-primary">
                                                    <Check size={14} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 6 && (
                            <div className="space-y-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Configure credentials for your active channels.
                                </p>

                                {Object.values(config.channels).every(v => !v) && (
                                    <div className="p-6 rounded-2xl border border-dashed border-white/10 text-center text-muted-foreground text-xs">
                                        Agent will be deployed with mandatory terminal only.
                                    </div>
                                )}

                                {config.channels.telegram && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Send size={12} /> Telegram Bot Token</label>
                                        <input
                                            type="password"
                                            value={config.telegramToken}
                                            onChange={(e) => setConfig({ ...config, telegramToken: e.target.value })}
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-3 font-mono text-xs focus:border-primary outline-none transition-all"
                                            placeholder="123456789:ABCDefgh..."
                                        />
                                    </div>
                                )}
                                {config.channels.discord && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Hash size={12} /> Discord Bot Token</label>
                                        <input
                                            type="password"
                                            value={config.discordToken}
                                            onChange={(e) => setConfig({ ...config, discordToken: e.target.value })}
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-3 font-mono text-xs focus:border-primary outline-none transition-all"
                                            placeholder="MTA..."
                                        />
                                    </div>
                                )}
                                {config.channels.whatsapp && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><MessageCircle size={12} /> WhatsApp Business Token</label>
                                        <input
                                            type="password"
                                            value={config.whatsappToken}
                                            onChange={(e) => setConfig({ ...config, whatsappToken: e.target.value })}
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-3 font-mono text-xs focus:border-primary outline-none transition-all"
                                            placeholder="EAAG..."
                                        />
                                    </div>
                                )}
                                {config.channels.slack && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Slack size={12} /> Slack Bot Token</label>
                                        <input
                                            type="password"
                                            value={config.slackToken}
                                            onChange={(e) => setConfig({ ...config, slackToken: e.target.value })}
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-3 font-mono text-xs focus:border-primary outline-none transition-all"
                                            placeholder="xoxb-..."
                                        />
                                    </div>
                                )}

                            </div>
                        )}

                    </div>

                    <footer className="mt-12 flex gap-4">
                        {step > 1 && (
                            <button
                                onClick={() => {
                                    if (step === 1) return;
                                    setStep(step - 1);
                                }}
                                disabled={step === 1}
                                className="px-8 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2 disabled:opacity-20"
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                        )}
                        {step < steps[steps.length - 1].id ? (
                            <button
                                onClick={() => {
                                    if (step === 2 && config.provider !== 'blueprint_shared') {
                                        fetchModels(config.provider, config.token);
                                        setStep(3);
                                    } else {
                                        setStep(step + 1);
                                    }
                                }}
                                disabled={(step === 2 && config.provider !== 'blueprint_shared' && !config.token)}
                                className="flex-1 py-4 rounded-2xl bg-white text-black hover:opacity-90 active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-4 rounded-2xl bg-primary text-white hover:opacity-90 active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Create Neural Matrix
                            </button>
                        )}
                    </footer>
                </div>
            </div>
        </div >
    );
}
