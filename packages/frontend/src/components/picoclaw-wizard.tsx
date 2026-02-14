'use client';

import React, { useState } from 'react';
import { Save, X, Cpu, Globe, Database, Code, Shield } from 'lucide-react';

type AgentConfig = {
    model: string;
    providers: Record<string, unknown>;
    tools: Record<string, unknown>;
    [key: string]: unknown;
};

interface PicoClawWizardProps {
    agent: {
        id: string;
        name?: string;
        agent_desired_state?: {
            config?: AgentConfig;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    };
    actual?: {
        status?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    };
    onSave: (config: AgentConfig, metadata?: unknown, name?: string) => Promise<void>;
    onClose: () => void;
}

export default function PicoClawWizard({ agent, actual, onSave, onClose }: PicoClawWizardProps) {
    const existingConfig: AgentConfig = agent.agent_desired_state?.config || {
        model: "openrouter/auto",
        providers: {},
        tools: {}
    };

    const [config, setConfig] = useState<AgentConfig>(existingConfig);
    const [name, setName] = useState(agent.name || "PicoClaw Agent");
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'providers' | 'json'>('general');
    const [jsonError, setJsonError] = useState<string | null>(null);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(config, {}, name);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0A0A0A] w-full max-w-5xl h-[85vh] rounded-xl border border-white/10 flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#0A0A0A]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-gradient-to-tr from-purple-500 to-cyan-500 flex items-center justify-center">
                            <Cpu className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">PicoClaw Configuration</h2>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
                                {agent.id.split('-')[0]} • {actual?.status || 'OFFLINE'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-64 border-r border-white/10 bg-zinc-900/30 flex flex-col">
                        <div className="p-4 space-y-2">
                            <button
                                onClick={() => setActiveTab('general')}
                                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeTab === 'general' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-zinc-400 hover:bg-white/5'}`}
                            >
                                <Globe className="w-4 h-4" />
                                <span className="font-medium text-sm">General</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('providers')}
                                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeTab === 'providers' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-zinc-400 hover:bg-white/5'}`}
                            >
                                <Database className="w-4 h-4" />
                                <span className="font-medium text-sm">Providers</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('json')}
                                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${activeTab === 'json' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'text-zinc-400 hover:bg-white/5'}`}
                            >
                                <Code className="w-4 h-4" />
                                <span className="font-medium text-sm">JSON Config</span>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto bg-[#050505] p-8">
                        {activeTab === 'general' && (
                            <div className="max-w-2xl space-y-8">
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium text-zinc-400">Agent Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium text-zinc-400">Model ID</label>
                                    <input
                                        type="text"
                                        value={config.model}
                                        onChange={(e) => updateConfig('model', e.target.value)}
                                        placeholder="openrouter/auto"
                                        className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                    />
                                    <p className="text-xs text-zinc-500">Default model for the agent (e.g. gpt-4, openrouter/auto)</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'providers' && (
                            <div className="max-w-2xl space-y-8">
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200 text-sm">
                                    Provider configuration for PicoClaw is currently JSON-only. Switch to the JSON tab for advanced setup.
                                </div>
                            </div>
                        )}

                        {activeTab === 'json' && (
                            <div className="h-full flex flex-col space-y-4">
                                <textarea
                                    value={JSON.stringify(config, null, 2)}
                                    onChange={(e) => {
                                        try {
                                            const parsed = JSON.parse(e.target.value);
                                            setConfig(parsed);
                                            setJsonError(null);
                                        } catch (err) {
                                            setJsonError((err as Error).message);
                                        }
                                    }}
                                    className="flex-1 bg-zinc-900/50 border border-white/10 rounded-lg p-4 font-mono text-sm text-zinc-300 focus:outline-none focus:border-purple-500/50"
                                />
                                {jsonError && (
                                    <div className="text-red-400 text-sm flex items-center gap-2">
                                        <Shield className="w-4 h-4" />
                                        {jsonError}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="h-20 border-t border-white/10 bg-[#0A0A0A] flex items-center justify-between px-8">
                    <div className="text-xs text-zinc-500">
                        {saving ? 'Saving changes...' : 'Unsaved changes will be lost'}
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !!jsonError}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
