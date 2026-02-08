import { z } from 'zod';

// --- Tier & Security Architecture ---

export enum UserTier {
    FREE = 'free',
    PRO = 'pro',
    CUSTOM = 'custom',
    ENTERPRISE = 'enterprise'
}

export enum SecurityLevel {
    SANDBOX = 0,    // Standard isolation
    SYSADMIN = 1,   // SYS_ADMIN capability
    ROOT = 2        // Host Network, Root User
}

export const TIER_CONFIG = {
    [UserTier.FREE]: {
        maxProjects: 1,
        maxAgents: 2,
        maxSecurityLevel: SecurityLevel.SANDBOX
    },
    [UserTier.PRO]: {
        maxProjects: 3,
        maxAgents: 3,
        maxSecurityLevel: SecurityLevel.SYSADMIN
    },
    [UserTier.CUSTOM]: {
        maxProjects: 10,
        maxAgents: 10,
        maxSecurityLevel: SecurityLevel.ROOT
    },
    [UserTier.ENTERPRISE]: {
        maxProjects: Infinity,
        maxAgents: Infinity,
        maxSecurityLevel: SecurityLevel.ROOT
    }
};

export function resolveSecurityLevel(userTier: UserTier | string, requestedLevel: SecurityLevel | number): SecurityLevel {
    const tier = (userTier as UserTier) || UserTier.FREE;
    // Fallback to FREE config if tier not found
    const config = TIER_CONFIG[tier] || TIER_CONFIG[UserTier.FREE];
    const maxLevel = config.maxSecurityLevel;

    // effective = min(user_cap, requested)
    return Math.min(maxLevel, requestedLevel || 0);
}

export type TierConfig = typeof TIER_CONFIG[UserTier.FREE];

// Base Interfaces
export interface User {
    id: string;
    email: string;
    created_at: string;
}

export interface Profile {
    id: string;
    full_name?: string;
    avatar_url?: string;
    updated_at?: string;
    tier: UserTier | string; // Added tier
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
export type AgentStatus = 'stopped' | 'starting' | 'running' | 'error' | 'stopping';

export interface AgentDesiredState {
    agent_id: string;
    enabled: boolean;
    config: Record<string, any>; // Operational Config
    metadata: {
        security_level?: SecurityLevel;
        [key: string]: any;
    };
    updated_at: string;
    purge_at?: string;
}

export interface AgentActualState {
    agent_id: string;
    status: AgentStatus;
    last_sync: string | null;
    runtime_id: string | null;
    endpoint_url: string | null;
    error_message?: string;
    effective_security_tier?: string; // Audit trail
}

// API Request/Response Schemas
export const CreateProjectSchema = z.object({
    name: z.string().min(1).max(100),
});

export const UpdateAgentConfigSchema = z.object({
    enabled: z.boolean().optional(),
    config: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
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
    metadata: z.record(z.any()).optional()
});

export const AgentStateSchema = z.object({
    status: z.enum(['stopped', 'starting', 'running', 'error', 'stopping']),
    last_sync: z.string().optional(),
    endpoint_url: z.string().optional(),
    error_message: z.string().optional(),
    effective_security_tier: z.string().optional()
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdateAgentConfigRequest = z.infer<typeof UpdateAgentConfigSchema>;
export type CreateAgentRequest = z.infer<typeof CreateAgentSchema>;
