import { FastifyPluginAsync } from 'fastify';
import { UpdateAgentConfigSchema } from '@eliza-manager/shared';

const agentRoutes: FastifyPluginAsync = async (fastify) => {

    // List agents for a project
    fastify.get('/project/:projectId', async (request) => {
        const { projectId } = request.params as { projectId: string };
        fastify.log.info({ userId: request.userId, projectId }, 'Attempting to fetch agents for project');

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
        const { name, configTemplate, templateId } = request.body as { name: string, configTemplate?: any, templateId?: string };

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

        fastify.log.info({ userId: request.userId, projectId, name }, 'Attempting to create agent');

        // Check agent limits
        const { count } = await fastify.supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId);

        const limit = 1; // Default to 1 agent limit as 'tier' column is missing
        if (count !== null && count >= limit) {
            throw fastify.httpErrors.forbidden(`Agent limit reached for FREE tier (${limit} agent${limit === 1 ? '' : 's'})`);
        }

        // 1. Create agent
        fastify.log.info({ projectId, name }, 'Inserting new agent into database');
        const { data: agent, error: agentError } = await fastify.supabase
            .from('agents')
            .insert([{ project_id: projectId, name }])
            .select()
            .single();

        if (agentError) throw agentError;

        // 2. Initialize desired state
        const initialConfig = configTemplate || {
            name,
            modelProvider: 'openai',
            bio: [`I am ${name}, a new AI agent.`],
            plugins: ['@elizaos/plugin-bootstrap']
        };

        const { error: stateError } = await fastify.supabase
            .from('agent_desired_state')
            .insert([{
                agent_id: agent.id,
                enabled: false,
                config: initialConfig
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
        const { enabled, config, purge_at } = UpdateAgentConfigSchema.parse(request.body);

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
        if (purge_at !== undefined) {
            fastify.log.info({ agentId, purge_at }, 'Processing purge_at update');
            updates.purge_at = purge_at;
        }

        fastify.log.info({ agentId, updates }, 'Executing desired state update');

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

        // 2. Here we would typically proxy to the Actual Runtime
        // For now, we simulate an agent response
        const { data: agentMsg, error: agentMsgError } = await fastify.supabase
            .from('agent_conversations')
            .insert([{
                agent_id: agentId,
                user_id: request.userId,
                content: `Response from agent regarding: ${content}`,
                sender: 'agent'
            }])
            .select()
            .single();

        if (agentMsgError) throw agentMsgError;

        return [userMsg, agentMsg];
    });
};

export default agentRoutes;
