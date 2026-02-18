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

    const fetchOrCreateAgent = useCallback(async (silent = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);
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

            // Step A: Get default blueprint ID and its config
            const { data: blueprintSetting } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'openclaw_default_blueprint')
                .single();

            const blueprintId = (blueprintSetting?.value as string) || '2d25b0f6-fc05-4cb9-882a-f5fa05ec54da';

            // Fetch the actual blueprint config
            const { data: blueprint } = await supabase
                .from('blueprints')
                .select('config')
                .eq('id', blueprintId)
                .single();

            // Robust JSON parsing: Supabase might return it as a string or a JSON object
            let blueprintConfig: any = {};
            try {
                if (typeof blueprint?.config === 'string') {
                    blueprintConfig = JSON.parse(blueprint.config);
                } else if (blueprint?.config && typeof blueprint.config === 'object') {
                    blueprintConfig = JSON.parse(JSON.stringify(blueprint.config)); // Deep clone
                }
            } catch (err) {
                console.warn('Failed to parse blueprint config, using empty object');
                blueprintConfig = {};
            }

            // Step A.1: Ensure Gateway Config & Auth (Critical for startup)
            if (!blueprintConfig.gateway) blueprintConfig.gateway = {};
            if (!blueprintConfig.gateway.http) blueprintConfig.gateway.http = { endpoints: { chatCompletions: { enabled: true } } };
            if (blueprintConfig.gateway.bind !== 'lan') blueprintConfig.gateway.bind = 'lan';
            if (blueprintConfig.gateway.mode !== 'local') blueprintConfig.gateway.mode = 'local';

            if (!blueprintConfig.gateway.auth || (!blueprintConfig.gateway.auth.token && !blueprintConfig.gateway.auth.password)) {
                console.log('Generating missing gateway auth for new agent');
                blueprintConfig.gateway.auth = {
                    mode: 'token',
                    token: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
                };
            }

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

            // Step C: Create Agent with Blueprint Config
            console.log('Creating agent in project:', projectId);
            const newAgent = await apiPost<Agent>(`/agents/project/${projectId}`, {
                name: 'OpenClaw Agent',
                framework: 'openclaw',
                templateId: blueprintId,
                configTemplate: blueprintConfig // Pass the blueprint config here
            });


            // Step C.1: Lease an API Key (Managed Key)
            try {
                console.log('Leasing managed key for agent:', newAgent.id);
                await apiPost('/managed-keys/lease', {
                    provider: 'openrouter',
                    agent_id: newAgent.id,
                    framework: 'openclaw'
                });
            } catch (leaseError) {
                console.error('Failed to lease managed key:', leaseError);
                // We don't stop the flow, but the agent might not work without a key
            }

            // Step C.2: Enable the agent (Auto-start)
            console.log('Enabling agent...');
            await supabase
                .from('agent_desired_state')
                .update({ enabled: true })
                .eq('agent_id', newAgent.id);

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

        // Polling for status updates if the agent exists
        const interval = setInterval(() => {
            if (agent && !loading) {
                // Background refresh only
                fetchOrCreateAgent(true);
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, [fetchOrCreateAgent, agent, loading]);

    return { agent, loading, error, refetch: fetchOrCreateAgent };
}
