'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth-provider';
import { createClient } from '@/lib/supabase';
import { apiFetch, apiPost, apiPatch } from '@/lib/api';

export interface Agent {
    id: string;
    name: string;
    framework: string;
    created_at: string;
    agent_actual_state?: {
        status: string;
        endpoint_url?: string;
    };
    agent_desired_state?: {
        enabled: boolean;
        config: Record<string, unknown>;
        purge_at?: string | null;
    }[];
    isPurging?: boolean;
}

interface Project {
    id: string;
    name: string;
}

interface AgentContextType {
    agent: Agent | null;
    loading: boolean;
    error: string | null;
    refetch: (silent?: boolean) => Promise<void>;
    deployAgent: () => Promise<void>;
    purgeAgent: () => Promise<void>;
    startAgent: () => Promise<void>;
    stopAgent: () => Promise<void>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = useMemo(() => createClient(), []);

    const fetchAgent = useCallback(async (silent = false) => {
        if (!user) {
            setLoading(false);
            setAgent(null);
            return;
        }

        if (!silent) setLoading(true);
        setError(null);

        try {
            let agentId = user.user_metadata?.openclaw_agent_id as string | undefined;

            if (agentId) {
                try {
                    const existingAgent = await apiFetch<Agent>(`/agents/${agentId}`);
                    if (existingAgent) {
                        const agentData = existingAgent;
                        // Check if purging
                        const desired = Array.isArray(agentData.agent_desired_state) ? agentData.agent_desired_state[0] : agentData.agent_desired_state;
                        if (desired?.purge_at) {
                            agentData.isPurging = true;
                        }
                        setAgent(agentData);
                        if (!silent) setLoading(false);
                        return;
                    }
                } catch (fetchError) {
                    console.warn('Failed to fetch agent by ID, falling back to search:', fetchError);
                }
            }

            // Fallback: search for openclaw agents in user's projects
            const projects = await apiFetch<Project[]>('/projects');
            for (const project of projects) {
                const projectAgents = await apiFetch<Agent[]>(`/agents/project/${project.id}`);
                const openclawAgent = projectAgents.find(a => a.framework === 'openclaw');

                if (openclawAgent) {
                    const agentData = openclawAgent;
                    const desired = Array.isArray(agentData.agent_desired_state) ? agentData.agent_desired_state[0] : agentData.agent_desired_state;
                    if (desired?.purge_at) {
                        agentData.isPurging = true;
                    }
                    setAgent(agentData);

                    if (agentData.id !== agentId) {
                        const sb = createClient();
                        sb.auth.updateUser({
                            data: { openclaw_agent_id: agentData.id }
                        });
                    }

                    if (!silent) setLoading(false);
                    return;
                }
            }

            setAgent(null);
        } catch (err: unknown) {
            console.error('Agent fetch error:', err);
            setError('Failed to load agent');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [user]);


    const deployAgent = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);

        try {
            const { data: blueprintSetting } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'openclaw_default_blueprint')
                .single();

            const blueprintId = (blueprintSetting?.value as string) || 'd044a766-d00b-4733-b070-4298d9d0d141';

            const { data: blueprint } = await supabase
                .from('blueprints')
                .select('config')
                .eq('id', blueprintId)
                .single();

            let blueprintConfig: any = {};
            if (blueprint?.config) {
                blueprintConfig = typeof blueprint.config === 'string' ? JSON.parse(blueprint.config) : blueprint.config;
            }

            let projectId: string;
            const projects = await apiFetch<Project[]>('/projects');
            if (projects && projects.length > 0) {
                projectId = projects[0].id;
            } else {
                const newProject = await apiPost<Project>('/projects', { name: 'My Workspace' });
                projectId = newProject.id;
            }

            const newAgent = await apiPost<Agent>(`/agents/project/${projectId}`, {
                name: user.email?.split('@')[0] + ' OpenClaw Agent',
                framework: 'openclaw',
                templateId: blueprintId,
                configTemplate: blueprintConfig
            });

            try {
                await apiPost('/managed-keys/lease', {
                    provider: 'openrouter',
                    agent_id: newAgent.id,
                    framework: 'openclaw'
                });
            } catch (leaseError) {
                console.warn('Lease failed:', leaseError);
            }

            await supabase.auth.updateUser({
                data: { openclaw_agent_id: newAgent.id }
            });

            await fetchAgent();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create agent');
            setLoading(false);
        }
    };

    const purgeAgent = async () => {
        if (!agent) return;
        setLoading(true);
        try {
            await apiPost(`/agents/${agent.id}/purge`, {});
            await supabase.auth.updateUser({ data: { openclaw_agent_id: null } });
            setAgent(null);
        } catch (err: unknown) {
            setError('Failed to terminate agent');
            await fetchAgent();
        } finally {
            setLoading(false);
        }
    };

    const startAgent = async () => {
        if (!agent) return;
        await apiPatch(`/agents/${agent.id}/config`, { enabled: true });
        await fetchAgent(true);
    };

    const stopAgent = async () => {
        if (!agent) return;
        await apiPatch(`/agents/${agent.id}/config`, { enabled: false });
        await fetchAgent(true);
    };

    useEffect(() => {
        fetchAgent();
    }, [fetchAgent]);

    useEffect(() => {
        if (!agent) return;
        const interval = setInterval(() => {
            fetchAgent(true);
        }, 8000);
        return () => clearInterval(interval);
    }, [agent?.id, fetchAgent]);

    const value = useMemo(() => ({
        agent,
        loading,
        error,
        refetch: fetchAgent,
        deployAgent,
        purgeAgent,
        startAgent,
        stopAgent
    }), [agent, loading, error, fetchAgent]);

    return (
        <AgentContext.Provider value={value}>
            {children}
        </AgentContext.Provider>
    );
}

export const useAgent = () => {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgent must be used within an AgentProvider');
    }
    return context;
};
