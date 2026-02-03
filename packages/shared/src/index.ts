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
    framework: string;
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
    endpoint_url: string | null;
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

export const OpenClawConfigSchema = z.object({
    auth: z.object({
        profiles: z.record(z.string(), z.object({
            provider: z.string(),
            mode: z.enum(['api_key', 'oauth', 'token']),
            email: z.string().optional()
        })).optional()
    }).optional(),
    models: z.object({
        providers: z.record(z.string(), z.object({
            apiKey: z.string().optional(),
            baseUrl: z.string().optional(),
            models: z.array(z.object({
                id: z.string(),
                name: z.string().optional(),
                api: z.string().optional(),
                compat: z.record(z.any()).optional()
            })).optional()
        })).optional()
    }).optional(),
    gateway: z.object({
        auth: z.object({
            token: z.string().optional()
        }).optional(),
        bind: z.string().optional(),
        http: z.object({
            endpoints: z.object({
                chatCompletions: z.object({
                    enabled: z.boolean().optional()
                }).optional(),
                responses: z.object({
                    enabled: z.boolean().optional()
                }).optional()
            }).optional()
        }).optional()
    }).optional(),
    channels: z.record(z.string(), z.any()).optional(),
    agents: z.object({
        defaults: z.object({
            workspace: z.string().optional(),
            model: z.object({
                primary: z.string().optional()
            }).optional(),
            models: z.record(z.string(), z.any()).optional()
        }).optional()
    }).optional()
});

export type OpenClawConfig = z.infer<typeof OpenClawConfigSchema>;

export const CreateAgentSchema = z.object({
    name: z.string().min(1).max(100),
    framework: z.enum(['eliza', 'openclaw']).default('eliza'),
    templateId: z.string().optional(),
    configTemplate: z.record(z.any()).optional(),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdateAgentConfigRequest = z.infer<typeof UpdateAgentConfigSchema>;
export type CreateAgentRequest = z.infer<typeof CreateAgentSchema>;
