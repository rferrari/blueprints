'use client';

import React, { useState } from 'react';
import { Search, Filter, Download, Check, Loader2, Bot, Zap, Star, Shield, Sparkles, Cpu, Box, Layers, ChevronLeft } from 'lucide-react';

interface AgentTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    framework: 'elizaos' | 'openclaw';
    icon: string;
    config: any;
    stats?: {
        installs: string;
        rating: string;
    };
}

const templates: AgentTemplate[] = [
    // ElizaOS Agents
    {
        id: 'social-manager',
        name: 'Social Media Manager',
        description: 'Automates viral content creation, engagement, and cross-platform scheduling.',
        category: 'Marketing',
        framework: 'elizaos',
        icon: 'share',
        stats: { installs: '15k', rating: '4.9' },
        config: {
            bio: ["An expert social media strategist", "Focused on viral trends and audience engagement"],
            lore: ["Managed accounts for top global brands", "Knows every platform algorithm by heart"],
            modelProvider: "openai",
            plugins: ["@elizaos/plugin-bootstrap", "@elizaos/plugin-twitter", "@elizaos/plugin-discord"]
        }
    },
    {
        id: 'financial-analyst',
        name: 'Financial Analyst',
        description: 'Real-time market insights, portfolio tracking, and risk assessment.',
        category: 'Finance',
        framework: 'elizaos',
        icon: 'trending-up',
        stats: { installs: '9k', rating: '4.8' },
        config: {
            bio: ["A seasoned quant analyst", "Expert in DeFi and traditional markets"],
            lore: ["Predicted the 2021 bull run", "Deeply understands macro-economics"],
            modelProvider: "anthropic",
            plugins: ["@elizaos/plugin-bootstrap", "@elizaos/plugin-sql", "@elizaos/plugin-coingecko"]
        }
    },
    {
        id: 'customer-care',
        name: 'Omni Support Agent',
        description: '24/7 intelligent customer support with RAG capabilities.',
        category: 'Support',
        framework: 'elizaos',
        icon: 'life-buoy',
        stats: { installs: '12k', rating: '5.0' },
        config: {
            bio: ["The most helpful support agent", "Expert in troubleshooting and documentation"],
            lore: ["Has a database of every solution ever found", "Trained on millions of support tickets"],
            modelProvider: "google",
            plugins: ["@elizaos/plugin-bootstrap", "@elizaos/plugin-sql"]
        }
    },

    // OpenClaw Agents
    {
        id: 'neural-executive',
        name: 'Neural Executive',
        description: 'Autonomous personal assistant capable of long-horizon planning and task execution.',
        category: 'Personal Assistance',
        framework: 'openclaw',
        icon: 'user-check',
        stats: { installs: '2k', rating: '5.0' },
        config: {
            bio: ["Highly organized executive assistant", "Capable of complex reasoning and tool use"],
            lore: ["Optimized for efficiency", "Can manage calendars, emails, and complex workflows"],
            modelProvider: "anthropic",
            plugins: ["openclaw-core", "openclaw-planner"]
        }
    },
    {
        id: 'research-sentinel',
        name: 'Deep Research Unit',
        description: 'Advanced web crawler and data synthesizer for deep-dive investigations.',
        category: 'Personal Assistance',
        framework: 'openclaw',
        icon: 'search',
        stats: { installs: '5k', rating: '4.9' },
        config: {
            bio: ["A relentless researcher", "Synthesizes vast amounts of information"],
            lore: ["Can read and summarize entire documentation sites", "Expert in fact-checking"],
            modelProvider: "openai",
            plugins: ["openclaw-browser", "openclaw-memory"]
        }
    }
];

export default function Marketplace({ projectId }: { projectId: string }) {
    const session: any = null; // Removed useAuth as it was unused and causing errors. Placeholder for session if needed.
    const [search, setSearch] = useState('');
    const [frameworkFilter, setFrameworkFilter] = useState<'all' | 'elizaos' | 'openclaw'>('all');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [installing, setInstalling] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Multi-step Setup State
    const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1); // 1: Select, 2: Identity, 3: Confirm/Plugins
    const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
    const [agentName, setAgentName] = useState('');
    const [agentBio, setAgentBio] = useState('');

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    const startSetup = (template: AgentTemplate) => {
        setSelectedTemplate(template);
        setAgentName(template.name);
        setAgentBio(template.config.bio[0] || '');
        setSetupStep(2);
    };

    const handleInstall = async () => {
        if (!session?.access_token || !selectedTemplate) {
            setMessage({ type: 'error', text: 'Incomplete setup.' });
            return;
        }

        const targetProjectId = projectId === 'default' ? null : projectId;
        if (!targetProjectId) {
            setMessage({ type: 'error', text: 'Please select a project first.' });
            return;
        }

        try {
            setInstalling(selectedTemplate.id);
            setMessage(null);

            const finalConfig = {
                ...selectedTemplate.config,
                name: agentName,
                bio: [agentBio, ...(selectedTemplate.config.bio.slice(1))]
            };

            const res = await fetch(`${API_URL}/agents/project/${targetProjectId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    name: agentName,
                    templateId: selectedTemplate.id,
                    configTemplate: finalConfig,
                    framework: selectedTemplate.framework
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to deploy agent');
            }

            setMessage({ type: 'success', text: `${agentName} successfully deployed to your cluster!` });
            setSetupStep(1);
            setSelectedTemplate(null);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setInstalling(null);
        }
    };

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.category.toLowerCase().includes(search.toLowerCase());
        const matchesFramework = frameworkFilter === 'all' || t.framework === frameworkFilter;
        const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
        return matchesSearch && matchesFramework && matchesCategory;
    });

    // Helper to get all categories based on current filtered set (or all)
    // Actually simplicity: Just static list + dynamic?
    // Let's stick to a curated list for the filter bar
    const categories = ['All', 'Marketing', 'Finance', 'Support', 'Personal Assistance'];

    if (selectedTemplate && setupStep >= 2) {
        return (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <button
                    onClick={() => { setSetupStep(1); setSelectedTemplate(null); }}
                    className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors font-bold text-sm uppercase tracking-widest"
                >
                    <ChevronLeft size={16} /> Back to Blueprints
                </button>

                <div className="glass-card rounded-[3.5rem] p-10 md:p-16 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5">
                        <Sparkles size={120} />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="size-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-black">
                                {setupStep}
                            </div>
                            <div>
                                <h2 className="text-3xl font-black tracking-tight">Configure Your {selectedTemplate.name}</h2>
                                <p className="text-muted-foreground font-medium">Step {setupStep} of 2: Define your agent's soul</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="group">
                                <label className="block text-sm font-bold text-muted-foreground mb-3 ml-1 uppercase tracking-widest transition-colors group-focus-within:text-primary">
                                    Agent Callsign
                                </label>
                                <input
                                    type="text"
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                    placeholder="Enter a unique name..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-bold text-xl placeholder:text-muted-foreground/20"
                                />
                            </div>

                            <div className="group">
                                <label className="block text-sm font-bold text-muted-foreground mb-3 ml-1 uppercase tracking-widest transition-colors group-focus-within:text-primary">
                                    Primary Bio Segment
                                </label>
                                <textarea
                                    value={agentBio}
                                    onChange={(e) => setAgentBio(e.target.value)}
                                    rows={4}
                                    placeholder="Briefly describe your agent's purpose..."
                                    className="w-full bg-white/5 border border-white/10 rounded-3xl py-5 px-6 outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-medium leading-relaxed placeholder:text-muted-foreground/20"
                                />
                            </div>

                            <div className="p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10">
                                <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest mb-4">
                                    <Shield size={16} className="text-indigo-400" /> {selectedTemplate.framework === 'elizaos' ? 'Pre-installed Skills' : 'Core Capabilities'}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {selectedTemplate.config.plugins.map((p: string) => (
                                        <span key={p} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold text-muted-foreground">
                                            {p.replace('@elizaos/plugin-', '')}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleInstall}
                                disabled={installing !== null || !agentName}
                                className="w-full relative group overflow-hidden rounded-3xl bg-primary py-5 font-black text-white text-sm uppercase tracking-[0.2em] transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                <div className="absolute inset-0 bg-gradient-unicorn opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <span className="relative flex items-center justify-center gap-3">
                                    {installing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                                    {installing ? 'Syncing Neural Blueprint...' : 'Deploy to Cluster'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            {/* Marketplace Hero */}
            <div className="relative p-10 rounded-[3rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-white/5 overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Sparkles size={160} />
                </div>
                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">Feature Preview</span>
                    </div>
                    <h2 className="text-4xl font-black tracking-tight mb-4">Functional <span className="text-transparent bg-clip-text bg-gradient-unicorn">Blueprints</span></h2>
                    <p className="text-muted-foreground font-medium text-lg mb-8">Blueprints will allow you to deploy a specialized blueprint to jumpstart your agent's deployment.</p>
                </div>
            </div>

            {/* Framework Toggle */}
            <div className="flex justify-center flex-col md:flex-row gap-4">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search blueprints..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-primary/50 focus:bg-white/[0.08] transition-all font-medium text-sm"
                    />
                </div>

                <div className="p-1 rounded-2xl bg-white/5 border border-white/5 flex gap-1">
                    {[
                        { id: 'all', label: 'All Frameworks' },
                        { id: 'elizaos', label: 'ElizaOS' },
                        { id: 'openclaw', label: 'OpenClaw' }
                    ].map(fw => (
                        <button
                            key={fw.id}
                            onClick={() => setFrameworkFilter(fw.id as any)}
                            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${frameworkFilter === fw.id
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-muted-foreground hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {fw.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                <div className="flex flex-wrap justify-center gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${categoryFilter === cat ? 'bg-white text-black' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {message && (
                <div className={`p-5 rounded-3xl animate-in slide-in-from-top-4 duration-500 border flex items-center gap-4 ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-destructive/10 border-destructive/20 text-destructive'
                    }`}>
                    {message.type === 'success' ? <Check size={24} /> : <Shield size={24} />}
                    <p className="font-bold text-sm">{message.text}</p>
                    <button onClick={() => setMessage(null)} className="ml-auto opacity-50 hover:opacity-100 transition-opacity font-bold">DISMISS</button>
                </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredTemplates.map(template => (
                    <div key={template.id} className="glass-card rounded-[2.5rem] p-8 flex flex-col group active:scale-[0.99] transition-all duration-300">
                        <div className="flex justify-between items-start mb-8">
                            <div className={`size-16 rounded-[1.5rem] p-0.5 shadow-xl transition-transform group-hover:scale-110 duration-500 ${template.framework === 'elizaos' ? 'bg-gradient-unicorn shadow-primary/10' : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20'
                                }`}>
                                <div className="w-full h-full bg-background rounded-[calc(1.5rem-2px)] flex items-center justify-center text-white">
                                    {template.framework === 'elizaos' ? <Bot size={32} /> : <Cpu size={32} />}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{template.category}</span>
                                <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${template.framework === 'elizaos' ? 'text-amber-400' : 'text-blue-400'
                                    }`}>
                                    {template.framework === 'elizaos' ? <Box size={10} /> : <Layers size={10} />}
                                    {template.framework === 'elizaos' ? 'ElizaOS' : 'OpenClaw'}
                                </span>
                            </div>
                        </div>

                        <h4 className="text-2xl font-black tracking-tight mb-2 group-hover:text-primary transition-colors">{template.name}</h4>
                        <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-10 flex-1">{template.description}</p>

                        <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-auto">
                            {template.framework === 'elizaos' ? (
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Plugins</span>
                                    <span className="text-lg font-black text-white tracking-tight">{template.config.plugins.length}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Core</span>
                                    <span className="text-lg font-black text-white tracking-tight">V2</span>
                                </div>
                            )}
                            <button
                                onClick={() => startSetup(template)}
                                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all relative overflow-hidden group/btn bg-primary text-white shadow-lg shadow-primary/30 active:scale-95`}
                            >
                                <div className="absolute inset-0 bg-gradient-unicorn opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                <span className="relative flex items-center gap-2">
                                    <Zap size={16} />
                                    Customize
                                </span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
