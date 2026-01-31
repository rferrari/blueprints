import { z } from 'zod';

// Base Interfaces
export interface User {
    id: string;
    email: string;
    created_at: string;
}

export interface Project {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
}

export interface Agent {
    id: string;
    project_id: string;
    name: string;
    version: string;
    created_at: string;
}

export interface Runtime {
    id: string;
    name: string;
    eliza_api_url: string;
    auth_token: string;
    created_at: string;
}

// State Types
export type AgentStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface AgentDesiredState {
    agent_id: string;
    enabled: boolean;
    config: Record<string, any>;
    updated_at: string;
}

export interface AgentActualState {
    agent_id: string;
    status: AgentStatus;
    last_sync: string | null;
    runtime_id: string | null;
    error_message?: string;
}

// API Request/Response Schemas
export const CreateProjectSchema = z.object({
    name: z.string().min(1).max(100),
});

export const UpdateAgentConfigSchema = z.object({
    enabled: z.boolean().optional(),
    config: z.record(z.any()).optional(),
    purge_at: z.string().nullable().optional(),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdateAgentConfigRequest = z.infer<typeof UpdateAgentConfigSchema>;
