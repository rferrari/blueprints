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

        const { data: feedbackData } = await fastify.supabase
            .from('feedback')
            .select('rating');

        const { data: upgradeData, error: uError } = await fastify.supabase
            .from('upgrade_feedback')
            .select('payment_method');

        if (uError) {
            fastify.log.error({ uError }, 'AdminDashboard: Failed to fetch payment method data');
        }

        const { count: upgradeCount } = await fastify.supabase
            .from('upgrade_feedback')
            .select('*', { count: 'exact', head: true });

        const paymentStats: Record<string, number> = {};
        if (upgradeData) {
            upgradeData.forEach((curr: any) => {
                const method = curr.payment_method || 'unselected';
                paymentStats[method] = (paymentStats[method] || 0) + 1;
            });
        }

        const runningCount = activeAgents?.filter(a => a.status === 'running').length || 0;
        const errorCount = activeAgents?.filter(a => a.status === 'error').length || 0;

        const averageRating = feedbackData && feedbackData.length > 0
            ? feedbackData.reduce((acc, f) => acc + f.rating, 0) / feedbackData.length
            : 0;

        const stats = {
            users: userCount || 0,
            projects: projectCount || 0,
            agents: agentCount || 0,
            runningAgents: runningCount,
            failingAgents: errorCount,
            averageRating: Number(averageRating.toFixed(1)),
            feedbackCount: feedbackData?.length || 0,
            upgradeCount: upgradeCount || 0,
            paymentStats,
            timestamp: new Date().toISOString()
        };

        fastify.log.info({ stats }, 'AdminDashboard: Stats response generated');
        return stats;
    });

    // 2. Users listing (Admin only)
    fastify.get('/users', async () => {
        const { data: profiles, error } = await fastify.supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return profiles;
    });

    // Update User Tier (Admin only)
    fastify.patch<{ Params: { userId: string }, Body: { tier: string } }>('/users/:userId/tier', async (request, reply) => {
        const { userId } = request.params;
        const { tier } = request.body;

        if (!['free', 'pro', 'enterprise'].includes(tier)) {
            return reply.badRequest('Invalid tier level');
        }

        const { error } = await fastify.supabase
            .from('profiles')
            .update({ tier })
            .eq('id', userId);

        if (error) {
            fastify.log.error(error, `Failed to update tier for user ${userId}`);
            throw error;
        }

        return { success: true, userId, tier };
    });

    // 3. Clusters (Projects) listing (Admin only)
    fastify.get('/clusters', async () => {
        const { data: projects, error } = await fastify.supabase
            .from('projects')
            .select(`
                *,
                profiles(email),
                agents(id)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch active agents count for each project
        const projectIds = projects.map(p => p.id);
        const { data: activeAgents } = await fastify.supabase
            .from('agent_actual_state')
            .select('agent_id, status')
            .in('agent_id', projects.flatMap(p => p.agents.map((a: any) => a.id)))
            .eq('status', 'running');

        const activeAgentIds = new Set(activeAgents?.map(a => a.agent_id));

        return projects.map((p: any) => ({
            ...p,
            owner_email: p.profiles?.email || 'Unknown',
            total_agents: p.agents?.length || 0,
            active_agents: p.agents?.filter((a: any) => activeAgentIds.has(a.id)).length || 0
        }));
    });

    // 4. Upgrades listing (Admin only) - Alias for upgrade-feedback but with simpler path
    fastify.get('/upgrades', async () => {
        const { data: upgrades, error: uError } = await fastify.supabase
            .from('upgrade_feedback')
            .select('*')
            .order('created_at', { ascending: false });

        if (uError) throw uError;
        if (!upgrades || upgrades.length === 0) return [];

        const userIds = Array.from(new Set(upgrades.map((u: any) => u.user_id)));
        const { data: profiles, error: pError } = await fastify.supabase
            .from('profiles')
            .select('id, email')
            .in('id', userIds);

        if (pError) fastify.log.error(pError, 'Failed to fetch profiles for upgrades');

        return upgrades.map((u: any) => ({
            ...u,
            user_email: profiles?.find(p => p.id === u.user_id)?.email || 'Unknown',
            plan_selected: u.plan_selected || 'Unknown',
            payment_method: u.payment_method || 'Unknown',
        }));
    });

    // 2. Feedback listing (Admin only)
    fastify.get('/feedback', async () => {
        // Fetch feedbacks first
        const { data: feedbacks, error: fError } = await fastify.supabase
            .from('feedback')
            .select('*')
            .order('created_at', { ascending: false });

        if (fError) throw fError;
        if (!feedbacks || feedbacks.length === 0) return [];

        // Fetch profiles for these users
        const userIds = Array.from(new Set(feedbacks.map(f => f.user_id)));
        const { data: profiles, error: pError } = await fastify.supabase
            .from('profiles')
            .select('id, email')
            .in('id', userIds);

        if (pError) fastify.log.error(pError, 'Failed to fetch profiles for feedback');

        // Merge
        return feedbacks.map(f => ({
            ...f,
            user: profiles?.find(p => p.id === f.user_id) || { email: 'Unknown' }
        }));
    });

    // 3. Upgrade Feedback listing (Admin only)
    fastify.get('/upgrade-feedback', async () => {
        const { data: upgrades, error: uError } = await fastify.supabase
            .from('upgrade_feedback')
            .select('*')
            .order('created_at', { ascending: false });

        if (uError) throw uError;
        if (!upgrades || upgrades.length === 0) return [];

        const userIds = Array.from(new Set(upgrades.map(u => u.user_id)));
        const { data: profiles, error: pError } = await fastify.supabase
            .from('profiles')
            .select('id, email')
            .in('id', userIds);

        if (pError) fastify.log.error(pError, 'Failed to fetch profiles for upgrade feedback');

        return upgrades.map(u => ({
            ...u,
            user: profiles?.find(p => p.id === u.user_id) || { email: 'Unknown' }
        }));
    });

    // 4. All agents list (Admin view)
    fastify.get('/agents', async () => {
        // Fetch agents with project and desired state
        const { data: agents, error } = await fastify.supabase
            .from('agents')
            .select(`
                *,
                project:projects(name, tier, user_id),
                status:agent_actual_state(status, last_sync, endpoint_url, error_message),
                desired:agent_desired_state(enabled, updated_at)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch user emails for the projects
        const userIds = Array.from(new Set(agents.map((a: any) => a.project?.user_id).filter(Boolean)));
        const { data: profiles } = await fastify.supabase
            .from('profiles')
            .select('id, email')
            .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.email]));

        return agents.map((a: any) => ({
            ...a,
            project_name: a.project?.name || 'Unknown',
            user_email: profileMap.get(a.project?.user_id) || 'Unknown'
        }));
    });

    // 3. System Management (Super Admin only)
    fastify.post('/deploy-super-agent', { preHandler: [fastify.superAdminGuard] }, async (request, reply) => {
        // 1. Find or Create Administrative Cluster FIRST
        let { data: project, error: pError } = await fastify.supabase
            .from('projects')
            .select('id')
            .eq('name', 'Administrative Cluster')
            .eq('user_id', request.userId)
            .single();

        if (pError || !project) {
            // Check if it's a "not found" error or something else
            if (pError && pError.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
                // Check if we should ignore or throw? Let's try to create.
            }

            const { data: newProject, error } = await fastify.supabase
                .from('projects')
                .insert([{ name: 'Administrative Cluster', user_id: request.userId, tier: 'enterprise' }])
                .select()
                .single();

            if (error || !newProject) throw error || new Error('Failed to create Administrative Cluster');
            project = newProject as any;
        }

        // 2. Check for ANY agent in this Administrative Cluster
        const { data: existingAgents, error: searchError } = await fastify.supabase
            .from('agents')
            .select('id')
            .eq('project_id', (project as any).id);

        if (!searchError && existingAgents && existingAgents.length > 0) {
            return { message: 'Super Agent already exists', agentId: existingAgents[0].id, alreadyExists: true };
        }

        // 3. Create Super Agent if none exists
        const { data: agent, error: agentError } = await fastify.supabase
            .from('agents')
            .insert([{
                project_id: (project as any).id,
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
        return {
            message: 'System management interface active',
            dockerSupported: true
        };
    });

    // Emergency Stop All Agents
    fastify.post('/stop-all-agents', { preHandler: [fastify.superAdminGuard] }, async (request, reply) => {
        fastify.log.warn('EMERGENCY: Stop all agents requested by ' + request.userId);

        // 1. Update all desired states to disabled
        const { error: updateError } = await fastify.supabase
            .from('agent_desired_state')
            .update({ enabled: false })
            .neq('enabled', false); // Only update those that are enabled

        if (updateError) {
            fastify.log.error(updateError, 'Failed to disable all agents in DB');
            throw updateError;
        }

        // 2. Trigger worker job to stop everything (optional: add specific job type if needed)
        // For now, we rely on the worker picking up the desired state change.
        // But to be faster, we can push a "stop_all" job if the queue supports it.
        // Assuming standard reconciliation loop will pick it up. 
        // We can also force invalidation if possible.

        // Retrieve authentication for worker queue injection
        // (Assuming standard queue injection is available or we just rely on DB polling)

        return { message: 'Emergency stop protocol initiated. All agents set to disabled.' };
    });

    // Support Agent Management
    fastify.get('/support-agent', async () => {
        const { data, error } = await fastify.supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'support_agent_id')
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data?.value || { agent_id: null };
    });

    fastify.post<{ Body: { agent_id: string } }>('/support-agent', async (request) => {
        const { agent_id } = request.body;

        const { data, error } = await fastify.supabase
            .from('system_settings')
            .upsert({
                key: 'support_agent_id',
                value: { agent_id },
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, agent_id: data.value.agent_id };
    });
};

export default adminRoutes;
