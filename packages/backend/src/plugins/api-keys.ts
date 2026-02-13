import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'crypto';

declare module 'fastify' {
    interface FastifyInstance {
        apiKeys: {
            verify: (key: string) => Promise<{ userId: string; scopes: string[]; keyId: string } | null>;
            generate: (userId: string, label: string, scopes?: string[]) => Promise<{ key: string; id: string }>;
            revoke: (id: string, userId: string) => Promise<boolean>;
            list: (userId: string) => Promise<any[]>;
        };
    }
}

const apiKeysPlugin: FastifyPluginAsync = async (fastify) => {

    const generateKey = async (userId: string, label: string, scopes: string[] = []) => {
        const keyRaw = crypto.randomBytes(32).toString('hex');
        const key = `bp_sk_${keyRaw}`;
        const keyHash = crypto.createHash('sha256').update(key).digest('hex');
        const prefix = key.substring(0, 10) + '...';

        const { data, error } = await fastify.supabase
            .from('user_api_keys')
            .insert({
                user_id: userId,
                label,
                key_hash: keyHash,
                prefix,
                scopes: JSON.stringify(scopes),
                is_active: true
            })
            .select('id')
            .single();

        if (error) throw error;
        return { key, id: data.id };
    };

    const verifyKey = async (key: string) => {
        if (!key.startsWith('bp_sk_')) return null;

        const keyHash = crypto.createHash('sha256').update(key).digest('hex');

        // Check cache first? (Maybe later)

        const { data, error } = await fastify.supabase
            .from('user_api_keys')
            .select('id, user_id, scopes, is_active, expires_at')
            .eq('key_hash', keyHash)
            .single();

        if (error || !data) return null;
        if (!data.is_active) return null;
        if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

        // Async update last_used_at (fire & forget)
        fastify.supabase.from('user_api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', data.id)
            .then(({ error }) => {
                if (error) fastify.log.error({ error }, 'Failed to update last_used_at');
            });

        return { userId: data.user_id, scopes: data.scopes, keyId: data.id };
    };

    const listKeys = async (userId: string) => {
        const { data, error } = await fastify.supabase
            .from('user_api_keys')
            .select('id, label, prefix, scopes, created_at, last_used_at, is_active')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    const revokeKey = async (id: string, userId: string) => {
        const { error } = await fastify.supabase
            .from('user_api_keys')
            .update({ is_active: false })
            .eq('id', id)
            .eq('user_id', userId);

        if (error) return false;
        return true;
    }

    fastify.decorate('apiKeys', {
        verify: verifyKey,
        generate: generateKey,
        revoke: revokeKey,
        list: listKeys
    });
};

export default fp(apiKeysPlugin, {
    name: 'apiKeys',
    dependencies: ['supabase'],
});
