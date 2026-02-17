'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import { apiFetch, apiPost, apiPatch } from '@/lib/api';

export interface Agent {
    id: string;
    name: string;
    framework: string;
    status: string;
    agent_desired_state: Record<string, unknown>[];
    created_at: string;
}

interface Profile {
    id: string;
    metadata: Record<string, unknown>;
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

    const fetchOrCreateAgent = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Get user profile to check metadata
            const profile = await apiFetch<Profile>('/profiles/me');
            const agentId = profile.metadata?.openclaw_agent_id as string | undefined;

            if (agentId) {
                try {
                    const existingAgent = await apiFetch<Agent>(`/agents/${agentId}`);
                    setAgent(existingAgent);
                    setLoading(false);
                    return;
                } catch {
                    // If fetching specific agent fails, proceed to creation or fallback
                }
            }

            // 2. If not found in metadata, check if any openclaw agent exists already (fallback)
            const agents = await apiFetch<Agent[]>('/agents');
            const openclawAgent = agents.find(a => a.framework === 'openclaw');

            if (openclawAgent) {
                setAgent(openclawAgent);
                // Update profile metadata if missing
                await apiPatch('/profiles/me', {
                    metadata: { ...profile.metadata, openclaw_agent_id: openclawAgent.id }
                });
            } else {
                // 3. Auto-create Flow: Settings -> Project -> Agent -> Profile

                // Get default blueprint (Assume proxy endpoint or fallback to known ID if needed)
                let blueprintId = '2d25b0f6-fc05-4cb9-882a-f5fa05ec54da';
                try {
                    const setting = await apiFetch<{ value: string }>('/system-settings/openclaw_default_blueprint');
                    blueprintId = setting.value;
                } catch {
                    // Fallback to the requested ID
                }

                // Create Project
                const project = await apiPost<Project>('/projects', {
                    name: 'OpenClaw Project'
                });

                // Create Agent
                const newAgent = await apiPost<Agent>('/agents', {
                    name: 'My Agent',
                    framework: 'openclaw',
                    project_id: project.id,
                    blueprint_id: blueprintId
                });

                // Update Profile Metadata
                await apiPatch('/profiles/me', {
                    metadata: { ...profile.metadata, openclaw_agent_id: newAgent.id }
                });

                setAgent(newAgent);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load agent';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchOrCreateAgent();
    }, [fetchOrCreateAgent]);

    return { agent, loading, error, refetch: fetchOrCreateAgent };
}
