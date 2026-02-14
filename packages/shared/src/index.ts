import { z } from 'zod';

// Note: crypto.ts is NOT exported here because it uses Node.js crypto module
// Backend and worker should import directly: import { cryptoUtils } from '@eliza-manager/shared/crypto'

export const INCOMPATIBLE_MODEL_PATTERNS = [
    /embedding/i,
    /dall-e/i,
    /whisper/i,
    /tts/i,
    /realtime/i,
    /moderation/i,
    /vision/i,
    /edit/i,
    /batch/i,
    /image/i,
    /transcribe/i,
    /omni/i,
    /computer-use/i
];

export function isModelCompatible(id: string) {
    if (INCOMPATIBLE_MODEL_PATTERNS.some(pattern => pattern.test(id))) return false;
    return true;
}

/**
 * @deprecated Use isModelCompatible instead
 */
export function isOpenAICompatible(id: string) {
    return isModelCompatible(id);
}



export const OPENAI_ALLOWED_MODELS = new Set([
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-mini",
    "gpt-4.1",
    "o1",
    "o1-pro"
]);

// --- Tier & Security Architecture ---

export enum UserTier {
    FREE = 'free',
    PRO = 'pro',
    CUSTOM = 'custom',
    ENTERPRISE = 'enterprise'
}

export enum SecurityLevel {
    STANDARD = 0,    // Standard isolation
    ADVANCED = 1,   // Advanced isolation
    PRO = 2,        // SYS_ADMIN capability
    ROOT = 10        // Host Network, Root User
}

export const TIER_CONFIG = {
    [UserTier.FREE]: {
        maxProjects: 1,
        maxAgents: 2,
        maxSecurityLevel: SecurityLevel.STANDARD
    },
    [UserTier.PRO]: {
        maxProjects: 3,
        maxAgents: 3,
        maxSecurityLevel: SecurityLevel.ADVANCED
    },
    [UserTier.CUSTOM]: {
        maxProjects: 10,
        maxAgents: 10,
        maxSecurityLevel: SecurityLevel.PRO
    },
    [UserTier.ENTERPRISE]: {
        maxProjects: Infinity,
        maxAgents: Infinity,
        maxSecurityLevel: SecurityLevel.PRO
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
    tier: string;
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
    version?: string;
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
    purge_at?: string | null;
}

export interface AgentActualState {
    agent_id: string;
    status: AgentStatus;
    last_sync: string | null;
    runtime_id: string | null;
    endpoint_url: string | null;
    error_message?: string;
    effective_security_tier?: string; // Audit trail
    version?: string;
    stats?: {
        cpu: string;
        memory: string;
    };
}

// API Request/Response Schemas
export const CreateProjectSchema = z.object({
    name: z.string().min(1).max(100),
});

export const UpdateAgentConfigSchema = z.object({
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    name: z.string().optional(),
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


export const SUPPORTED_FRAMEWORKS = ['elizaos', 'openclaw', 'picoclaw'] as const;
export type SupportedFramework = typeof SUPPORTED_FRAMEWORKS[number];

export const CreateAgentSchema = z.object({
    name: z.string().min(1).max(100),
    framework: z.enum(SUPPORTED_FRAMEWORKS).default('elizaos'),
    templateId: z.string().optional(),
    configTemplate: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional()
});

export const AgentStateSchema = z.object({
    status: z.enum(['stopped', 'starting', 'running', 'error', 'stopping']),
    last_sync: z.string().optional(),
    endpoint_url: z.string().optional(),
    error_message: z.string().optional(),
    effective_security_tier: z.string().optional()
});

// --- Support Agent Proxy Schemas ---

export const CreateSupportSessionSchema = z.object({
    ip_hash: z.string(),
    user_agent: z.string().optional(),
});

export const SupportMessageSchema = z.object({
    session_id: z.string().uuid(),
    content: z.string().min(1).max(5000),
    sequence: z.number().int().nonnegative(),
});

export const SupportProxyConfigSchema = z.object({
    agent_id: z.string().uuid(),
    online: z.boolean(),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdateAgentConfigRequest = z.infer<typeof UpdateAgentConfigSchema>;
export type CreateAgentRequest = z.infer<typeof CreateAgentSchema>;
export type CreateSupportSessionRequest = z.infer<typeof CreateSupportSessionSchema>;
export type SupportMessageRequest = z.infer<typeof SupportMessageSchema>;

// --- Managed Provider Keys (MPK) Plugin ---

export const MANAGED_KEYS_FEATURE_FLAG = 'ENABLE_MANAGED_KEYS';

export enum LeaseStatus {
    ACTIVE = 'active',
    EXPIRED = 'expired',
    REVOKED = 'revoked',
}

/** Full provider config stored as JSONB on managed_provider_keys.config */
export interface ManagedKeyConfig {
    default_model: string;
    fallback_models?: string[];
    base_url: string;
    model_api?: string; // 'openai-completions' | 'openai-responses' | 'anthropic-messages'
    frameworks?: {
        openclaw?: Record<string, any>;
        elizaos?: Record<string, any>;
        [key: string]: Record<string, any> | undefined;
    };
}

export interface ManagedProviderKey {
    id: string;
    provider: string;
    label: string;
    encrypted_key: string;
    active: boolean;
    config: ManagedKeyConfig;
    daily_limit_usd?: number;
    monthly_limit_usd?: number;
    created_at: string;
}

export interface KeyLease {
    id: string;
    managed_key_id: string;
    user_id: string;
    agent_id: string;
    granted_at: string;
    expires_at: string;
    revoked_at?: string;
    status: LeaseStatus;
    usage_usd: number;
    last_used_at?: string;
    max_agents: number;
    created_at: string;
}

/** Tier-based lease defaults */
export const LEASE_TIER_CONFIG = {
    [UserTier.FREE]: { duration_days: 7, max_agents: 1, max_usd: 5 },
    [UserTier.PRO]: { duration_days: 30, max_agents: 3, max_usd: 50 },
    [UserTier.CUSTOM]: { duration_days: 90, max_agents: 5, max_usd: 200 },
    [UserTier.ENTERPRISE]: { duration_days: 365, max_agents: 10, max_usd: 1000 },
};

// --- MPK Zod Schemas ---

export const ManagedKeyConfigSchema = z.object({
    default_model: z.string(),
    fallback_models: z.array(z.string()).optional(),
    base_url: z.string(),
    model_api: z.string().optional(),
    frameworks: z.record(z.string(), z.record(z.any())).optional(),
});

export const CreateManagedKeySchema = z.object({
    provider: z.string().default('openrouter'),
    label: z.string().min(1).max(100),
    api_key: z.string().min(1),
    config: ManagedKeyConfigSchema.optional().default({
        default_model: 'openrouter/auto',
        base_url: 'https://openrouter.ai/api/v1',
    }),
    daily_limit_usd: z.number().optional(),
    monthly_limit_usd: z.number().optional(),
});

export const UpdateManagedKeySchema = z.object({
    label: z.string().optional(),
    active: z.boolean().optional(),
    config: ManagedKeyConfigSchema.partial().optional(),
    daily_limit_usd: z.number().nullable().optional(),
    monthly_limit_usd: z.number().nullable().optional(),
});

export const RequestLeaseSchema = z.object({
    provider: z.string().default('openrouter'),
    agent_id: z.string().uuid(),
    framework: z.string().default('openclaw'),
});

export const ExtendLeaseSchema = z.object({
    additional_days: z.number().int().min(1).max(365).default(7),
});

export type CreateManagedKeyRequest = z.infer<typeof CreateManagedKeySchema>;
export type UpdateManagedKeyRequest = z.infer<typeof UpdateManagedKeySchema>;
export type RequestLeaseRequest = z.infer<typeof RequestLeaseSchema>;
export type ExtendLeaseRequest = z.infer<typeof ExtendLeaseSchema>;
