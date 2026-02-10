'use client';

import React, { useState } from 'react';
import { Save, X, Plus, Skull, Code, Layout, Loader2, Settings, Sparkles, Cpu, Globe, MessageSquare, Activity, User, Database, Zap, Shield, Bot } from 'lucide-react';

interface ElizaWizardProps {
    agent: any;
    actual: any;
    onSave: (config: any, metadata?: any, name?: string) => Promise<void>;
    onClose: () => void;
}

const availablePlugins = [
    { id: '@elizaos/plugin-bootstrap', name: 'Bootstrap', description: 'Core actions and message processing.' },
    { id: '@elizaos/plugin-twitter', name: 'Twitter', description: 'Interact with the X (Twitter) platform.' },
    { id: '@elizaos/plugin-discord', name: 'Discord', description: 'Seamless Discord integration.' },
    { id: '@elizaos/plugin-sql', name: 'SQL', description: 'Database and persistence layer.' },
    { id: '@elizaos/plugin-coingecko', name: 'CoinGecko', description: 'Real-time crypto market data.' },
];

export default function ElizaWizard({ agent, actual, onSave, onClose }: ElizaWizardProps) {
    const getOne = (val: any) => (Array.isArray(val) ? val[0] : val);
    const existingConfig = getOne(agent.agent_desired_state)?.config;

    // Default template based on user sample
    const defaultTemplate = {
        name: agent.name || "Eliza",
        username: agent.name?.toLowerCase().replace(/\s+/g, '_') || "eliza_ai",
        bio: [
            "An advanced AI assistant powered by elizaOS",
            "Specializes in technical support and creative problem-solving",
            "Continuously learning and adapting to user needs",
            "Built with privacy and security in mind"
        ],
        system: "You are Eliza, a helpful and knowledgeable AI assistant.\nCore principles:\n- Be helpful, harmless, and honest\n- Provide accurate, well-researched information\n- Admit uncertainty when appropriate\n- Respect user privacy and boundaries\n- Adapt your communication style to the user's needs",
        adjectives: ["helpful", "knowledgeable", "patient", "creative", "professional"],
        topics: ["programming", "web development", "artificial intelligence", "problem solving", "technology trends"],
        messageExamples: [
            [
                { "name": "{{user}}", "content": { "text": "Hello!" } },
                { "name": "Eliza", "content": { "text": "Hello! I'm Eliza, your AI assistant. How can I help you today?" } }
            ]
        ],
        postExamples: [
            "🚀 Just discovered an elegant solution to the N+1 query problem in GraphQL.",
            "Clean code is not about being clever, it's about being clear."
        ],
        style: {
            all: ["Be concise but comprehensive", "Use emoji sparingly"],
            chat: ["Be conversational and engaging", "Use markdown for code"],
            post: ["Be informative", "Include relevant hashtags"]
        },
        knowledge: [
            "I'm built on the elizaOS framework"
        ],
        plugins: ["@elizaos/plugin-sql", "@elizaos/plugin-bootstrap"],
        settings: {
            secrets: {},
            avatar: "https://elizaos.github.io/eliza-avatars/eliza.png"
        }
    };

    const [config, setConfig] = useState(existingConfig && Object.keys(existingConfig).length > 0 ? existingConfig : defaultTemplate);
    const [isJsonMode, setIsJsonMode] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'behavior' | 'style' | 'plugins' | 'secrets' | 'logs'>('profile');
    const [saving, setSaving] = useState(false);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [localJson, setLocalJson] = useState('');

    const [isAddingSecret, setIsAddingSecret] = useState(false);
    const [newSecretKey, setNewSecretKey] = useState('');
    const [newSecretValue, setNewSecretValue] = useState('');

    const logs = [
        `[${new Date().toISOString()}] INITIALIZING_NEURAL_LINK...`,
        `[${new Date().toISOString()}] SYNCING_DESIRED_STATE...`,
        `[${new Date().toISOString()}] SKILLS_MATRIX_LOCKED: ${agent.id}`,
        `[${new Date().toISOString()}] HEARBEAT_OK: ${actual?.status === 'running' ? 'STABLE' : 'PENDING'}`,
        `[${new Date().toISOString()}] PLUGINS_LOADED: ${config.plugins?.length || 0} ACTIVE`,
        `[${new Date().toISOString()}] READY_FOR_SIGNAL.`
    ];

    const handleSave = async () => {
        try {
            setSaving(true);

            let finalConfig = config;
            if (isJsonMode) {
                try {
                    finalConfig = JSON.parse(localJson);
                    setConfig(finalConfig);
                } catch (err: any) {
                    setJsonError(err.message);
                    setSaving(false);
                    return;
                }
            }

            await onSave(finalConfig, null, finalConfig.name);
            onClose();
        } catch (err: any) {
            alert('Failed to save configuration: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field: string, value: any) => {
        setConfig((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleJsonChange = (val: string) => {
        setLocalJson(val);
        try {
            JSON.parse(val);
            setJsonError(null);
        } catch (err: any) {
            setJsonError(err.message);
        }
    };

    const handleSyncJson = () => {
        try {
            const parsed = JSON.parse(localJson);
            setConfig(parsed);
            setJsonError(null);
        } catch (err: any) {
            setJsonError(err.message);
        }
    };

    const addItem = (field: string) => {
        const parts = field.split('.');
        if (parts.length === 1) {
            const current = config[field] || [];
            updateField(field, [...current, '']);
        } else {
            const [parent, child] = parts;
            const parentData = config[parent] || {};
            const childData = parentData[child] || [];
            updateField(parent, { ...parentData, [child]: [...childData, ''] });
        }
    };

    const removeItem = (field: string, index: number) => {
        const parts = field.split('.');
        if (parts.length === 1) {
            const current = config[field] || [];
            updateField(field, current.filter((_: any, i: number) => i !== index));
        } else {
            const [parent, child] = parts;
            const parentData = config[parent] || {};
            const childData = parentData[child] || [];
            updateField(parent, { ...parentData, [child]: childData.filter((_: any, i: number) => i !== index) });
        }
    };

    const updateItem = (field: string, index: number, value: string) => {
        const parts = field.split('.');
        if (parts.length === 1) {
            const current = [...(config[field] || [])];
            current[index] = value;
            updateField(field, current);
        } else {
            const [parent, child] = parts;
            const parentData = config[parent] || {};
            const childData = [...(parentData[child] || [])];
            childData[index] = value;
            updateField(parent, { ...parentData, [child]: childData });
        }
    };

    const togglePlugin = (pluginId: string) => {
        const current = config.plugins || [];
        if (current.includes(pluginId)) {
            updateField('plugins', current.filter((p: string) => p !== pluginId));
        } else {
            updateField('plugins', [...current, pluginId]);
        }
    };

    const renderArraySection = (title: string, field: string, icon: React.ReactNode, placeholder: string, color: string) => (
        <section className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <div className={`size-8 rounded-lg bg-${color}/10 flex items-center justify-center`}>
                    {icon}
                </div>
                <h3 className="font-black uppercase tracking-widest text-xs">{title}</h3>
            </div>
            <div className="space-y-4">
                {(field.split('.').reduce((o, i) => o?.[i], config) || []).map((entry: string, i: number) => (
                    <div key={i} className="flex gap-4 group/item">
                        <div className="flex-1 relative">
                            <textarea
                                value={entry}
                                onChange={(e) => updateItem(field, i, e.target.value)}
                                className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4 text-sm font-medium focus:border-primary/30 outline-none transition-all min-h-[80px] group-hover/item:bg-white/5"
                                placeholder={placeholder}
                            />
                            <div className={`absolute top-4 left-0 w-1 h-8 bg-${color}/30 rounded-r-full`} />
                        </div>
                        <button
                            onClick={() => removeItem(field, i)}
                            className="p-3 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-2xl transition-all self-start active:scale-95"
                        >
                            <Skull size={20} />
                        </button>
                    </div>
                ))}
                <button
                    onClick={() => addItem(field)}
                    className={`w-full py-4 border-2 border-dashed border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-${color} hover:border-${color}/30 hover:bg-${color}/5 transition-all flex items-center justify-center gap-2 group`}
                >
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Append {title.split(' ')[0]} Segment
                </button>
            </div>
        </section>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-3xl" onClick={onClose} />

            <div className="bg-slate-950/80 border border-white/10 rounded-[3.5rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-[0_32px_128px_-12px_rgba(0,0,0,0.8)] relative z-10 overflow-hidden animate-in zoom-in-95 duration-500">
                {/* Visual Decorations */}
                <div className="absolute -top-20 -right-20 size-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 size-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

                {/* Header */}
                <header className="p-10 border-b border-white/5 flex flex-col gap-8 bg-white/[0.02]">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-6">
                            <div className="size-16 rounded-[1.75rem] bg-gradient-unicorn p-0.5 shadow-2xl shadow-primary/20 animate-glow">
                                <div className="w-full h-full bg-slate-950 rounded-[calc(1.75rem-2px)] flex items-center justify-center">
                                    <Settings size={30} className="text-white" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black tracking-tighter mb-1">
                                    {agent.name} <span className="text-muted-foreground/40 tracking-normal font-medium text-lg italic ms-2">Config Matrix</span>
                                </h2>
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
                                        <Cpu size={12} /> Sync Level: High
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-white/5 p-1.5 rounded-[1.5rem] border border-white/5">
                            <button
                                onClick={() => setIsJsonMode(false)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${!isJsonMode ? 'bg-white text-black shadow-xl scale-105' : 'text-muted-foreground hover:text-white'}`}
                            >
                                <Layout size={14} /> Interface
                            </button>
                            <button
                                onClick={() => {
                                    setLocalJson(JSON.stringify(config, null, 4));
                                    setIsJsonMode(true);
                                }}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isJsonMode ? 'bg-white text-black shadow-xl scale-105' : 'text-muted-foreground hover:text-white'}`}
                            >
                                <Code size={14} /> Source
                            </button>
                        </div>
                    </div>

                    {!isJsonMode && (
                        <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5 self-start">
                            {[
                                { id: 'profile', label: 'Identity', icon: <User size={14} /> },
                                { id: 'behavior', label: 'Mindset', icon: <Sparkles size={14} /> },
                                { id: 'style', label: 'Linguistics', icon: <MessageSquare size={14} /> },
                                { id: 'plugins', label: 'Skills', icon: <Zap size={14} /> },
                                { id: 'secrets', label: 'Secrets', icon: <Shield size={14} /> },
                                { id: 'logs', label: 'Neural Logs', icon: <Code size={14} /> }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground/60 hover:text-white hover:bg-white/5'}`}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-black/20">
                    {!isJsonMode ? (
                        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
                            {activeTab === 'profile' && (
                                <div className="space-y-12">
                                    {/* Driver's License Style Identity Card */}
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-[2.5rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
                                        <div className="relative bg-slate-900/90 border border-white/10 rounded-[2.5rem] p-10 flex flex-col md:flex-row gap-10 shadow-2xl overflow-hidden">
                                            {/* Photo/Avatar Section */}
                                            <div className="flex flex-col gap-6 items-center shrink-0">
                                                <div className="size-40 rounded-3xl bg-white/5 border-4 border-white/10 overflow-hidden relative group/avatar">
                                                    {config.settings?.avatar ? (
                                                        <img src={config.settings.avatar} className="w-full h-full object-cover" alt="Agent Avatar" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-white/20">
                                                            <User size={64} />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                                        <Globe size={24} className="text-white" />
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 block mb-1">Status</span>
                                                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">Authorized Agent</span>
                                                </div>
                                            </div>

                                            {/* License Details */}
                                            <div className="flex-1 space-y-8">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Official Name</label>
                                                        <input
                                                            value={config.name || ''}
                                                            onChange={(e) => updateField('name', e.target.value)}
                                                            className="w-full bg-transparent border-b border-white/10 py-2 text-2xl font-black tracking-tight outline-none focus:border-primary transition-colors"
                                                            placeholder="NAME_REQUIRED"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em]">Matrix Username</label>
                                                        <input
                                                            value={config.username || ''}
                                                            onChange={(e) => updateField('username', e.target.value)}
                                                            className="w-full bg-transparent border-b border-white/10 py-2 text-2xl font-black tracking-tight outline-none focus:border-purple-400 transition-colors"
                                                            placeholder="USER_ID"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2 pt-4">
                                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Core Voice Profile</label>
                                                    <select
                                                        value={config.settings?.voice?.model || 'none'}
                                                        onChange={(e) => {
                                                            const voice = config.settings?.voice || {};
                                                            updateField('settings', { ...config.settings, voice: { ...voice, model: e.target.value } });
                                                        }}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 font-bold outline-none focus:border-indigo-400 transition-all appearance-none"
                                                    >
                                                        <option value="none" className="bg-slate-950 text-white">Neural Mute (No Voice)</option>
                                                        <option value="alloy" className="bg-slate-950 text-white">OpenAI - Alloy</option>
                                                        <option value="echo" className="bg-slate-950 text-white">OpenAI - Echo</option>
                                                        <option value="fable" className="bg-slate-950 text-white">OpenAI - Fable</option>
                                                        <option value="onyx" className="bg-slate-950 text-white">OpenAI - Onyx</option>
                                                        <option value="nova" className="bg-slate-950 text-white">OpenAI - Nova</option>
                                                        <option value="shimmer" className="bg-slate-950 text-white">OpenAI - Shimmer</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Holographic Watermark */}
                                            <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none rotate-12">
                                                <Bot size={200} />
                                            </div>
                                        </div>
                                    </div>

                                    <section className="space-y-6">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Sparkles size={16} className="text-primary" />
                                            </div>
                                            <h3 className="font-black uppercase tracking-widest text-xs">Intelligence Core</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-8">
                                            <div className="group">
                                                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-primary">Model Architecture</label>
                                                <select
                                                    value={config.modelProvider || 'openai'}
                                                    onChange={(e) => updateField('modelProvider', e.target.value)}
                                                    className="w-full rounded-[1.25rem] border border-white/10 bg-white/5 px-5 py-4 focus:border-primary/50 outline-none transition-all font-bold group-hover:bg-white/[0.08] appearance-none"
                                                >
                                                    <option value="openai" className="bg-slate-950 text-white">OpenAI (GPT-4o Omniscience)</option>
                                                    <option value="anthropic" className="bg-slate-950 text-white">Anthropic (Claude 3.5 Sonnet)</option>
                                                    <option value="google" className="bg-slate-950 text-white">Google (Gemini 1.5 Ultra)</option>
                                                    <option value="llama_local" className="bg-slate-950 text-white">Edge Compute (Llama 3 70B)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                        {renderArraySection('Bio Summary', 'bio', <User size={16} className="text-primary" />, 'Defining trait...', 'primary')}
                                        {renderArraySection('Knowledge Base', 'knowledge', <Database size={16} className="text-indigo-400" />, 'Information segment...', 'indigo-500')}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'behavior' && (
                                <div className="space-y-12">
                                    <section className="space-y-6">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                                <Sparkles size={16} className="text-amber-400" />
                                            </div>
                                            <h3 className="font-black uppercase tracking-widest text-xs">Directive Mindset</h3>
                                        </div>
                                        <div className="group">
                                            <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-amber-400">System Command</label>
                                            <textarea
                                                value={config.system || ''}
                                                onChange={(e) => updateField('system', e.target.value)}
                                                className="w-full rounded-[2rem] border border-white/10 bg-white/5 px-8 py-6 focus:border-amber-400/50 outline-none transition-all font-medium min-h-[160px] group-hover:bg-white/[0.08] leading-relaxed"
                                                placeholder="Define the primary directive and behavioral boundaries for this instance..."
                                            />
                                        </div>
                                    </section>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                        {renderArraySection('Adjectives', 'adjectives', <Sparkles size={16} className="text-amber-400" />, 'Personality trait...', 'amber-400')}
                                        {renderArraySection('Topics', 'topics', <Globe size={16} className="text-green-400" />, 'Subject matter...', 'green-400')}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'style' && (
                                <div className="space-y-12">
                                    {renderArraySection('Global Style', 'style.all', <Settings size={16} className="text-slate-400" />, 'Universal writing rule...', 'slate-400')}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                        {renderArraySection('Chat Stylings', 'style.chat', <MessageSquare size={16} className="text-blue-400" />, 'Conversational rule...', 'blue-400')}
                                        {renderArraySection('Post Stylings', 'style.post', <Layout size={16} className="text-pink-400" />, 'Long-form rule...', 'pink-400')}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'plugins' && (
                                <div className="space-y-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="size-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                            <Zap size={16} className="text-pink-400" />
                                        </div>
                                        <h3 className="font-black uppercase tracking-widest text-xs">Skills</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {availablePlugins.map(plugin => (
                                            <div
                                                key={plugin.id}
                                                onClick={() => togglePlugin(plugin.id)}
                                                className={`p-6 rounded-3xl border transition-all cursor-pointer group flex items-start gap-4 ${config.plugins?.includes(plugin.id)
                                                    ? 'bg-primary/10 border-primary/30'
                                                    : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                                            >
                                                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${config.plugins?.includes(plugin.id) ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground'}`}>
                                                    <Zap size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-sm uppercase tracking-widest mb-1">{plugin.name}</h4>
                                                    <p className="text-xs text-muted-foreground font-medium leading-relaxed">{plugin.description}</p>
                                                </div>
                                                <div className={`size-6 rounded-full border flex items-center justify-center ml-auto ${config.plugins?.includes(plugin.id) ? 'bg-primary border-primary text-white' : 'border-white/10'}`}>
                                                    {config.plugins?.includes(plugin.id) && <Plus size={14} className="rotate-45" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {activeTab === 'secrets' && (
                                <div className="space-y-8 max-w-2xl mx-auto pb-10">
                                    <div className="flex flex-col items-center text-center gap-4 mb-10">
                                        <div className="size-20 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                            <Shield size={40} className="text-indigo-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight mb-2">Secret Vault</h3>
                                            <p className="text-muted-foreground font-medium">Manage API keys and sensitive credentials for this agent instance.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        {Object.entries(config.settings?.secrets || {}).map(([key, value]) => (
                                            <div key={key} className="group p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all flex flex-col gap-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{key}</span>
                                                    <button
                                                        onClick={() => {
                                                            const secrets = { ...config.settings?.secrets };
                                                            delete secrets[key];
                                                            updateField('settings', { ...config.settings, secrets });
                                                        }}
                                                        className="text-muted-foreground/40 hover:text-destructive transition-colors"
                                                    >
                                                        <Skull size={14} />
                                                    </button>
                                                </div>
                                                <input
                                                    type="password"
                                                    value={value as string}
                                                    onChange={(e) => {
                                                        const secrets = { ...config.settings?.secrets, [key]: e.target.value };
                                                        updateField('settings', { ...config.settings, secrets });
                                                    }}
                                                    className="bg-transparent border-b border-white/5 py-1 font-mono text-sm focus:border-indigo-400 outline-none transition-colors"
                                                />
                                            </div>
                                        ))}

                                        {isAddingSecret ? (
                                            <div className="p-8 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 animate-in fade-in zoom-in-95 duration-300">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400">New Secret Matrix</h4>
                                                    <button onClick={() => setIsAddingSecret(false)} className="text-muted-foreground/40 hover:text-white transition-colors">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Key</label>
                                                        <input
                                                            value={newSecretKey}
                                                            onChange={(e) => setNewSecretKey(e.target.value)}
                                                            placeholder="AGENT_KEY..."
                                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 font-bold text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-muted-foreground/20"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Value</label>
                                                        <input
                                                            value={newSecretValue}
                                                            onChange={(e) => setNewSecretValue(e.target.value)}
                                                            type="password"
                                                            placeholder="••••••••"
                                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 font-mono text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-muted-foreground/20"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (!newSecretKey.trim()) return;
                                                        const secrets = { ...config.settings?.secrets, [newSecretKey]: newSecretValue };
                                                        updateField('settings', { ...config.settings, secrets });
                                                        setNewSecretKey('');
                                                        setNewSecretValue('');
                                                        setIsAddingSecret(false);
                                                    }}
                                                    disabled={!newSecretKey.trim()}
                                                    className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                                                >
                                                    Secure Secret
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setIsAddingSecret(true)}
                                                className="w-full py-5 rounded-2xl border border-dashed border-white/10 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2 group"
                                            >
                                                <Plus size={16} className="text-muted-foreground group-hover:text-indigo-400" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-indigo-400">Add New Secret Entry</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'logs' && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                <Activity size={16} className="text-emerald-400" />
                                            </div>
                                            <h3 className="font-black uppercase tracking-widest text-xs">Runtime Telemetry</h3>
                                        </div>
                                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Live Link Active</span>
                                    </div>
                                    <div className="bg-black/60 rounded-[2.5rem] p-8 font-mono text-xs leading-relaxed border border-white/5 shadow-inner">
                                        {logs.map((log, i) => (
                                            <div key={i} className="flex gap-4 mb-2 group">
                                                <span className="text-muted-foreground/30 select-none">{i + 1}</span>
                                                <span className={log.includes('HEARBEAT_OK') ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                                                    {log}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="flex gap-4 animate-pulse">
                                            <span className="text-muted-foreground/30 select-none">{logs.length + 1}</span>
                                            <span className="text-primary font-black">_</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                            <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">CPU Load</span>
                                            <span className="text-xl font-black text-white">12.4%</span>
                                        </div>
                                        <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                            <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Memory Matrix</span>
                                            <span className="text-xl font-black text-white">240MB</span>
                                        </div>
                                        <div className="p-6 rounded-3xl bg-white/5 border border-white/5">
                                            <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Inference Latency</span>
                                            <span className="text-xl font-black text-white">45ms</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col animate-in fade-in duration-500">
                            <div className="flex-1 min-h-[420px] relative group">
                                <textarea
                                    id="eliza-matrix-json"
                                    value={localJson}
                                    onChange={(e) => handleJsonChange(e.target.value)}
                                    className={`w-full h-full min-h-[420px] font-mono text-[11px] p-2 rounded-[2.5rem] border bg-black/40 text-emerald-400 focus:outline-none custom-scrollbar transition-all ${jsonError ? 'border-destructive/50 ring-1 ring-destructive/20' : 'border-white/5 focus:border-primary/30'}`}
                                    spellCheck={false}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="">
                                    {jsonError && (
                                        <span className="rounded-full bg-destructive/10 text-destructive text-[10px] font-bold flex items-center gap-2 border border-destructive/20">
                                            <X size={12} /> {jsonError}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="p-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 bg-white/[0.02]">
                    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground/60">
                        <Activity size={14} className="text-primary" /> Changes are automatically synced with the reconciler loop.
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClose();
                            }}
                            className="flex-1 md:flex-none px-10 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-widest active:scale-95"
                        >
                            Discard
                        </button>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSave();
                            }}
                            disabled={saving || !!jsonError}
                            className="flex-1 md:flex-none px-10 py-4 rounded-2xl bg-white text-black hover:bg-white/90 active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Synchronize Core
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
