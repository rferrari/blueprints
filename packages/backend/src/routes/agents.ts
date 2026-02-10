import { FastifyPluginAsync } from 'fastify';
import { UpdateAgentConfigSchema, CreateAgentSchema, UserTier, TIER_CONFIG } from '@eliza-manager/shared';

const agentRoutes: FastifyPluginAsync = async (fastify) => {

    // List agents for a project
    fastify.get('/project/:projectId', async (request) => {
        const { projectId } = request.params as { projectId: string };
        fastify.log.debug({ userId: request.userId, projectId }, 'Attempting to fetch agents for project');

        // Verify project ownership
        const { data: project, error: pError } = await fastify.supabase
            .from('projects')
            .select('id, user_id')
            .eq('id', projectId)
            .single();

        if (pError || !project) {
            fastify.log.error({ pError, projectId, userId: request.userId }, 'Project lookup failed in GET /agents/project/:projectId');
            throw fastify.httpErrors.notFound('Project not found');
        }

        if (project.user_id !== request.userId) {
            fastify.log.warn({ projectId, owner: project.user_id, requestUser: request.userId }, 'Unauthorized access attempt to project agents');
            throw fastify.httpErrors.forbidden('Not authorized');
        }

        const { data, error } = await fastify.supabase
            .from('agents')
            .select('*, agent_desired_state(*), agent_actual_state(*)')
            .eq('project_id', projectId);

        if (error) throw error;
        return data;
    });

    // Create/Install agent in a project
    fastify.post('/project/:projectId', async (request, reply) => {
        const { projectId } = request.params as { projectId: string };
        const { name, configTemplate, templateId, framework } = CreateAgentSchema.parse(request.body);

        // Verify project ownership
        const { data: project, error: pError } = await fastify.supabase
            .from('projects')
            .select('id, user_id')
            .eq('id', projectId)
            .single();

        if (pError || !project) {
            fastify.log.error({ pError, projectId, userId: request.userId }, 'Project lookup failed in agent creation');
            throw fastify.httpErrors.notFound('Project not found');
        }

        if (project.user_id !== request.userId) {
            fastify.log.warn({
                projectId,
                actualOwner: project.user_id,
                requestingUser: request.userId
            }, 'Ownership violation: User tried to add agent to a project they do not own');
            throw fastify.httpErrors.forbidden('You do not own this project');
        }

        if (!request.userId) {
            fastify.log.error({ projectId }, 'userId missing in POST /agents/project/:projectId');
            return reply.unauthorized('User identity lost');
        }


        fastify.log.info({ userId: request.userId, projectId, name, framework }, 'Attempting to create agent');

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
        const tierLimit = TIER_CONFIG[userTier]?.maxAgents || TIER_CONFIG[UserTier.FREE].maxAgents;

        // 2. Count limits (Global count for user)
        // First get all project IDs for user
        const { data: userProjects, error: projError } = await fastify.supabase
            .from('projects')
            .select('id')
            .eq('user_id', request.userId);

        if (projError) throw projError;

        if (userProjects && userProjects.length > 0) {
            const projectIds = userProjects.map(p => p.id);
            const { count, error: countError } = await fastify.supabase
                .from('agents')
                .select('*', { count: 'exact', head: true })
                .in('project_id', projectIds);

            if (countError) throw countError;

            if (count !== null && count >= tierLimit) {
                throw fastify.httpErrors.forbidden(`Agent limit reached for ${userTier.toUpperCase()} tier (${tierLimit} agent${tierLimit === 1 ? '' : 's'})`);
            }
        }

        // 3. Create agent
        fastify.log.info({ projectId, name, framework }, 'Inserting new agent into database');
        const { data: agent, error: agentError } = await fastify.supabase
            .from('agents')
            .insert([{ project_id: projectId, name, framework: framework || 'eliza' }])
            .select()
            .single();

        if (agentError) throw agentError;

        // 4. Initialize desired state
        const initialConfig = configTemplate || (framework === 'openclaw' ? {
            auth: {
                profiles: {
                    default: { provider: 'anthropic', mode: 'api_key', token: '' }
                }
            },
            gateway: {
                auth: { mode: 'token', token: Buffer.from(Math.random().toString()).toString('base64').substring(0, 16) }
            },
            agents: {
                defaults: { workspace: '/home/node/.openclaw' }
            }
        } : {
            name,
            modelProvider: 'openai',
            bio: [`I am ${name}, a new AI agent.`],
            plugins: ['@elizaos/plugin-bootstrap']
        });

        const { metadata } = CreateAgentSchema.parse(request.body);

        const { error: stateError } = await fastify.supabase
            .from('agent_desired_state')
            .insert([{
                agent_id: agent.id,
                enabled: false,
                config: initialConfig,
                metadata: metadata || {}
            }]);

        if (stateError) throw stateError;

        // 3. Initialize actual state
        await fastify.supabase
            .from('agent_actual_state')
            .insert([{ agent_id: agent.id, status: 'stopped' }]);

        return reply.code(201).send(agent);
    });

    // Update agent configuration (desired state)
    fastify.patch('/:agentId/config', async (request) => {
        const { agentId } = request.params as { agentId: string };
        const { enabled, config, metadata, purge_at, name } = UpdateAgentConfigSchema.parse(request.body);

        // Verify agent ownership via project
        const { data: agent } = await fastify.supabase
            .from('agents')
            .select('project_id')
            .eq('id', agentId)
            .single();

        if (!agent) throw fastify.httpErrors.notFound('Agent not found');

        const { data: project } = await fastify.supabase
            .from('projects')
            .select('id')
            .eq('id', agent.project_id)
            .eq('user_id', request.userId)
            .single();

        if (!project) throw fastify.httpErrors.forbidden('Not authorized to modify this agent');

        const updates: any = { updated_at: new Date().toISOString() };
        if (enabled !== undefined) updates.enabled = enabled;
        if (config !== undefined) updates.config = config;
        if (metadata !== undefined) updates.metadata = metadata;
        if (purge_at !== undefined) {
            fastify.log.debug({ agentId, purge_at }, 'Processing purge_at update');
            updates.purge_at = purge_at;
        }

        if (name !== undefined) {
            fastify.log.info({ agentId, name }, 'Updating agent name in agents table');
            const { error: nameError } = await fastify.supabase
                .from('agents')
                .update({ name })
                .eq('id', agentId);
            if (nameError) {
                fastify.log.error({ nameError, agentId, name }, 'Failed to update agent name');
                throw nameError;
            }
        }

        fastify.log.debug({ agentId, updates }, 'Executing desired state update');

        const { data, error } = await fastify.supabase
            .from('agent_desired_state')
            .upsert({ agent_id: agentId, ...updates })
            .select()
            .single();

        if (error) throw error;
        return data;
    });

    // Chat: List conversations for an agent
    fastify.get('/:agentId/chat', async (request) => {
        const { agentId } = request.params as { agentId: string };

        // Verify agent ownership via project
        const { data: agent } = await fastify.supabase
            .from('agents')
            .select('project_id')
            .eq('id', agentId)
            .single();

        if (!agent) throw fastify.httpErrors.notFound('Agent not found');

        const { data: project } = await fastify.supabase
            .from('projects')
            .select('id')
            .eq('id', agent.project_id)
            .eq('user_id', request.userId)
            .single();

        if (!project) throw fastify.httpErrors.forbidden('Not authorized to access this agent');

        const { data, error } = await fastify.supabase
            .from('agent_conversations')
            .select('*')
            .eq('agent_id', agentId)
            .eq('user_id', request.userId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    });

    // Chat: Send a message to an agent
    fastify.post('/:agentId/chat', async (request, reply) => {
        const { agentId } = request.params as { agentId: string };
        const { content } = request.body as { content: string };

        // Verify agent ownership via project
        const { data: agent } = await fastify.supabase
            .from('agents')
            .select('project_id, framework')
            .eq('id', agentId)
            .single();

        if (!agent) throw fastify.httpErrors.notFound('Agent not found');

        const { data: project } = await fastify.supabase
            .from('projects')
            .select('id')
            .eq('id', agent.project_id)
            .eq('user_id', request.userId)
            .single();

        if (!project) throw fastify.httpErrors.forbidden('Not authorized to chat with this agent');

        // 1. Store user message
        const { data: userMsg, error: userMsgError } = await fastify.supabase
            .from('agent_conversations')
            .insert([{
                agent_id: agentId,
                user_id: request.userId,
                content,
                sender: 'user'
            }])
            .select()
            .single();

        if (userMsgError) throw userMsgError;

        // In the new Message Bus architecture, the backend only records the user message.
        // The worker (on the VPS) listens for this message in real-time, calls the agent,
        // and writes the response back to the database.
        return [userMsg];
    });
};

export default agentRoutes;
