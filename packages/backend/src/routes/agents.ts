import { FastifyPluginAsync } from 'fastify';
import { UpdateAgentConfigSchema, CreateAgentSchema, UserTier, TIER_CONFIG } from '@eliza-manager/shared';
import { cryptoUtils } from '@eliza-manager/shared/crypto';

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

    // Get single agent
    fastify.get('/:agentId', async (request) => {
        const { agentId } = request.params as { agentId: string };

        // Verify agent ownership via project
        const { data: agent, error: aError } = await fastify.supabase
            .from('agents')
            .select('*, agent_desired_state(*), agent_actual_state(*)')
            .eq('id', agentId)
            .single();

        if (aError || !agent) {
            throw fastify.httpErrors.notFound('Agent not found');
        }

        const { data: project } = await fastify.supabase
            .from('projects')
            .select('id')
            .eq('id', agent.project_id)
            .eq('user_id', request.userId)
            .single();

        if (!project) {
            throw fastify.httpErrors.forbidden('Not authorized');
        }

        return agent;
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
            .insert([{ project_id: projectId, name, framework: framework || 'elizaos' }])
            .select()
            .single();

        if (agentError) throw agentError;

        // 4. Initialize desired state
        let initialConfig: any = configTemplate;

        if (!initialConfig) {
            if (framework === 'openclaw') {
                initialConfig = {
                    auth: {
                        profiles: {
                            default: { provider: 'venice', mode: 'api_key' }
                        }
                    },
                    agents: {
                        defaults: {
                            model: {
                                primary: "venice/llama-3.3-70b"
                            },
                            models: {
                                "venice/llama-3.3-70b": {}
                            },
                            workspace: "/home/node/.openclaw/workspace"
                        }
                    },
                    models: {
                        providers: {
                            venice: {
                                apiKey: "",
                                models: [
                                    {
                                        id: "llama-3.3-70b",
                                        api: "openai-completions",
                                        name: "llama-3.3-70b",
                                        compat: {}
                                    }
                                ],
                                baseUrl: "https://api.venice.ai/api/v1"
                            }
                        }
                    },
                    channels: {}
                };
            } else if (framework === 'picoclaw') {
                initialConfig = {
                    agents: {
                        defaults: {
                            workspace: "~/.picoclaw/workspace",
                            restrict_to_workspace: true,
                            model: "glm-4.7",
                            max_tokens: 8192,
                            temperature: 0.7,
                            max_tool_iterations: 20
                        }
                    },
                    channels: {
                        telegram: { enabled: false, token: "YOUR_TELEGRAM_BOT_TOKEN", proxy: "", allow_from: ["YOUR_USER_ID"] },
                        discord: { enabled: false, token: "YOUR_DISCORD_BOT_TOKEN", allow_from: [] },
                        maixcam: { enabled: false, host: "0.0.0.0", port: 18790, allow_from: [] },
                        whatsapp: { enabled: false, bridge_url: "ws://localhost:3001", allow_from: [] },
                        feishu: { enabled: false, app_id: "", app_secret: "", encrypt_key: "", verification_token: "", allow_from: [] },
                        dingtalk: { enabled: false, client_id: "YOUR_CLIENT_ID", client_secret: "YOUR_CLIENT_SECRET", allow_from: [] },
                        slack: { enabled: false, bot_token: "xoxb-YOUR-BOT-TOKEN", app_token: "xapp-YOUR-APP-TOKEN", allow_from: [] },
                        line: { enabled: false, channel_secret: "YOUR_LINE_CHANNEL_SECRET", channel_access_token: "YOUR_LINE_CHANNEL_ACCESS_TOKEN", webhook_host: "0.0.0.0", webhook_port: 18791, webhook_path: "/webhook/line", allow_from: [] }
                    },
                    providers: {
                        anthropic: { api_key: "", api_base: "" },
                        openai: { api_key: "", api_base: "" },
                        openrouter: { api_key: "sk-or-v1-xxx", api_base: "" },
                        groq: { api_key: "gsk_xxx", api_base: "" },
                        zhipu: { api_key: "YOUR_ZHIPU_API_KEY", api_base: "" },
                        gemini: { api_key: "", api_base: "" },
                        vllm: { api_key: "", api_base: "" },
                        nvidia: { api_key: "nvapi-xxx", api_base: "", proxy: "http://127.0.0.1:7890" },
                        moonshot: { api_key: "sk-xxx", api_base: "" }
                    },
                    tools: {
                        web: { search: { api_key: "YOUR_BRAVE_API_KEY", max_results: 5 } }
                    },
                    heartbeat: { enabled: false, interval: 30 },
                    gateway: { host: "0.0.0.0", port: 18790 }
                };
            } else {
                initialConfig = {
                    name,
                    modelProvider: 'openai',
                    bio: [`I am ${name}, a new AI agent.`],
                    plugins: [
                        '@elizaos/plugin-bootstrap',
                        '@elizaos/plugin-openai',
                    ]
                };
            }
        }

        // Force gateway block for OpenClaw even if provided by blueprint/configTemplate
        if (framework === 'openclaw') {
            if (!initialConfig.gateway) {
                initialConfig.gateway = {
                    mode: "local",
                    bind: "lan",
                    http: {
                        endpoints: {
                            chatCompletions: { enabled: true }
                        }
                    }
                };
            }
            if (!initialConfig.gateway.auth) {
                initialConfig.gateway.auth = { mode: 'token' };
            }

            const gwAuth = initialConfig.gateway.auth;
            // Ensure token is generated or updated if placeholder
            if (!gwAuth.token || gwAuth.token === 'auto-generated-on-creation') {
                gwAuth.token = Buffer.from(Math.random().toString()).toString('base64').substring(0, 16);
            }
        }

        const { metadata } = CreateAgentSchema.parse(request.body);

        const { error: stateError } = await fastify.supabase
            .from('agent_desired_state')
            .insert([{
                agent_id: agent.id,
                enabled: false,
                config: cryptoUtils.encryptConfig(initialConfig),
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
        if (config !== undefined && config !== null) {
            fastify.log.info({ agentId }, 'Updating agent config');
            updates.config = cryptoUtils.encryptConfig(config);
        }
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
