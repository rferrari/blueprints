'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Save, X, Plus, Skull, Play, Square, User, AlertCircle, Loader2, ShieldCheck, Zap, Activity, Cpu, Database, MessageSquare, Terminal } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import AgentEditor from '@/components/agent-editor';
import OpenClawWizard from '@/components/openclaw-wizard';
import ChatInterface from '@/components/chat-interface';
import ConfirmationModal from '@/components/confirmation-modal';

interface Project {
    id: string;
    name: string;
    tier: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const COOL_NAMES = [
    'Neon Ghost', 'Cypher Stalker', 'Glitch Weaver', 'Midnight Oracle',
    'Quantum Spark', 'Aether Pulse', 'Void Runner', 'Binary Spirit',
    'Silicon Reaper', 'Echo Prime', 'Nexus Core', 'Zenith Auditor',
    'Solar Flare', 'Lunar Shadow', 'Onyx Sentinel', 'Cobalt Phantom'
];

export default function ProjectView({ projectId, onDataChange }: { projectId: string; onDataChange?: () => void }) {
    const { session } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [agents, setAgents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newAgentName, setNewAgentName] = useState('');
    const [newAgentFramework, setNewAgentFramework] = useState<'eliza' | 'openclaw'>('eliza');
    const [editingAgent, setEditingAgent] = useState<any | null>(null);
    const [chattingAgentId, setChattingAgentId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastCreatedAgentId, setLastCreatedAgentId] = useState<string | null>(null);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);

    const [purgeModal, setPurgeModal] = useState<{ isOpen: boolean; agentId: string | null }>({
        isOpen: false,
        agentId: null
    });

    const fetchProjectAndAgents = useCallback(async (isInitial = false) => {
        if (!session?.access_token) return;
        try {
            if (isInitial) setLoading(true);
            const pRes = await fetch(`${API_URL}/projects/${projectId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                cache: 'no-store'
            });
            if (pRes.ok) setProject(await pRes.json());
            else {
                const pErr = await pRes.json().catch(() => ({}));
                throw new Error(pErr.message || 'Failed to fetch project details');
            }

            const res = await fetch(`${API_URL}/agents/project/${projectId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                cache: 'no-store'
            });
            if (!res.ok) {
                const aErr = await res.json().catch(() => ({}));
                throw new Error(aErr.message || 'Failed to fetch agents');
            }
            const data = await res.json();
            setAgents(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [projectId, session]);

    useEffect(() => {
        fetchProjectAndAgents(true);
        // Standard refresh - don't show spinner on background cycles
        const interval = setInterval(() => fetchProjectAndAgents(false), 20000);
        return () => clearInterval(interval);
    }, [fetchProjectAndAgents]);

    // Auto-open wizard/editor for new agents
    useEffect(() => {
        if (lastCreatedAgentId && agents.length > 0) {
            const newAgent = agents.find((a: any) => a.id === lastCreatedAgentId);
            if (newAgent) {
                setEditingAgent(newAgent);
                setLastCreatedAgentId(null);
            }
        }
    }, [lastCreatedAgentId, agents]);

    // Fast refresh for countdowns
    const [, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const handleInstallAgent = async () => {
        if (!newAgentName || !session?.access_token) return;
        try {
            const res = await fetch(`${API_URL}/agents/project/${projectId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    name: newAgentName,
                    framework: newAgentFramework
                })
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Failed to install agent');
            }
            const data = await res.json();
            setLastCreatedAgentId(data.id);
            await fetchProjectAndAgents();
            setIsAdding(false);
            setNewAgentName('');
            setError(null);
            onDataChange?.();
        } catch (err: any) {
            setError(err.message);
        }
    };
    const toggleAgent = async (agentId: string, enabled: boolean) => {
        if (!session?.access_token) return;
        try {
            // Optimistic UI update
            setAgents(prev => prev.map(a => a.id === agentId ? {
                ...a,
                agent_actual_state: {
                    ...((Array.isArray(a.agent_actual_state) ? a.agent_actual_state[0] : a.agent_actual_state) || {}),
                    status: enabled ? 'starting' : 'stopping'
                }
            } : a));

            const res = await fetch(`${API_URL}/agents/${agentId}/config`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ enabled })
            });
            if (!res.ok) throw new Error('Failed to update agent state');
            await fetchProjectAndAgents();
            setError(null);
            onDataChange?.();
        } catch (err: any) {
            setError(err.message);
            // Revert optimistic update on error
            await fetchProjectAndAgents();
        }
    };


    const handlePurge = async (agentId: string, currentStatus: string) => {
        if (!session?.access_token) return;
        try {
            // Smart Purge: 
            // If running: now + 24h + 10s (Quick stop)
            // If stopped: now + 24h (Direct decommissioning)
            const stopBuffer = currentStatus === 'running' || currentStatus === 'starting' ? 10 * 1000 : 0;
            const purgeAt = new Date(Date.now() + (24 * 60 * 60 * 1000) + stopBuffer).toISOString();

            const res = await fetch(`${API_URL}/agents/${agentId}/config`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ purge_at: purgeAt })
            });
            if (!res.ok) throw new Error('Failed to initiate purge protocol');
            await fetchProjectAndAgents();
            setError(null);
            onDataChange?.();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleForcePurge = async (agentId: string) => {
        if (!session?.access_token) return;
        try {
            // Execute Immediately: set purge_at to now
            const now = new Date().toISOString();
            const res = await fetch(`${API_URL}/agents/${agentId}/config`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ purge_at: now })
            });
            if (!res.ok) throw new Error('Failed to execute force purge');
            await fetchProjectAndAgents();
            setError(null);
            onDataChange?.();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleSkipStop = async (agentId: string) => {
        if (!session?.access_token) return;
        try {
            // Skip stop buffer: set purge_at to now + 24h
            const purgeAt = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();
            const res = await fetch(`${API_URL}/agents/${agentId}/config`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ purge_at: purgeAt })
            });
            if (!res.ok) throw new Error('Failed to skip stop timer');
            await fetchProjectAndAgents();
            setError(null);
            onDataChange?.();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleAbortPurge = async (agentId: string) => {
        if (!session?.access_token) return;
        try {
            const res = await fetch(`${API_URL}/agents/${agentId}/config`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ purge_at: null })
            });
            if (!res.ok) throw new Error('Failed to abort purge');
            await fetchProjectAndAgents();
            setError(null);
            onDataChange?.();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const saveAgentConfig = async (config: any) => {
        if (!editingAgent || !session?.access_token) return;
        try {
            const res = await fetch(`${API_URL}/agents/${editingAgent.id}/config`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ config })
            });
            if (!res.ok) throw new Error('Failed to save config');
            await fetchProjectAndAgents();
        } catch (err: any) {
            throw err;
        }
    };

    if (loading && agents.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>
        );
    }

    const limits: Record<string, number> = { 'free': 2, 'pro': 10, 'enterprise': 1000 };
    const tierLimit = project ? limits[project.tier] || 2 : 2;
    const isAtLimit = agents.length >= tierLimit;

    return (
        <div className="space-y-12 pb-20">
            {editingAgent && (
                editingAgent.framework === 'openclaw' ? (
                    <OpenClawWizard
                        agent={editingAgent}
                        onSave={saveAgentConfig}
                        onClose={() => setEditingAgent(null)}
                    />
                ) : (
                    <AgentEditor
                        agent={editingAgent}
                        // Use robust fetching for actual state
                        actual={(Array.isArray(editingAgent.agent_actual_state) ? editingAgent.agent_actual_state[0] : editingAgent.agent_actual_state) || { status: 'stopped' }}
                        onSave={saveAgentConfig}
                        onClose={() => setEditingAgent(null)}
                    />
                )
            )}

            {chattingAgentId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setChattingAgentId(null)} />
                    <div className="relative w-full max-w-5xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                        <ChatInterface
                            agentId={chattingAgentId}
                            onClose={() => setChattingAgentId(null)}
                        />
                    </div>
                </div>
            )}

            {/* Hub Header */}
            <div className="p-8 md:p-12 rounded-[3.5rem] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-white/5 relative overflow-hidden group">
                <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none rotate-12">
                    <Bot size={240} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-8">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className={`px-4 py-1.5 rounded-full border border-current font-black text-[10px] uppercase tracking-[0.2em] shadow-lg ${(project?.tier || 'free') === 'free' ? 'text-muted-foreground/60' : 'text-primary shadow-primary/20 bg-primary/10'
                                }`}>
                                {project?.tier || 'FREE'} ARCHITECTURE
                            </span>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-black uppercase tracking-widest">
                                <Activity size={12} className="text-green-500" /> System Healthy
                            </div>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">{project?.name || 'Cluster Manager'}</h2>
                        <div className="flex flex-wrap gap-6 mt-6">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                                <Bot size={18} className="text-primary" />
                                <span className="text-xs font-bold uppercase tracking-widest text-white">{agents.length} / {tierLimit} Agents</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                                <Cpu size={18} className="text-amber-500" />
                                <span className="text-xs font-bold uppercase tracking-widest text-white">4.2 GHz Compute</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                                <Database size={18} className="text-indigo-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-white">Sync Latency: 4ms</span>
                            </div>
                        </div>
                    </div>
                    {!isAdding && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isAtLimit) {
                                    const randomName = COOL_NAMES[Math.floor(Math.random() * COOL_NAMES.length)];
                                    setNewAgentName(randomName);
                                    setIsAdding(true);
                                } else {
                                    setIsLimitModalOpen(true);
                                }
                            }}
                            className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all shadow-2xl relative overflow-hidden group/btn ${isAtLimit ? 'bg-muted/50 text-muted-foreground border border-white/5 opacity-50' : 'bg-white text-black hover:bg-white active:scale-95'
                                }`}
                        >
                            <Plus size={18} />
                            Deploy Agent
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="p-6 rounded-[2rem] bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                    <AlertCircle size={24} />
                    <span className="font-bold text-sm tracking-tight">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto p-2 hover:bg-destructive/10 rounded-full transition-colors"><X size={18} /></button>
                </div>
            )}


            {isAdding && (
                <div className="p-10 rounded-[2.5rem] border border-primary/30 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-500 backdrop-blur-md">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                            <Plus size={20} className="text-white" />
                        </div>
                        <h3 className="text-2xl font-black tracking-tight">Install New Intelligence</h3>
                    </div>
                    <div className="max-w-xl space-y-6">
                        <div className="group">
                            <label className="block text-sm font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-primary">Agent Identity</label>
                            <input
                                type="text"
                                value={newAgentName}
                                onChange={(e) => setNewAgentName(e.target.value)}
                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 focus:border-primary/50 outline-none transition-all font-bold placeholder:text-muted-foreground/30"
                            />
                        </div>
                        <div className="group">
                            <label className="block text-sm font-black text-muted-foreground uppercase tracking-widest mb-2 ml-1 transition-colors group-focus-within:text-primary">Intelligence Framework</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setNewAgentFramework('eliza')}
                                    className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${newAgentFramework === 'eliza'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'}`}
                                >
                                    <Bot size={24} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">ElizaOS</span>
                                </button>
                                <button
                                    onClick={() => setNewAgentFramework('openclaw')}
                                    className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${newAgentFramework === 'openclaw'
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'}`}
                                >
                                    <Terminal size={24} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">OpenClaw</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsAdding(false);
                                }}
                                className="flex-1 py-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleInstallAgent}
                                className="flex-[2] py-4 rounded-2xl bg-primary text-white hover:opacity-90 active:scale-[0.98] transition-all font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20"
                            >
                                Create Agent Instance
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Agents Grid */}
            <div className="grid grid-cols-1 gap-6">
                {agents.length === 0 && !isAdding && (
                    <div className="flex flex-col items-center justify-center p-20 border border-dashed border-white/10 rounded-[3rem]">
                        <Bot size={64} className="text-muted-foreground mb-6 opacity-10" />
                        <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No active intelligence detected.</p>
                    </div>
                )}

                {agents.map((agent: any) => {
                    // Robust state extraction (handle both array and object from Supabase joins)
                    const getOne = (val: any) => (Array.isArray(val) ? val[0] : val);
                    const desired = getOne(agent.agent_desired_state) || { enabled: false, purge_at: null };
                    const actual = getOne(agent.agent_actual_state) || { status: 'stopped' };

                    // Countdown Logic
                    const now = new Date();
                    const purgeDate = desired.purge_at ? new Date(desired.purge_at) : null;
                    const stopDate = purgeDate ? new Date(purgeDate.getTime() - (24 * 60 * 60 * 1000)) : null;

                    let purgeStatus = null;
                    if (purgeDate && !isNaN(purgeDate.getTime())) {
                        if (now < stopDate!) {
                            const diff = stopDate!.getTime() - now.getTime();
                            const mins = Math.floor(diff / 60000);
                            const secs = Math.floor((diff % 60000) / 1000);
                            purgeStatus = { label: 'STOPPING IN', time: `${mins}:${secs.toString().padStart(2, '0')}`, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
                        } else if (now < purgeDate) {
                            const diff = purgeDate.getTime() - now.getTime();
                            const hours = Math.floor(diff / 3600000);
                            const mins = Math.floor((diff % 3600000) / 60000);
                            const secs = Math.floor((diff % 60000) / 1000);
                            purgeStatus = { label: 'TERMINATING IN', time: `${hours}h ${mins}m`, color: 'text-destructive bg-destructive/10 border-destructive/20 animate-pulse font-black shadow-[0_0_15px_rgba(239,68,68,0.2)]' };
                        }
                    }

                    return (
                        <div key={agent.id} className={`glass-card rounded-[2.5rem] p-6 pr-10 hover:bg-white/[0.04] transition-all duration-500 group relative overflow-hidden ${desired.purge_at ? 'border-amber-500/30 bg-amber-500/5 shadow-[0_0_50px_rgba(245,158,11,0.1)]' : ''}`}>
                            {desired.purge_at && (
                                <div className="absolute top-0 right-0 px-8 py-2 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest origin-bottom-right rotate-45 translate-x-[20%] translate-y-[50%] shadow-xl">
                                    TERMINATION SEQ
                                </div>
                            )}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-6 flex-1">
                                    <div className={`size-20 rounded-[1.75rem] flex items-center justify-center transition-all duration-700 shadow-2xl ${actual.status === 'running'
                                        ? 'bg-green-500/10 text-green-500 shadow-green-500/10 scale-110'
                                        : 'bg-white/5 text-muted-foreground/40'
                                        }`}>
                                        <Bot size={36} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="font-black text-2xl tracking-tighter group-hover:text-primary transition-colors">{agent.name}</h4>
                                            <span className={`size-2 rounded-full ${actual.status === 'running' ? 'bg-green-500 animate-glow brightness-150' :
                                                actual.status === 'error' ? 'bg-destructive shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-muted-foreground/30'
                                                }`} />
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                                            <span className={actual.status === 'running' ? 'text-green-500' : 'text-muted-foreground'}>{actual.status}</span>
                                            <span className="text-white/20">•</span>
                                            <span className="text-muted-foreground/50">Framework: {agent.framework || 'eliza'}</span>
                                            <span className="text-white/20">•</span>
                                            {purgeStatus ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (purgeStatus.label === 'STOPPING IN') {
                                                            handleSkipStop(agent.id);
                                                        } else {
                                                            setPurgeModal({ isOpen: true, agentId: agent.id });
                                                        }
                                                    }}
                                                    className={`${purgeStatus.color} flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-mono tracking-tighter hover:bg-destructive hover:text-white hover:border-destructive transition-all duration-300 group/purge-btn cursor-pointer active:scale-95`}
                                                    title={purgeStatus.label === 'STOPPING IN' ? "Skip Timer: STOP IMMEDIATELY" : "Skip Timer: EXECUTE TERMINATION NOW"}
                                                >
                                                    <Activity size={10} className="animate-spin group-hover/purge-btn:hidden" />
                                                    <Skull size={10} className="hidden group-hover/purge-btn:block animate-pulse" />
                                                    <span className="group-hover/purge-btn:hidden">{purgeStatus.label} {purgeStatus.time}</span>
                                                    <span className="hidden group-hover/purge-btn:inline font-black">
                                                        {purgeStatus.label === 'STOPPING IN' ? 'STOP NOW' : 'TERMINATE NOW'}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span className="text-muted-foreground/50">Runtime: v1.0.4</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-2 bg-white/5 rounded-[1.5rem] border border-white/5">
                                    <button
                                        disabled={actual.status === 'starting' || actual.status === 'stopping'}
                                        className={`size-14 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-lg ${desired.enabled
                                            ? 'bg-destructive/10 text-destructive hover:bg-destructive shadow-destructive/20 hover:text-white'
                                            : 'bg-green-500/10 text-green-500 hover:bg-green-500 shadow-green-500/10 hover:text-white'
                                            }`}
                                        title={desired.enabled ? 'Stop Skills' : 'Start Skills'}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleAgent(agent.id, !desired.enabled);
                                        }}
                                    >
                                        {actual.status === 'starting' || actual.status === 'stopping' ? <Loader2 size={24} className="animate-spin" /> :
                                            (desired.enabled ? <Square size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />)}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setEditingAgent(agent);
                                        }}
                                        className="size-14 rounded-2xl text-muted-foreground flex items-center justify-center hover:bg-white/10 hover:text-white transition-all active:scale-95"
                                        title="Configure Agent"
                                    >
                                        <User size={22} />
                                    </button>
                                    <button
                                        disabled={actual.status !== 'running'}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setChattingAgentId(agent.id);
                                        }}
                                        className={`size-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${actual.status === 'running'
                                            ? 'text-primary hover:bg-primary/10'
                                            : 'text-muted-foreground/30 cursor-not-allowed'
                                            }`}
                                        title="Live Neural Link"
                                    >
                                        <MessageSquare size={22} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (desired.purge_at) handleAbortPurge(agent.id);
                                            else handlePurge(agent.id, actual.status);
                                        }}
                                        className={`size-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${desired.purge_at
                                            ? 'bg-amber-500 text-white animate-pulse shadow-lg shadow-amber-500/20'
                                            : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'}`}
                                        title={desired.purge_at ? 'ABORT TERMINATION' : 'Terminate Agent'}
                                    >
                                        <Skull size={22} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <ConfirmationModal
                isOpen={purgeModal.isOpen}
                onClose={() => setPurgeModal({ isOpen: false, agentId: null })}
                onConfirm={() => {
                    if (purgeModal.agentId) {
                        handleForcePurge(purgeModal.agentId);
                        setPurgeModal({ isOpen: false, agentId: null });
                    }
                }}
                title="Execute Final Termination?"
                message="This action will bypass the 24-hour safety window and permanently destroy this agent. This cannot be undone."
                confirmText="Terminate Now"
                type="danger"
            />

            {isAtLimit && !isAdding && (
                <div className="p-8 rounded-[2.5rem] glass-card flex items-center gap-6 group relative overflow-hidden mt-12 bg-primary/5 border-primary/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                        <Zap size={60} className="text-primary" />
                    </div>
                    <div className="size-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
                        <ShieldCheck size={30} />
                    </div>
                    <div className="flex-1">
                        <p className="text-xl font-bold tracking-tight mb-1 text-primary">Agent limit reached for FREE tier</p>
                        <p className="text-sm font-medium text-muted-foreground">Upgrade to the **PRO** cluster to scale up to 10 autonomous agents.</p>
                    </div>
                    <button className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-primary/20">Upgrade Now</button>
                </div>
            )}

            <ConfirmationModal
                isOpen={isLimitModalOpen}
                onClose={() => setIsLimitModalOpen(false)}
                onConfirm={() => {
                    setIsLimitModalOpen(false);
                    // Proactive: trigger upgrade modal or just close? 
                    // User said "display the message as alert modal as the Execute Final Termination?"
                }}
                title="Agent Limit Reached"
                message="You have reached the maximum number of agents for the FREE tier (2 agents). Please upgrade to PRO to deploy more intelligence."
                confirmText="Understood"
                type="warning"
            />
        </div>
    );
}
