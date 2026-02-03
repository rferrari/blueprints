import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
    interface FastifyRequest {
        userId: string;
    }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.addHook('preValidation', async (request, reply) => {
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            return reply.unauthorized('Missing Authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token with Supabase
        const { data: { user }, error } = await fastify.supabase.auth.getUser(token);

        if (error || !user) {
            fastify.log.error({ error, hasToken: !!token }, 'Auth failed: Invalid token');
            return reply.unauthorized('Invalid or expired token');
        }

        request.userId = user.id;
        fastify.log.debug({ userId: user.id, url: request.url }, 'Auth successful');
    });
};

export default fp(authPlugin, {
    name: 'auth',
});
