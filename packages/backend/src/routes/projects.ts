import { FastifyPluginAsync } from 'fastify';
import { CreateProjectSchema, UserTier, TIER_CONFIG } from '@eliza-manager/shared';

const projectRoutes: FastifyPluginAsync = async (fastify) => {

    // List projects
    fastify.get('/', async (request) => {
        const { data, error } = await fastify.supabase
            .from('projects')
            .select('*, agents(count)')
            .eq('user_id', request.userId);

        if (error) {
            fastify.log.error({ error, userId: request.userId }, 'Error fetching user projects');
            throw error;
        }

        fastify.log.debug({ count: data?.length, userId: request.userId }, 'Projects listed for user');

        // Map data to include agentCount
        return data.map((p: any) => ({
            ...p,
            agentCount: p.agents?.[0]?.count || 0
        }));
    });

    // Create project
    fastify.post('/', async (request, reply) => {
        const { name } = CreateProjectSchema.parse(request.body);
        fastify.log.info({ userId: request.userId, name }, 'Attempting to create project');

        if (!request.userId) {
            fastify.log.error({ name }, 'userId missing in POST /projects');
            return reply.unauthorized('User identity lost - please re-login');
        }

        // 1. Fetch User Profile to get Tier
        const { data: profile, error: profileError } = await fastify.supabase
            .from('profiles')
            .select('tier')
            .eq('id', request.userId)
            .single();

        if (profileError) {
            fastify.log.error({ profileError, userId: request.userId }, 'Failed to fetch user profile for tier check');
            throw profileError;
        }

        const userTier = (profile?.tier as UserTier) || UserTier.FREE;
        const tierLimit = TIER_CONFIG[userTier]?.maxProjects || TIER_CONFIG[UserTier.FREE].maxProjects;

        // 2. Count existing projects
        const { count, error: countError } = await fastify.supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', request.userId);

        if (countError) throw countError;

        if (count !== null && count >= tierLimit) {
            throw fastify.httpErrors.forbidden(`Project limit reached for ${userTier.toUpperCase()} tier (${tierLimit} project${tierLimit === 1 ? '' : 's'})`);
        }

        const { data, error } = await fastify.supabase
            .from('projects')
            .insert([{ name, user_id: request.userId }])
            .select()
            .single();

        if (error) {
            fastify.log.error({ error, userId: request.userId }, 'Failed to insert project');
            throw error;
        }
        return reply.code(201).send(data);
    });

    // Get project details
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        const { data, error } = await fastify.supabase
            .from('projects')
            .select('*, agents(*)')
            .eq('id', id)
            .single();

        if (error || !data) {
            fastify.log.warn({ id, userId: request.userId }, 'Project not found in DB');
            return reply.notFound('Project not found');
        }

        if (data.user_id !== request.userId) {
            fastify.log.error({ id, actualOwner: data.user_id, requestUser: request.userId }, 'Unauthorized access to project details');
            return reply.forbidden('Not authorized');
        }

        // Add agentCount to match project list format
        return {
            ...data,
            agentCount: data.agents?.length || 0
        };
    });
    // Delete project
    fastify.delete('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        // Verify ownership
        const { data: project, error: fetchError } = await fastify.supabase
            .from('projects')
            .select('user_id')
            .eq('id', id)
            .single();

        if (fetchError || !project) {
            return reply.notFound('Project not found');
        }

        if (project.user_id !== request.userId) {
            return reply.forbidden('Not authorized to delete this project');
        }

        // Check for existing agents
        const { count, error: countError } = await fastify.supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', id);

        if (countError) {
            fastify.log.error({ countError, id }, 'Failed to check agent count before project deletion');
            throw countError;
        }

        if (count !== null && count > 0) {
            throw fastify.httpErrors.badRequest(`Cannot delete cluster while ${count} agent${count === 1 ? '' : 's'} are present. Please remove all agents first.`);
        }

        const { error } = await fastify.supabase
            .from('projects')
            .delete()
            .eq('id', id);

        if (error) {
            fastify.log.error({ error, id }, 'Failed to delete project');
            throw error;
        }

        return reply.code(204).send();
    });
};

export default projectRoutes;
