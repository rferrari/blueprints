import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare module 'fastify' {
    interface FastifyInstance {
        supabase: SupabaseClient;
    }
}

export interface SupabasePluginOptions {
    url: string;
    key: string;
}

const supabasePlugin: FastifyPluginAsync<SupabasePluginOptions> = async (fastify, options) => {
    const supabase = createClient(options.url, options.key);
    fastify.decorate('supabase', supabase);
};

export default fp(supabasePlugin, {
    name: 'supabase',
});
