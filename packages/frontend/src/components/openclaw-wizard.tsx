'use client';

import React, { useState } from 'react';
import { Bot, Zap, Shield, Key, MessageSquare, ArrowRight, ArrowLeft, Check, Save, X, Loader2, Terminal } from 'lucide-react';

interface OpenClawWizardProps {
    agent: any;
    onSave: (config: any) => Promise<void>;
    onClose: () => void;
}

export default function OpenClawWizard({ agent, onSave, onClose }: OpenClawWizardProps) {
    const existingConfig = agent.agent_desired_state?.[0]?.config || {};
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);

    // Initial State derived from existing config or defaults
    const [config, setConfig] = useState({
        provider: existingConfig.auth?.profiles?.['default']?.provider || 'anthropic',
        mode: existingConfig.auth?.profiles?.['default']?.mode || 'api_key',
        token: existingConfig.auth?.profiles?.['default']?.token || '',
        gatewayToken: existingConfig.gateway?.auth?.token || Math.random().toString(36).substring(2, 15),
        telegramToken: existingConfig.channels?.telegram?.token || '',
        ...existingConfig
    });

    const steps = [
        { id: 1, title: 'Intelligence Provider', icon: <Zap size={20} /> },
        { id: 2, title: 'Neural Credentials', icon: <Key size={20} /> },
        { id: 3, title: 'Gateway Security', icon: <Shield size={20} /> },
        { id: 4, title: 'Neural Channels', icon: <MessageSquare size={20} /> },
    ];

    const handleSave = async () => {
        setSaving(true);
        try {
            // Transform back to OpenClaw specific schema
            const finalConfig = {
                auth: {
                    profiles: {
                        'default': {
                            provider: config.provider,
                            mode: config.mode
                        },
                        ...(config.provider === 'anthropic' && config.mode === 'token' ? {
                            'claude': { provider: 'anthropic', mode: 'token' }
                        } : {})
                    }
                },
                models: {
                    providers: {
                        [config.provider]: {
                            apiKey: config.token,
                            baseUrl: config.provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1',
                            models: config.provider === 'anthropic' ? [
                                { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', api: 'anthropic-messages', compat: {} }
                            ] : [
                                { id: 'gpt-4o', name: 'GPT-4o', api: 'openai-responses', compat: {} }
                            ]
                        }
                    }
                },
                agents: {
                    defaults: {
                        workspace: `/home/node/.openclaw`,
                        model: {
                            primary: config.provider === 'anthropic' ? 'anthropic/claude-3-5-sonnet-latest' : 'openai/gpt-4o'
                        },
                        models: config.provider === 'anthropic' ? {
                            'anthropic/claude-3-5-sonnet-latest': {}
                        } : {
                            'openai/gpt-4o': {}
                        }
                    }
                },
                gateway: {
                    auth: {
                        mode: 'token',
                        token: config.gatewayToken
                    },
                    bind: 'lan',
                    http: {
                        endpoints: {
                            chatCompletions: {
                                enabled: true
                            }
                        }
                    }
                },
                channels: {
                    ...(config.telegramToken ? { telegram: { enabled: true, botToken: config.telegramToken } } : {})
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
                                    Choose the primary intelligence source for **{agent.name}**. OpenClaw supports both direct API access and session-based automation.
                                </p>
                                <div className="grid grid-cols-1 gap-4">
                                    {[
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
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Authentication Mode</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setConfig({ ...config, mode: 'api_key' })}
                                            className={`py-4 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${config.mode === 'api_key' ? 'bg-white text-black border-white' : 'border-white/5 text-muted-foreground hover:bg-white/5'}`}
                                        >
                                            API KEY
                                        </button>
                                        <button
                                            onClick={() => setConfig({ ...config, mode: 'token' })}
                                            className={`py-4 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-all ${config.mode === 'token' ? 'bg-white text-black border-white' : 'border-white/5 text-muted-foreground hover:bg-white/5'}`}
                                        >
                                            SESSION TOKEN
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        {config.mode === 'api_key' ? 'Enter API Key' : 'Enter Session Token (sk-ant-sid...)'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={config.token}
                                            onChange={(e) => setConfig({ ...config, token: e.target.value })}
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-mono text-sm focus:border-primary outline-none transition-all"
                                            placeholder={config.mode === 'api_key' ? 'sk-...' : 'sk-ant-sid01-...'}
                                        />
                                        <Key className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={20} />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-medium italic">
                                        * Secrets are stored securely in your encrypted vault.
                                    </p>
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
                                    Finally, where should **{agent.name}** live? You can connect various social channels now or skip and configure them later.
                                </p>
                                <div className="p-8 rounded-3xl bg-white/5 border border-white/5 space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                                            <MessageSquare size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-black text-xs uppercase tracking-widest">Telegram Integration</h4>
                                            <p className="text-[10px] text-muted-foreground font-bold">Bot Token (from @BotFather)</p>
                                        </div>
                                    </div>
                                    <input
                                        type="password"
                                        value={config.telegramToken}
                                        onChange={(e) => setConfig({ ...config, telegramToken: e.target.value })}
                                        className="w-full bg-black/20 border border-white/5 rounded-2xl px-5 py-3 font-mono text-xs focus:border-blue-400 outline-none transition-all"
                                        placeholder="123456789:ABCDefgh..."
                                    />
                                </div>
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
                                className="flex-1 py-4 rounded-2xl bg-white text-black hover:opacity-90 active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
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
                                Initialize Neural Matrix
                            </button>
                        )}
                    </footer>
                </div>
            </div>
        </div >
    );
}
