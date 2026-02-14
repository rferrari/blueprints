import crypto from 'node:crypto';

/**
 * Generates a consistent container name for an agent.
 */
export function getAgentContainerName(agentId: string, framework: string = 'agent', projectId?: string): string {
    if (framework === 'elizaos' && projectId) {
        return `elizaos-${projectId}`;
    }
    return `${framework}-${agentId}`;
}

/**
 * Generates a stable hash for a configuration object to detect changes.
 */
export function getConfigHash(config: any): string {
    return crypto
        .createHash('md5')
        .update(JSON.stringify(config))
        .digest('hex');
}

/**
 * Sanitizes agent configuration, repairing common provider mismatches.
 */
export function sanitizeConfig(config: any): any {
    if (!config) return config;
    const clean = JSON.parse(JSON.stringify(config));

    // Venice AI specific fixes
    if (clean.auth?.profiles?.['default']?.provider === 'venice') {
        const v = clean.models?.providers?.venice;
        if (v?.models?.[0]) {
            // 1. Remove "venice/" prefix if present
            if (v.models[0].id?.startsWith('venice/')) {
                v.models[0].id = v.models[0].id.replace('venice/', '');
            }

            // 2. Correct modelApi if it's wrong (should be openai-completions)
            if (v.models[0].api !== 'openai-completions') {
                v.models[0].api = 'openai-completions';
            }

            // 3. Update primary reference in agents.defaults
            if (clean.agents?.defaults?.model) {
                clean.agents.defaults.model.primary = `venice/${v.models[0].id}`;
            }
        }
    }

    // Auth Profile Cleanups
    if (clean.auth?.profiles) {
        Object.keys(clean.auth.profiles).forEach(key => {
            const profile = clean.auth.profiles[key];
            if (profile && typeof profile === 'object') {
                // OpenClaw validation fails if 'token' is present in an auth profile
                delete (profile as any).token;
            }
        });
    }

    return clean;
}

/**
 * Recursively search and replace a key in an object.
 * Used for Eliza's lore -> knowledge transition.
 */
export function renameKey(obj: any, oldKey: string, newKey: string): any {
    if (Array.isArray(obj)) {
        return obj.map(item => renameKey(item, oldKey, newKey));
    } else if (obj !== null && typeof obj === 'object') {
        const newObj: any = {};
        for (const key in obj) {
            const currentKey = key === oldKey ? newKey : key;
            newObj[currentKey] = renameKey(obj[key], oldKey, newKey);
        }
        return newObj;
    }
    return obj;
}
