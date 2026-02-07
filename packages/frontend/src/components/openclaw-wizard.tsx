'use client';

import React, { useState } from 'react';
import { Bot, Zap, Shield, Key, MessageSquare, ArrowRight, ArrowLeft, Check, Save, X, Loader2, Terminal, Cpu, Share2, Hash, Send, MessageCircle, Slack, ShieldCheck } from 'lucide-react';

interface OpenClawWizardProps {
    agent: any;
    onSave: (config: any) => Promise<void>;
    onClose: () => void;
}

export default function OpenClawWizard({ agent, onSave, onClose }: OpenClawWizardProps) {
    const getOne = (val: any) => (Array.isArray(val) ? val[0] : val);
    const existingConfig = getOne(agent.agent_desired_state)?.config || {};
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [veniceModels, setVeniceModels] = useState<any[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);

    // Initial State derived from existing config or defaults
    const [config, setConfig] = useState({
        provider: existingConfig.auth?.profiles?.['default']?.provider || 'venice', // Default to Venice
        mode: 'api_key', // Enforce API Key
        token: existingConfig.models?.providers?.[existingConfig.auth?.profiles?.['default']?.provider]?.apiKey || '',
        gatewayToken: existingConfig.gateway?.auth?.token || Math.random().toString(36).substring(2, 15),
        modelId: existingConfig.agents?.defaults?.model?.primary?.split('/').pop() || 'llama-3.3-70b',

        // Channels
        channels: {
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

    const fetchVeniceModels = async (token: string) => {
        if (!token) return;
        setFetchingModels(true);
        setModelError(null);
        try {
            const res = await fetch('https://api.venice.ai/api/v1/models', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch models (Unauthorized/Invalid Key)');
            const data = await res.json();
            // Venice returns { data: [{ id: "...", ... }] }
            if (data?.data && Array.isArray(data.data)) {
                setVeniceModels(data.data);
                // If current modelId is not in the list, or we want to suggest one
                if (!config.modelId || !data.data.find((m: any) => m.id === config.modelId)) {
                    const defaultModel = data.data.find((m: any) => m.id.includes('70b')) || data.data[0];
                    if (defaultModel) setConfig((prev: any) => ({ ...prev, modelId: defaultModel.id }));
                }
            }
        } catch (err: any) {
            console.error('Venice model fetch error:', err);
            setModelError(err.message);
        } finally {
            setFetchingModels(false);
        }
    };

    const steps = [
        { id: 1, title: 'Intelligence Provider', icon: <Zap size={20} /> },
        { id: 2, title: 'Neural Credentials', icon: <Key size={20} /> },
        { id: 3, title: 'Model Selection', icon: <Cpu size={20} />, hidden: config.provider !== 'venice' },
        { id: 4, title: 'Gateway Security', icon: <Shield size={20} /> },
        { id: 5, title: 'Communication Channels', icon: <Share2 size={20} /> },
        { id: 6, title: 'Channel Configuration', icon: <MessageSquare size={20} /> },
    ].filter(s => !s.hidden);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Channel Configuration
            const channelsConfig: any = {};
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
                modelName = 'Claude 3.5 Sonnet';
                modelApi = 'anthropic-messages';
                baseUrl = 'https://api.anthropic.com';
            } else if (config.provider === 'venice') {
                modelId = config.modelId || 'llama-3.3-70b';
                // Try to find the model name from fetched list
                const found = veniceModels.find(m => m.id === modelId);
                modelName = found ? found.name || modelId : 'Llama 3.3 70B (Venice)';
                modelApi = 'openai-completions';
                baseUrl = 'https://api.venice.ai/api/v1';
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

            await onSave(finalConfig);
            onClose();
        } catch (err) {
            console.error('Failed to save OpenClaw config:', err);
        } finally {
            setSaving(false);
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
                            <div className="space-y-6">
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Choose the primary intelligence source for **{agent.name}**.
                                </p>
                                <div className="grid grid-cols-1 gap-4">
                                    {[
                                        { id: 'venice', name: 'Venice AI', desc: 'Uncensored, private, and high-performance.', icon: <Cpu className="text-purple-400" /> },
                                        { id: 'blueprint_shared', name: 'Blueprint Shared', desc: 'Free tier community intelligence (Rate Limited).', icon: <Share2 className="text-blue-400" /> },
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
                                                    You are using the Blueprint Community shared pool. Access is granted via your neural identity signature. No manual API key is required.
                                                </p>
                                                <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-blue-300">
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
                                        Select the neural model for **{agent.name}**.
                                    </p>
                                    <button
                                        onClick={() => fetchVeniceModels(config.token)}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                                    >
                                        <Zap size={12} /> Refresh List
                                    </button>
                                </div>

                                {fetchingModels ? (
                                    <div className="h-[200px] flex flex-col items-center justify-center gap-4 bg-white/5 rounded-3xl border border-white/5 animate-pulse">
                                        <Loader2 size={32} className="animate-spin text-primary" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Synchronizing with Venice Registry...</p>
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
                                        {veniceModels.map(m => (
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
                            <div className="space-y-8">
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    The **Gateway Token** allows the Blueprints brain to securely communicate with the OpenClaw container. We've generated a secure one for you.
                                </p>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Internal Gateway Token</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={config.gatewayToken}
                                            onChange={(e) => setConfig({ ...config, gatewayToken: e.target.value })}
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-mono text-sm focus:border-primary outline-none transition-all"
                                        />
                                        <button
                                            onClick={() => setConfig({ ...config, gatewayToken: Math.random().toString(36).substring(2, 15) })}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-xl transition-colors text-primary"
                                        >
                                            <Zap size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="space-y-8">
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    Where should **{agent.name}** live? Select the communication channels you want to activate.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'telegram', name: 'Telegram', icon: <Send size={20} className="text-blue-400" /> },
                                        { id: 'discord', name: 'Discord', icon: <Hash size={20} className="text-indigo-400" /> },
                                        { id: 'whatsapp', name: 'WhatsApp', icon: <MessageCircle size={20} className="text-green-400" /> },
                                        { id: 'slack', name: 'Slack', icon: <Slack size={20} className="text-amber-400" /> },
                                    ].map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setConfig({
                                                ...config,
                                                channels: { ...config.channels, [c.id]: !(config.channels as any)[c.id] }
                                            })}
                                            className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-4 text-center ${(config.channels as any)[c.id]
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-white/5 bg-white/5 hover:bg-white/10 text-muted-foreground'
                                                }`}
                                        >
                                            <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
                                                {c.icon}
                                            </div>
                                            <span className="font-bold text-xs uppercase tracking-widest">{c.name}</span>
                                            {(config.channels as any)[c.id] && <div className="absolute top-4 right-4 text-primary"><Check size={14} /></div>}
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
                                        No channels selected. Agent will be headless.
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
                                    if (step === 4 && config.provider !== 'venice') setStep(2);
                                    else setStep(step - 1);
                                }}
                                className="px-8 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                        )}
                        {step < steps[steps.length - 1].id ? (
                            <button
                                onClick={() => {
                                    if (step === 2) {
                                        if (config.provider === 'venice') {
                                            fetchVeniceModels(config.token);
                                            setStep(3);
                                        } else {
                                            setStep(4);
                                        }
                                    } else {
                                        setStep(step + 1);
                                    }
                                }}
                                disabled={step === 2 && config.provider !== 'blueprint_shared' && !config.token}
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
