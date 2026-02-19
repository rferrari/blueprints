'use client';

import React, { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { UserTier, SecurityLevel, isModelCompatible } from '@eliza-manager/shared';
import { User, Zap, Shield, Share2, MessageSquare, X } from 'lucide-react';
import { useNotification } from '@/components/notification-provider';
import { Model, OpenClawConfig, OpenClawWizardProps } from './openclaw-wizard/types';
import { getOne } from './openclaw-wizard/utils';
import { StepIdentity } from './openclaw-wizard/step-identity';
import { StepProvider } from './openclaw-wizard/step-provider';
import { StepNeuralConfig } from './openclaw-wizard/step-neural-config';
import { StepSecurity } from './openclaw-wizard/step-security';
import { StepChannels } from './openclaw-wizard/step-channels';
import { StepChannelConfig } from './openclaw-wizard/step-channel-config';

export default function OpenClawWizard({ agent, onSave, onClose }: OpenClawWizardProps) {
    const { showNotification } = useNotification();
    const existingConfig = getOne(agent.agent_desired_state)?.config || {};
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [availableModels, setAvailableModels] = useState<Model[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [showAllModels, setShowAllModels] = useState(false);
    const [jsonMode, setJsonMode] = useState(false);
    const [name, setName] = useState(agent.name || '');
    const [metadata, setMetadata] = useState<Record<string, any>>(getOne(agent.agent_desired_state)?.metadata || {});
    const [avatar, setAvatar] = useState(metadata.avatar || '');

    // Tier & Security
    const supabase = createClient();
    const [tier, setTier] = useState<UserTier>(UserTier.FREE);
    const [securityLevel, setSecurityLevel] = useState<SecurityLevel>(SecurityLevel.STANDARD);

    const [mkEnabled, setMkEnabled] = useState(false);

    React.useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                const res = await fetch(`${API_URL}/settings/public`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setMkEnabled(data.enableManagedKeys);
                }
            } catch (err) {
                console.error('Failed to fetch system settings:', err);
            }
        };
        fetchSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        const fetchTier = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase.from('profiles').select('tier').eq('id', session.user.id).single();
                if (data) setTier(data.tier as UserTier);
            }
        };
        fetchTier();
    }, [supabase]);

    // Load initial security level from metadata if exists
    React.useEffect(() => {
        const existingLevel = getOne(agent.agent_desired_state)?.metadata?.security_level;
        if (existingLevel !== undefined) {
            setSecurityLevel(existingLevel);
        }
    }, [agent]);

    // Initial State derived from existing config or defaults
    const [config, setConfig] = useState<OpenClawConfig>({
        provider: metadata.lease_id ? 'blueprint_shared' : (existingConfig.auth?.profiles?.['default']?.provider || 'venice'),
        mode: 'api_key', // Enforce API Key
        // If editing, we start with an empty token to allow "leave blank to keep same"
        token: '',
        gatewayToken: existingConfig.gateway?.auth?.token || 'auto-generated-on-creation',
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

    const fetchModels = useCallback(async (provider: string, token: string, currentModelId?: string) => {
        if (!token) return;
        setFetchingModels(true);
        setModelError(null);
        try {
            let url = '';
            if (provider === 'venice') url = 'https://api.venice.ai/api/v1/models';
            else if (provider === 'openai') url = 'https://api.openai.com/v1/models';
            else if (provider === 'anthropic') url = 'https://api.anthropic.com/v1/models';
            else if (provider === 'groq') url = 'https://api.groq.com/openai/v1/models';
            else if (provider === 'deepseek') url = 'https://api.deepseek.com/models';
            else if (provider === 'mistral') url = 'https://api.mistral.ai/v1/models';

            if (!url) {
                setFetchingModels(false);
                return;
            }

            const headers: Record<string, string> = {};

            if (provider === 'anthropic') {
                headers['x-api-key'] = token;
                headers['anthropic-version'] = '2023-06-01';
            } else {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`);
            const data = await res.json();

            if (data?.data && Array.isArray(data.data)) {
                let models: Model[] = [];
                if (provider === 'venice') {
                    models = data.data.map((m: { id: string; model_spec?: { name?: string; capabilities?: { supportsFunctionCalling?: boolean } } }) => ({
                        id: m.id,
                        name: m.model_spec?.name || m.id,
                        isCompatible: m.model_spec?.capabilities?.supportsFunctionCalling === true
                    }));
                } else {
                    models = data.data.map((m: { id: string; name?: string; object?: string }) => ({
                        id: m.id,
                        name: m.id,
                        isCompatible: isModelCompatible(m.id)
                    }));
                }

                models.sort((a: Model, b: Model) => a.name.localeCompare(b.name));
                setAvailableModels(models);

                // If current model is not applicable, switch to a compatible one
                if (!currentModelId || !models.find(m => m.id === currentModelId)) {
                    const defaultModel = models.find(m => (m.id.includes('70b') || m.id.includes('gpt-4o')) && m.isCompatible) || models.find(m => m.isCompatible) || models[0];
                    if (defaultModel) setConfig((prev: OpenClawConfig) => ({ ...prev, modelId: defaultModel.id }));
                }
            }
        } catch (err: unknown) {
            console.error('Fetch models error:', err);
            const message = err instanceof Error ? err.message : 'Establishment failed';
            setModelError(message);
        } finally {
            setFetchingModels(false);
        }
    }, []);

    // Auto-sync models when token is pasted or provider changed
    React.useEffect(() => {
        if (config.token && config.token.length > 20) {
            fetchModels(config.provider, config.token, config.modelId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.token, config.provider, fetchModels]); // config.modelId intentionally excluded to prevent loop

    const steps = [
        { id: 1, title: 'Neural Identity', icon: <User size={20} /> },
        { id: 2, title: 'Intelligence Provider', icon: <Zap size={20} /> },
        { id: 3, title: 'Neural Configuration', icon: <MessageSquare size={20} /> }, // Icon changed to avoid duplicate Cpu import if possible, or just keep it
        { id: 4, title: 'Permissions & Security', icon: <Shield size={20} /> },
        { id: 5, title: 'Communication Channels', icon: <Share2 size={20} /> },
        { id: 6, title: 'Channel Configuration', icon: <MessageSquare size={20} /> },
    ];

    const handleSave = async () => {
        setSaving(true);
        try {
            // Channel Configuration
            const channelsConfig: Record<string, { enabled: boolean; botToken?: string; token?: string }> = {};
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
                const found = availableModels.find((m: Model) => m.id === modelId);
                modelName = found ? found.name || modelId : 'Claude 3.5 Sonnet';
                modelApi = 'anthropic-messages';
                baseUrl = 'https://api.anthropic.com';
            } else if (config.provider === 'venice') {
                modelId = config.modelId || 'llama-3.3-70b';
                const found = availableModels.find((m: Model) => m.id === modelId);
                modelName = found ? found.name || modelId : 'Venice Model';
                modelApi = 'openai-completions';
                baseUrl = 'https://api.venice.ai/api/v1';
            } else if (config.provider === 'openai') {
                modelId = config.modelId || 'gpt-4o';
                const found = availableModels.find((m: Model) => m.id === modelId);
                modelName = found ? found.name || modelId : 'OpenAI Model';
                modelApi = 'openai-responses';
                baseUrl = 'https://api.openai.com/v1';
            } else if (config.provider === 'groq') {
                modelId = config.modelId || 'llama-3.3-70b-versatile';
                const found = availableModels.find((m: Model) => m.id === modelId);
                modelName = found ? found.name || modelId : 'Groq Model';
                modelApi = 'openai-completions';
                baseUrl = 'https://api.groq.com/openai/v1';
            } else if (config.provider === 'deepseek') {
                modelId = config.modelId || 'deepseek-chat';
                const found = availableModels.find((m: Model) => m.id === modelId);
                modelName = found ? found.name || modelId : 'DeepSeek Model';
                modelApi = 'openai-completions';
                baseUrl = 'https://api.deepseek.com';
            } else if (config.provider === 'mistral') {
                modelId = config.modelId || 'mistral-large-latest';
                const found = availableModels.find((m: Model) => m.id === modelId);
                modelName = found ? found.name || modelId : 'Mistral Model';
                modelApi = 'openai-completions';
                baseUrl = 'https://api.mistral.ai/v1';
            } else if (config.provider === 'openrouter') {
                modelId = config.modelId || 'openrouter/auto';
                const found = availableModels.find((m: Model) => m.id === modelId);
                modelName = found ? found.name || modelId : 'OpenRouter Model';
                modelApi = 'openai-completions';
                baseUrl = 'https://openrouter.ai/api/v1';
            } else if (config.provider === 'ollama') {
                modelId = config.modelId || 'llama3';
                modelName = 'Local Model';
                modelApi = 'openai-completions';
                baseUrl = 'http://localhost:11434/v1';
            } else if (config.provider === 'blueprint_shared') {
                // Managed Provider Key: the backend handles config via lease allocation
                modelId = config.modelId || 'auto';
                modelName = 'Blueprint Managed Intelligence';
                modelApi = 'openai-completions';
                baseUrl = 'https://openrouter.ai/api/v1';
            }

            // For managed keys, call lease API and let backend write config
            if (config.provider === 'blueprint_shared') {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) throw new Error('Not authenticated');

                const leaseRes = await fetch(`${API_URL}/managed-keys/lease`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        provider: 'openrouter',
                        agent_id: agent.id,
                        framework: 'openclaw',
                    })
                });

                if (!leaseRes.ok) {
                    const err = await leaseRes.json().catch(() => ({}));
                    throw new Error(err.message || 'Failed to allocate managed key');
                }

                const leaseData = await leaseRes.json();

                // Save with lease metadata — backend already wrote the provider config
                await onSave(undefined, {
                    ...metadata,
                    security_level: securityLevel,
                    avatar,
                    lease_id: leaseData.lease_id,
                    lease_expires_at: leaseData.expires_at,
                    managed_key_provider: 'openrouter',
                }, name);
                onClose();
                return;
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
                            // If token is empty, preserve the existing one
                            apiKey: config.token || existingConfig.models?.providers?.[config.provider]?.apiKey || '',
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
                        workspace: `~/.openclaw/workspace`,
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

            await onSave(finalConfig, {
                ...metadata,
                security_level: securityLevel,
                avatar
            }, name);
            onClose();
        } catch (err: unknown) {
            console.error('Failed to save OpenClaw config:', err);
            const message = err instanceof Error ? err.message : 'System error. Operation failed.';
            showNotification(message, 'error');
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
                            <StepIdentity
                                avatar={avatar}
                                setAvatar={setAvatar}
                                name={name}
                                setName={setName}
                                setConfig={setConfig}
                                setJsonMode={setJsonMode}
                                jsonMode={jsonMode}
                            />
                        )}

                        {step === 2 && (
                            <StepProvider
                                name={name || agent.name}
                                config={config}
                                setConfig={setConfig}
                                mkEnabled={mkEnabled}
                            />
                        )}

                        {step === 3 && (
                            <StepNeuralConfig
                                config={config}
                                setConfig={setConfig}
                                existingConfig={existingConfig}
                                setStep={setStep}
                                availableModels={availableModels}
                                fetchingModels={fetchingModels}
                                modelError={modelError}
                                showAllModels={showAllModels}
                                setShowAllModels={setShowAllModels}
                                fetchModels={fetchModels}
                            />
                        )}

                        {step === 4 && (
                            <StepSecurity
                                tier={tier}
                                securityLevel={securityLevel}
                                setSecurityLevel={setSecurityLevel}
                                name={name || agent.name}
                            />
                        )}

                        {step === 5 && (
                            <StepChannels
                                name={name || agent.name}
                                config={config}
                                setConfig={setConfig}
                            />
                        )}

                        {step === 6 && (
                            <StepChannelConfig
                                config={config}
                                setConfig={setConfig}
                                existingConfig={existingConfig}
                            />
                        )}
                    </div>

                    <footer className="mt-10 flex justify-end gap-4 border-t border-white/5 pt-6">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="px-6 py-3 rounded-2xl hover:bg-white/5 text-muted-foreground font-bold text-xs uppercase tracking-widest transition-colors"
                            >
                                Back
                            </button>
                        )}
                        {step < steps.length ? (
                            <button
                                onClick={() => setStep(step + 1)}
                                disabled={step === 1 && !name && !jsonMode}
                                className="px-8 py-3 rounded-2xl bg-primary hover:opacity-90 active:scale-95 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:pointer-events-none"
                            >
                                Continue
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-8 py-3 rounded-2xl bg-green-500 hover:bg-green-600 active:scale-95 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-green-500/20 flex items-center gap-2"
                            >
                                {saving ? 'Initializing...' : 'Initialize Agent'}
                            </button>
                        )}
                    </footer>
                </div>
            </div>
        </div>
    );
}
