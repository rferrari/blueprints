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

    // Initial State derived from existing config or defaults
    const [config, setConfig] = useState({
        provider: existingConfig.auth?.profiles?.['default']?.provider || 'venice', // Default to Venice
        mode: 'api_key', // Enforce API Key
        token: existingConfig.models?.providers?.[existingConfig.auth?.profiles?.['default']?.provider]?.apiKey || '',
        gatewayToken: existingConfig.gateway?.auth?.token || Math.random().toString(36).substring(2, 15),

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

    const steps = [
        { id: 1, title: 'Intelligence Provider', icon: <Zap size={20} /> },
        { id: 2, title: 'Neural Credentials', icon: <Key size={20} /> },
        { id: 3, title: 'Gateway Security', icon: <Shield size={20} /> },
        { id: 4, title: 'Communication Channels', icon: <Share2 size={20} /> },
        { id: 5, title: 'Channel Configuration', icon: <MessageSquare size={20} /> },
    ];

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
            let modelId = 'gpt-4o';
            let modelName = 'GPT-4o';
            let modelApi = 'openai-responses';
            let baseUrl = 'https://api.openai.com/v1';

            if (config.provider === 'anthropic') {
                modelId = 'claude-3-5-sonnet-latest';
                modelName = 'Claude 3.5 Sonnet';
                modelApi = 'anthropic-messages';
                baseUrl = 'https://api.anthropic.com';
            } else if (config.provider === 'venice') {
                modelId = 'venice/llama-3.3-70b';
                modelName = 'Llama 3.3 70B (Venice)';
                modelApi = 'openai-responses'; // Venice is OpenAI compatible
                baseUrl = 'https://api.venice.ai/api/v1';
            } else if (config.provider === 'blueprint_shared') {
                modelId = 'blueprint/shared-model';
                modelName = 'Blueprint Managed Intelligence';
                modelApi = 'openai-responses';
                baseUrl = 'https://api.blueprint.network/v1'; // Fictional internal endpoint
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

                        {step === 4 && (
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

                        {step === 5 && (
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
                                onClick={() => setStep(step - 1)}
                                className="px-8 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                            >
                                <ArrowLeft size={16} /> Back
                            </button>
                        )}
                        {step < steps.length ? (
                            <button
                                onClick={() => setStep(step + 1)}
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
