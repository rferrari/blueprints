import React from 'react';
import { Zap, ShieldCheck, Key, Lock, Unlock, Loader2, Cpu, Check } from 'lucide-react';
import { Model, OpenClawConfig } from './types';

interface StepNeuralConfigProps {
    config: OpenClawConfig;
    setConfig: (updater: (prev: OpenClawConfig) => OpenClawConfig) => void;
    existingConfig: Record<string, unknown>; // Changed from any
    setStep: (step: number) => void;
    availableModels: Model[];
    fetchingModels: boolean;
    modelError: string | null;
    showAllModels: boolean;
    setShowAllModels: (show: boolean) => void;
    fetchModels: (provider: string, token: string, currentModelId?: string) => void;
}

export function StepNeuralConfig({
    config,
    setConfig,
    existingConfig,
    setStep,
    availableModels,
    fetchingModels,
    modelError,
    showAllModels,
    setShowAllModels,
    fetchModels
}: StepNeuralConfigProps) {
    // Helper to safely access nested properties from existingConfig
    const getNested = (obj: any, path: string[]) => {
        return path.reduce((acc, part) => acc && acc[part], obj);
    };

    return (
        <div className="space-y-6">
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary">Neural Authentication</label>
                    <button
                        onClick={() => setStep(4)}
                        className="text-[10px] font-black uppercase text-muted-foreground hover:text-white transition-colors"
                    >
                        Skip for now (Configure via Terminal)
                    </button>
                </div>
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
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="relative">
                            <input
                                type="password"
                                value={config.token}
                                onChange={(e) => setConfig((prev) => ({ ...prev, token: e.target.value }))}
                                className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-mono text-sm focus:border-primary outline-none transition-all pr-12"
                                placeholder={getNested(existingConfig, ['models', 'providers', config.provider, 'apiKey']) ? "Leave blank to keep same key..." : `sk-${config.provider.substring(0, 3)}...`}
                            />
                            {getNested(existingConfig, ['models', 'providers', config.provider, 'apiKey']) && !config.token ? (
                                <Lock className="absolute right-6 top-1/2 -translate-y-1/2 text-primary/40 animate-pulse" size={20} />
                            ) : (
                                <Key className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground/30" size={20} />
                            )}
                        </div>

                        {getNested(existingConfig, ['models', 'providers', config.provider, 'apiKey']) && (
                            <div className="flex items-center gap-2 px-2">
                                <div className="size-2 rounded-full bg-primary shadow-sm shadow-primary/40" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Neural Key Present (Masked)</span>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Model Selection</label>
                        <div className="flex flex-col gap-1">
                            {config.modelId && !availableModels.length && (
                                <p className="text-[10px] text-muted-foreground/60 font-medium italic">
                                    Current Model: {getNested(existingConfig, ['agents', 'defaults', 'models', `${config.provider}/${config.modelId}`, 'name']) || config.modelId}
                                </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
                                💡 Tip: Choose models with large context windows (like gpt-4o) if you plan on using many tools or deep project context.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAllModels(!showAllModels)}
                            className={`text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1 ${showAllModels ? 'text-primary' : 'text-muted-foreground hover:text-white'}`}
                        >
                            {showAllModels ? <Unlock size={12} /> : <Lock size={12} />}
                            {showAllModels ? 'All' : 'Filtered'}
                        </button>
                        <button
                            onClick={() => fetchModels(config.provider, config.token, config.modelId)}
                            disabled={!config.token && config.provider !== 'blueprint_shared'}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1 disabled:opacity-30"
                        >
                            <Zap size={12} /> Sync
                        </button>
                    </div>
                </div>

                {fetchingModels ? (
                    <div className="h-[150px] flex flex-col items-center justify-center gap-4 bg-white/5 rounded-3xl border border-white/5">
                        <Loader2 size={24} className="animate-spin text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fetching neural models...</p>
                    </div>
                ) : modelError ? (
                    <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
                        <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">{modelError}</p>
                    </div>
                ) : availableModels.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {availableModels
                            .filter(m => showAllModels || m.isCompatible)
                            .map((m: Model) => (
                                <button
                                    key={m.id}
                                    onClick={() => setConfig((prev) => ({ ...prev, modelId: m.id }))}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${config.modelId === m.id ? 'border-primary bg-primary/5' : 'border-white/5 bg-white/5 hover:border-white/10'} ${!m.isCompatible ? 'opacity-40' : ''}`}
                                >
                                    <div className="size-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                        <Cpu size={12} className={config.modelId === m.id ? 'text-primary' : 'text-muted-foreground'} />
                                    </div>
                                    <div className="flex-1 truncate">
                                        <h4 className="font-bold text-[10px] uppercase tracking-widest truncate">{m.name || m.id}</h4>
                                    </div>
                                    {config.modelId === m.id && <Check size={12} className="text-primary" />}
                                </button>
                            ))}
                    </div>
                ) : (
                    <div className="h-[150px] flex flex-col items-center justify-center text-center p-6 bg-white/5 rounded-3xl border border-dashed border-white/10">
                        <p className="text-[10px] font-medium text-muted-foreground italic">Enter API key to synchronize available neural models or select a provider.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
