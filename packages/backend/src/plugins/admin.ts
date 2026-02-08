import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
    interface FastifyRequest {
        userRole?: 'user' | 'admin_read' | 'super_admin';
    }
}

const adminPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.decorateRequest('userRole', undefined);

    fastify.addHook('preValidation', async (request, reply) => {
        // userId is set by authPlugin
        if (!request.userId) return;

        try {
            const { data: profile, error } = await fastify.supabase
                .from('profiles')
                .select('role')
                .eq('id', request.userId)
                .single();

            if (error || !profile) {
                fastify.log.warn({ userId: request.userId }, 'Admin Plugin: Profile not found or role missing');
                request.userRole = 'user';
                return;
            }

            request.userRole = profile.role;
            fastify.log.debug({ userId: request.userId, role: request.userRole }, 'Admin Plugin: User role identified');
        } catch (e) {
            fastify.log.error(e, 'Admin Plugin: Unexpected error during role lookup');
            request.userRole = 'user';
        }
    });

    // Helper to enforce admin roles
    fastify.decorate('adminGuard', async (request: any, reply: any) => {
        if (!request.userRole || !['admin_read', 'super_admin'].includes(request.userRole)) {
            return reply.forbidden('Administrative privileges required');
        }
    });

    fastify.decorate('superAdminGuard', async (request: any, reply: any) => {
        if (request.userRole !== 'super_admin') {
            return reply.forbidden('Super Administrative privileges required');
        }
    });
};

export default fp(adminPlugin, {
    name: 'admin',
    dependencies: ['auth', 'supabase'],
});
