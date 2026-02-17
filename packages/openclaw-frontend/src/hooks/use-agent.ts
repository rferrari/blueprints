'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { createClient } from '@/lib/supabase';
import { apiFetch, apiPost } from '@/lib/api';

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
    }[];
}

interface Project {
    id: string;
    name: string;
}

interface UseAgentReturn {
    agent: Agent | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useAgent(): UseAgentReturn {
    const { user } = useAuth();
    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    const fetchOrCreateAgent = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Check user metadata for agent ID
            let agentId = user.user_metadata?.openclaw_agent_id as string | undefined;

            if (agentId) {
                console.log('Fetching agent from metadata:', agentId);
                const { data: existingAgent, error: fetchError } = await supabase
                    .from('agents')
                    .select('*, agent_actual_state(*), agent_desired_state(*)')
                    .eq('id', agentId)
                    .single();

                if (!fetchError && existingAgent) {
                    setAgent(existingAgent as unknown as Agent);
                    setLoading(false);
                    return;
                }
                console.warn('Agent from metadata not found, falling back');
            }

            // 2. Fallback: Search for any OpenClaw agent owned by user
            console.log('Searching for existing OpenClaw agents');
            // We need to join with projects to check user_id
            const { data: userAgents, error: searchError } = await supabase
                .from('agents')
                .select('*, projects!inner(user_id), agent_actual_state(*), agent_desired_state(*)')
                .eq('framework', 'openclaw')
                .eq('projects.user_id', user.id)
                .limit(1);

            if (!searchError && userAgents && userAgents.length > 0) {
                const foundAgent = userAgents[0];
                console.log('Found existing agent:', foundAgent.id);
                setAgent(foundAgent as unknown as Agent);

                // Update metadata for faster recovery next time
                await supabase.auth.updateUser({
                    data: { openclaw_agent_id: foundAgent.id }
                });

                setLoading(false);
                return;
            }

            // 3. Auto-creation sequence
            console.log('Initiating agent creation flow');

            // Step A: Get default blueprint ID
            const { data: blueprintSetting } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'openclaw_default_blueprint')
                .single();

            const blueprintId = (blueprintSetting?.value as string) || '2d25b0f6-fc05-4cb9-882a-f5fa05ec54da';

            // Step B: Ensure project exists
            let projectId: string;
            const projects = await apiFetch<Project[]>('/projects');

            if (projects && projects.length > 0) {
                projectId = projects[0].id;
            } else {
                const newProject = await apiPost<Project>('/projects', {
                    name: 'My Workspace'
                });
                projectId = newProject.id;
            }

            // Step C: Create Agent
            console.log('Creating agent in project:', projectId);
            const newAgent = await apiPost<Agent>(`/agents/project/${projectId}`, {
                name: 'OpenClaw Persona',
                framework: 'openclaw',
                templateId: blueprintId
            });

            // Step D: Update metadata
            await supabase.auth.updateUser({
                data: { openclaw_agent_id: newAgent.id }
            });

            // Fetch the full agent state (since POST /agents/project/:id returns basic agent)
            const { data: fullAgent } = await supabase
                .from('agents')
                .select('*, agent_actual_state(*), agent_desired_state(*)')
                .eq('id', newAgent.id)
                .single();

            setAgent((fullAgent as unknown as Agent) || newAgent);

        } catch (err: unknown) {
            console.error('Agent flow error:', err);
            const message = err instanceof Error ? err.message : 'Failed to setup agent';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [user, supabase]);

    useEffect(() => {
        fetchOrCreateAgent();
    }, [fetchOrCreateAgent]);

    return { agent, loading, error, refetch: fetchOrCreateAgent };
}
