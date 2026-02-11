'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Save, X, Plus, Skull, Play, Square, User, AlertCircle, Loader2, ShieldCheck, Zap, Activity, Cpu, Database, MessageSquare, Terminal } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { createClient } from '@/lib/supabase';
import ElizaWizard from '@/components/eliza-wizard';
import OpenClawWizard from '@/components/openclaw-wizard';
import ChatInterface from '@/components/chat-interface';
import ConfirmationModal from '@/components/confirmation-modal';

interface Project {
    id: string;
    name: string;
    tier: string;
}

interface LocalAgentState {
    pendingAction?: string; // 'starting' | 'stopping'
    commandId?: string;
    error?: string;
    terminateRequestedAt?: number;
    pendingEnabled?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const COOL_NAMES = [
    'Neon Ghost', 'Cypher Stalker', 'Glitch Weaver', 'Midnight Oracle',
    'Quantum Spark', 'Aether Pulse', 'Void Runner', 'Binary Spirit',
    'Silicon Reaper', 'Echo Prime', 'Nexus Core', 'Zenith Auditor',
    'Solar Flare', 'Lunar Shadow', 'Onyx Sentinel', 'Cobalt Phantom'
];

const generateCoolName = () => {
    // Split all names into individual words
    const words = COOL_NAMES.flatMap(name => name.split(' '));
    // Remove duplicates just in case
    const uniqueWords = [...new Set(words)];

    // Pick 2 random words
    const r1 = Math.floor(Math.random() * uniqueWords.length);
    let r2 = Math.floor(Math.random() * uniqueWords.length);

    // Ensure we don't pick the same word twice
    while (r2 === r1) {
        r2 = Math.floor(Math.random() * uniqueWords.length);
    }

    return `${uniqueWords[r1]} ${uniqueWords[r2]}`;
};

export default function ProjectView({ projectId, onDataChange, onUpgrade }: { projectId: string; onDataChange?: () => void; onUpgrade?: () => void }) {
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
    const [loadingAgents, setLoadingAgents] = useState<Set<string>>(new Set());
    const [purgingAgents, setPurgingAgents] = useState<Set<string>>(new Set());
    const [isInstalling, setIsInstalling] = useState(false);

    // robust local state for agent feedback
    const [localState, setLocalState] = useState<Record<string, LocalAgentState>>({});

    const updateLocalState = (agentId: string, update: Partial<LocalAgentState>) => {
        setLocalState(prev => ({
            ...prev,
            [agentId]: { ...prev[agentId], ...update }
        }));
    };

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
            // Filter out agents that are currently being purged to prevent flickering
            // Also filter out agents with a purge_at in the past
            const filtered = data.filter((a: any) => {
                if (purgingAgents.has(a.id)) return false;
                const desired = Array.isArray(a.agent_desired_state) ? a.agent_desired_state[0] : a.agent_desired_state;
                if (desired?.purge_at) {
                    const purgeDate = new Date(desired.purge_at);
                    if (purgeDate <= new Date()) return false;
                }
                return true;
            });
            setAgents(filtered);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [projectId, session, purgingAgents]);

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

    // Real-time Status Sync
    useEffect(() => {
        const sb = createClient();

        const channel = sb
            .channel('agent-status-updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'agent_actual_state',
            }, (payload: any) => {
                if (!payload.new || !payload.new.agent_id) return;

                setAgents((prev) => prev.map(a => {
                    if (a.id === payload.new.agent_id) {
                        // robustly update actual state
                        const currentActual = Array.isArray(a.agent_actual_state) ? a.agent_actual_state[0] : a.agent_actual_state;

                        // If we have a local pending action that matches the new status, clear it
                        const local = localState[a.id];
                        if (local?.pendingAction === payload.new.status) {
                            updateLocalState(a.id, { pendingAction: undefined, commandId: undefined });
                        }

                        return {
                            ...a,
                            agent_actual_state: { ...currentActual, ...payload.new }
                        };
                    }
                    return a;
                }));
            })
            .subscribe();

        return () => {
            sb.removeChannel(channel);
        };
    }, [localState, updateLocalState]);

    const handleInstallAgent = async () => {
        if (!newAgentName || !session?.access_token || isInstalling) return;
        setIsInstalling(true);
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
        } finally {
            setIsInstalling(false);
        }
    };
    const toggleAgent = async (agentId: string, enabled: boolean) => {
        if (!session?.access_token) return;

        const commandId = crypto.randomUUID();
        const action = enabled ? 'starting' : 'stopping';

        // 1. Optimistic Update
        updateLocalState(agentId, {
            pendingAction: action,
            commandId,
            error: undefined // Clear previous errors
        });

        try {
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

            // 2. Success: Clear pending action ONLY if commandId matches
            setLocalState(prev => {
                if (prev[agentId]?.commandId === commandId) {
                    const { pendingAction, commandId: _, ...rest } = prev[agentId];
                    return { ...prev, [agentId]: rest };
                }
                return prev;
            });

            onDataChange?.();
        } catch (err: any) {
            // 3. Error: Clear pending action and set Error
            setLocalState(prev => {
                if (prev[agentId]?.commandId === commandId) {
                    return {
                        ...prev,
                        [agentId]: {
                            ...prev[agentId],
                            pendingAction: undefined,
                            error: enabled ? 'Start Failed' : 'Stop Failed'
                        }
                    };
                }
                return prev;
            });
            // We do NOT call fetchProjectAndAgents here to avoid overwriting the error state with a stale "running" state immediately
            // But usually, we might want to ensure consistency. Given the requirement "revert status", clearing pendingAction does that (reverts to actual)
        }
    };


    const handlePurge = async (agentId: string, currentStatus: string) => {
        if (!session?.access_token) return;

        // Add loading state
        setLoadingAgents(prev => new Set(prev).add(agentId));

        // Mark termination start time for local phase calculation
        updateLocalState(agentId, {
            terminateRequestedAt: Date.now(),
            error: undefined
        });

        // 5 second buffer for running agents, 0 for stopped
        const stopBuffer = currentStatus === 'running' || currentStatus === 'starting' ? 5000 : 0;
        const purgeAt = new Date(Date.now() + (24 * 60 * 60 * 1000) + stopBuffer).toISOString();

        // Optimistic update for UI countdowns (desired state)
        setAgents(prev => prev.map(a =>
            a.id === agentId
                ? { ...a, agent_desired_state: { ...a.agent_desired_state, purge_at: purgeAt } }
                : a
        ));

        try {
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
            // Revert optimistic update on error
            await fetchProjectAndAgents();
            updateLocalState(agentId, { error: 'Termination Failed' });
        } finally {
            setLoadingAgents(prev => {
                const next = new Set(prev);
                next.delete(agentId);
                return next;
            });
        }
    };

    const handleForcePurge = async (agentId: string) => {
        if (!session?.access_token) return;

        // Add loading state
        setLoadingAgents(prev => new Set(prev).add(agentId));
        setPurgingAgents(prev => new Set(prev).add(agentId));

        // Optimistic update - remove agent from list immediately
        const agentToRemove = agents.find(a => a.id === agentId);
        setAgents(prev => prev.filter(a => a.id !== agentId));

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

            // Don't fetch immediately - let the polling interval handle it
            // This prevents the agent from flickering back into view
            setError(null);
            onDataChange?.();

            // Clean up purging state after a delay to ensure worker has processed
            setTimeout(() => {
                setPurgingAgents(prev => {
                    const next = new Set(prev);
                    next.delete(agentId);
                    return next;
                });
            }, 5000);
        } catch (err: any) {
            // Revert optimistic update on error
            if (agentToRemove) setAgents(prev => [...prev, agentToRemove]);
            setPurgingAgents(prev => {
                const next = new Set(prev);
                next.delete(agentId);
                return next;
            });
            setError(err.message);
        } finally {
            setLoadingAgents(prev => {
                const next = new Set(prev);
                next.delete(agentId);
                return next;
            });
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

        const commandId = crypto.randomUUID();

        // Determine if we need to force disable (if currently stopped)
        const agent = agents.find(a => a.id === agentId);
        const getOne = (val: any) => (Array.isArray(val) ? val[0] : val);
        const rawActual = agent ? (getOne(agent.agent_actual_state) || { status: 'stopped' }) : { status: 'stopped' };

        // Critical Fix: If actual status is stopped, we MUST ensure enabled=false is sent
        // faster than the purge_at=null update to prevent auto-restart loop
        const isStopped = rawActual.status !== 'running' && rawActual.status !== 'starting';

        // 1. Optimistic Update
        updateLocalState(agentId, {
            pendingAction: 'aborting',
            terminateRequestedAt: undefined,
            commandId,
            error: undefined,
            pendingEnabled: isStopped ? false : undefined
        });

        try {
            const body: any = { purge_at: null };
            // Explicitly force enabled=false if it's not running, to prevent "Stop -> Start" race
            if (isStopped) body.enabled = false;

            const res = await fetch(`${API_URL}/agents/${agentId}/config`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error('Failed to abort purge');

            await fetchProjectAndAgents();

            // 2. Success
            setLocalState(prev => {
                if (prev[agentId]?.commandId === commandId) {
                    const { pendingAction, commandId: _, ...rest } = prev[agentId];
                    return { ...prev, [agentId]: rest };
                }
                return prev;
            });

            onDataChange?.();
        } catch (err: any) {
            // 3. Error
            setLocalState(prev => {
                if (prev[agentId]?.commandId === commandId) {
                    return {
                        ...prev,
                        [agentId]: {
                            ...prev[agentId],
                            pendingAction: undefined,
                            error: 'Abort Failed'
                        }
                    };
                }
                return prev;
            });
        }
    };

    const saveAgentConfig = async (config: any, metadata?: any, name?: string) => {
        if (!editingAgent || !session?.access_token) return;
        try {
            const body: any = { config };
            if (metadata) body.metadata = metadata;
            if (name) body.name = name;

            const res = await fetch(`${API_URL}/agents/${editingAgent.id}/config`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(body)
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

    const limits: Record<string, number> = { 'free': 1, 'pro': 10, 'enterprise': 1000 };
    const tierLimit = project ? limits[project.tier] || 1 : 1;
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
                    <ElizaWizard
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
                                    const randomName = generateCoolName();
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
                                disabled={isInstalling}
                                className="flex-[2] py-4 rounded-2xl bg-primary text-white hover:opacity-90 active:scale-[0.98] transition-all font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isInstalling ? <Loader2 size={16} className="animate-spin" /> : 'Create Agent Instance'}
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
                    const now = new Date();

                    const local = localState[agent.id] || {};

                    // Derived Desired State
                    const rawDesired = getOne(agent.agent_desired_state) || { enabled: false, purge_at: null };
                    const desired = { ...rawDesired };

                    const rawActual = getOne(agent.agent_actual_state) || { status: 'stopped' };
                    const actual = { ...rawActual };

                    // Apply Local Overrides
                    if (local.pendingAction === 'aborting') {
                        desired.purge_at = null;
                        if (local.pendingEnabled !== undefined) {
                            desired.enabled = local.pendingEnabled;
                        }
                    }

                    // Derived Status Logic
                    let displayStatus = local.pendingAction || actual.status;
                    let purgeStatus = null;

                    // Termination Phases
                    if (local.terminateRequestedAt && desired.purge_at) {
                        const timeSinceReq = now.getTime() - local.terminateRequestedAt;

                        // Phase A: 0-5s -> Force RUNNING + Stopping In
                        if (timeSinceReq < 5000 && actual.status === 'running') {
                            displayStatus = 'running';
                            // Calculate remaining seconds for STOPPING IN
                            const rem = Math.ceil((5000 - timeSinceReq) / 1000);
                            purgeStatus = {
                                label: 'STOPPING IN',
                                time: `00:0${rem}`,
                                color: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                            };
                        }
                        // Phase B: >5s -> Force STOPPING
                        else if (timeSinceReq >= 5000 && actual.status === 'running') {
                            // Check for timeout (Phase C)
                            if (timeSinceReq > 65000) { // 1m + 5s buffer
                                displayStatus = 'running'; // Revert to actual
                                // We should ideally set an error here, but doing it in render is side-effecty.
                                // Instead we just show the error badge if we had one, or let the user try again.
                                // For now, let's just let it revert to 'running' which implies it failed to stop.
                            } else {
                                displayStatus = 'stopping';
                            }
                        }
                    }

                    // Existing logic for "Terminating In" (long term countdown)
                    // We only show this if we are NOT in the "Stopping In" short phase
                    if (!purgeStatus && desired.purge_at) {
                        const purgeDate = new Date(desired.purge_at);
                        if (purgeDate && !isNaN(purgeDate.getTime()) && now < purgeDate) {
                            // If we are past the 5s buffer, we are in TERMINATING IN
                            const diff = purgeDate.getTime() - now.getTime();
                            const hours = Math.floor(diff / 3600000);
                            const mins = Math.floor((diff % 3600000) / 60000);

                            purgeStatus = {
                                label: 'TERMINATING IN',
                                time: `${hours}h ${mins}m`,
                                color: 'text-destructive bg-destructive/10 border-destructive/20 animate-pulse font-black shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                            };
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
                                    <div className={`size-20 rounded-[1.75rem] flex items-center justify-center transition-all duration-700 shadow-2xl ${displayStatus === 'running'
                                        ? 'bg-green-500/10 text-green-500 shadow-green-500/10 scale-110'
                                        : 'bg-white/5 text-muted-foreground/40'
                                        }`}>
                                        <Bot size={36} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="font-black text-2xl tracking-tighter group-hover:text-primary transition-colors">{agent.name}</h4>
                                            <span className={`size-2 rounded-full ${displayStatus === 'running' ? 'bg-green-500 animate-glow brightness-150' :
                                                displayStatus === 'starting' ? 'bg-amber-500 animate-pulse' :
                                                    displayStatus === 'stopping' ? 'bg-amber-500 animate-pulse' :
                                                        actual.status === 'error' ? 'bg-destructive shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-muted-foreground/30'
                                                }`} />
                                            {local.error && (
                                                <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[9px] font-black uppercase tracking-widest border border-destructive/20 ml-2 animate-in fade-in slide-in-from-left-2">
                                                    {local.error}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                                            <span className={displayStatus === 'running' ? 'text-green-500' : 'text-muted-foreground'}>{displayStatus}</span>
                                            <span className="text-white/20">•</span>
                                            <span className="text-muted-foreground/50">Framework: {agent.framework || 'eliza'}</span>
                                            <span className="text-white/20">•</span>
                                            {/* Status / Error Indicator */}
                                            {actual.status === 'error' ? (
                                                <div className="flex items-center gap-1 text-destructive group relative cursor-help">
                                                    <AlertCircle size={10} />
                                                    <span className="truncate max-w-[150px]">{actual.error_message || 'Error'}</span>
                                                    {/* Tooltip for full error */}
                                                    {actual.error_message && (
                                                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-destructive text-destructive-foreground text-xs rounded shadow-lg z-50">
                                                            {actual.error_message}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : local.pendingAction ? (
                                                <div className="flex items-center gap-1 text-amber-500">
                                                    <Loader2 size={10} className="animate-spin" />
                                                    <span>{local.pendingAction.toUpperCase()}...</span>
                                                </div>
                                            ) : null}
                                            {actual.status === 'error' || local.pendingAction ? <span className="text-white/20">•</span> : null}

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
                                        disabled={displayStatus === 'starting' || displayStatus === 'stopping' || !!desired.purge_at}
                                        className={`size-14 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-lg ${desired.purge_at
                                            ? 'bg-muted/10 text-muted-foreground/30 cursor-not-allowed'
                                            : desired.enabled
                                                ? 'bg-destructive/10 text-destructive hover:bg-destructive shadow-destructive/20 hover:text-white'
                                                : 'bg-green-500/10 text-green-500 hover:bg-green-500 shadow-green-500/10 hover:text-white'
                                            }`}
                                        title={
                                            desired.purge_at
                                                ? 'Agent scheduled for termination'
                                                : desired.enabled ? 'Stop Agent' : 'Start Agent'
                                        }
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
                                        disabled={displayStatus !== 'running'}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setChattingAgentId(agent.id);
                                        }}
                                        className={`size-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${displayStatus === 'running'
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
                                        {local.pendingAction === 'aborting' ? <Loader2 size={22} className="animate-spin" /> :
                                            <Skull size={22} />
                                        }
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


            <ConfirmationModal
                isOpen={isLimitModalOpen}
                onClose={() => setIsLimitModalOpen(false)}
                onConfirm={() => {
                    setIsLimitModalOpen(false);
                    onUpgrade?.();
                }}
                title="Architecture Limit Reached"
                message={`You have reached the maximum number of agents for the FREE tier (${tierLimit} agent). Please upgrade to PRO to deploy more intelligence.`}
                confirmText="Upgrade"
                cancelText="Understood"
                type="warning"
            />
        </div>
    );
}
