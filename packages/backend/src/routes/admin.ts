import { FastifyPluginAsync } from 'fastify';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
    // Apply admin guard to all routes in this prefix
    fastify.addHook('preHandler', fastify.adminGuard);

    // 1. System-wide stats
    fastify.get('/stats', async () => {
        const { count: userCount } = await fastify.supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        const { count: projectCount } = await fastify.supabase
            .from('projects')
            .select('*', { count: 'exact', head: true });

        const { count: agentCount } = await fastify.supabase
            .from('agents')
            .select('*', { count: 'exact', head: true });

        const { data: activeAgents } = await fastify.supabase
            .from('agent_actual_state')
            .select('status');

        const runningCount = activeAgents?.filter(a => a.status === 'running').length || 0;
        const errorCount = activeAgents?.filter(a => a.status === 'error').length || 0;

        return {
            users: userCount || 0,
            projects: projectCount || 0,
            agents: agentCount || 0,
            runningAgents: runningCount,
            failingAgents: errorCount,
            timestamp: new Date().toISOString()
        };
    });

    // 2. All agents list (Admin view)
    fastify.get('/agents', async () => {
        const { data, error } = await fastify.supabase
            .from('agents')
            .select(`
                *,
                project:projects(name, tier, user_id),
                status:agent_actual_state(status, last_sync, endpoint_url, error_message),
                desired:agent_desired_state(enabled, updated_at)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    });

    // 3. System Management (Super Admin only)
    fastify.post('/deploy-super-agent', { preHandler: [fastify.superAdminGuard] }, async (request, reply) => {
        // Ensure Admin Project exists
        let { data: project, error: pError } = await fastify.supabase
            .from('projects')
            .select('id')
            .eq('name', 'Administrative Cluster')
            .eq('user_id', request.userId)
            .single();

        if (pError || !project) {
            const { data: newProject, error } = await fastify.supabase
                .from('projects')
                .insert([{ name: 'Administrative Cluster', user_id: request.userId, tier: 'enterprise' }])
                .select()
                .single();
            if (error || !newProject) throw error || new Error('Failed to create Administrative Cluster');
            project = newProject as any;
        }

        // Create Super Agent
        const { data: agent, error: agentError } = await fastify.supabase
            .from('agents')
            .insert([{
                project_id: project.id,
                name: 'Super Auditor',
                framework: 'openclaw',
            }])
            .select()
            .single();

        if (agentError) throw agentError;

        // Initialize with root privileges
        const { error: stateError } = await fastify.supabase
            .from('agent_desired_state')
            .insert([{
                agent_id: agent.id,
                enabled: true,
                config: {
                    metadata: { security_tier: 'custom' },
                    agents: { defaults: { workspace: '/root/.openclaw' } },
                    auth: { profiles: { default: { provider: 'anthropic', mode: 'api_key', token: '' } } },
                    gateway: { auth: { mode: 'token', token: 'ADMIN_SECRET_' + Math.random().toString(36).substring(7) } }
                }
            }]);

        if (stateError) throw stateError;

        return { message: 'Super Agent deployed', agentId: agent.id };
    });

    fastify.get('/system', { preHandler: [fastify.superAdminGuard] }, async () => {
        // This could eventually call docker.listContainers() via worker proxy or similar
        // For now, return a placeholder or basic info
        return {
            message: 'System management interface active',
            dockerSupported: true
        };
    });
};

export default adminRoutes;
