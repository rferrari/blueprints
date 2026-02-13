import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
    interface FastifyInstance {
        settings: {
            get: <T>(key: string, defaultValue?: T) => Promise<T | undefined>;
            isMcpEnabled: () => Promise<boolean>;
        };
    }
}

interface SystemSetting {
    key: string;
    value: any;
}

const settingsPlugin: FastifyPluginAsync = async (fastify) => {
    // Simple in-memory cache
    const cache = new Map<string, { value: any; expires: number }>();
    const CACHE_TTL = 30 * 1000; // 30 seconds

    const getSetting = async <T>(key: string, defaultValue?: T): Promise<T | undefined> => {
        const now = Date.now();
        const cached = cache.get(key);

        if (cached && cached.expires > now) {
            return cached.value as T;
        }

        try {
            const { data, error } = await fastify.supabase
                .from('system_settings')
                .select('value')
                .eq('key', key)
                .single();

            if (error || !data) {
                // If not found or error, return default but don't cache "undefined" forever if it's an error
                // If just not found, maybe we should cache specific "not found" state?
                // For now, let's just return default.
                return defaultValue;
            }

            const value = data.value as T;
            cache.set(key, { value, expires: now + CACHE_TTL });
            return value;
        } catch (err) {
            fastify.log.error({ err, key }, 'Failed to fetch system setting');
            return defaultValue;
        }
    };

    fastify.decorate('settings', {
        get: getSetting,
        isMcpEnabled: async () => {
            return await getSetting<boolean>('mcp_enabled', false) ?? false;
        }
    });
};

export default fp(settingsPlugin, {
    name: 'settings',
    dependencies: ['supabase'],
});
