import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod'; // Zod is required for tool schemas
import { cryptoUtils } from '@eliza-manager/shared/crypto';
import { McpAuditService } from './audit.js';
import crypto from 'node:crypto';

declare module 'fastify' {
    interface FastifyRequest {
        mcpKey: { id: string; scopes: string[] };
        mcpUser: { id: string; tier: string };
    }
}

import { generateClusterName } from '@eliza-manager/shared';

const mcpPlugin: FastifyPluginAsync = async (fastify) => {
    const auditService = new McpAuditService(fastify);

    // Map of session tokens to transports
    const transports = new Map<string, StreamableHTTPServerTransport>();

    // 0. Disable body parsing for MCP messages to allow SDK to handle stream
    fastify.addHook('preParsing', async (request, reply, payload) => {
        if (request.url.startsWith('/mcp/messages')) {
            request.headers['content-type'] = 'application/x-mcp-json';
        }
        return payload;
    });

    fastify.addContentTypeParser('application/x-mcp-json', (request, payload, done) => {
        // Just pass through the raw stream
        done(null, payload);
    });

    // Middleware guard
    fastify.addHook('preHandler', async (request, reply) => {
        if (!request.url.startsWith('/mcp/')) return;

        // Exempt discovery routes
        if (request.url === '/mcp/skill.json' || request.url === '/mcp/skill.md') return;

        // 1. System Kill Switch
        const enabled = await fastify.settings.isMcpEnabled();
        if (!enabled) {
            fastify.log.warn('Blocking MCP request: System disabled');
            throw fastify.httpErrors.serviceUnavailable('MCP is currently disabled');
        }

        // 2. Authentication
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer bp_sk_')) {
            throw fastify.httpErrors.unauthorized('Missing or invalid MCP API Key');
        }

        const key = authHeader.replace('Bearer ', '');
        const verified = await fastify.apiKeys.verify(key);

        if (!verified) {
            await auditService.log({
                mcpKeyId: 'unknown',
                userId: 'unknown',
                toolName: 'auth',
                status: 'failure',
                errorCode: 'MCP_UNAUTHORIZED'
            });
            throw fastify.httpErrors.unauthorized('Invalid or expired API Key');
        }

        // 3. Attach Context
        const { data: profile } = await fastify.supabase
            .from('profiles')
            .select('tier')
            .eq('id', verified.userId)
            .single();

        request.mcpKey = { id: verified.keyId, scopes: verified.scopes };
        request.mcpUser = { id: verified.userId, tier: profile?.tier || 'free' };
    });

    // --- Helper for Per-Session Server Setup ---
    const setupMcpServer = (request: FastifyRequest, transport: StreamableHTTPServerTransport) => {
        const userId = request.mcpUser.id;
        const userTier = request.mcpUser.tier;
        const keyId = request.mcpKey.id;
        const scopes = request.mcpKey.scopes || [];

        const server = new McpServer({
            name: 'Blueprints MCP',
            version: '1.0.0'
        });

        const checkAccess = (toolName: string) => {
            if (userTier === 'free' && !['account_register', 'pay_upgrade'].includes(toolName)) {
                throw new Error('Upgrade Required: Programmable MCP access is a Pro feature. Please visit https://blueprints-backend.onrender.com/upgrade to unlock high-scale automation.');
            }
        };

        const checkScope = (required: string) => {
            if (!scopes.includes(required) && !scopes.includes('admin')) {
                throw new Error(`Missing required scope: ${required}`);
            }
        };

        // --- Register Tools ---

        // 1. LIST AGENTS
        server.tool(
            'list_agents',
            'List all agents belonging to the user',
            {},
            async () => {
                checkAccess('list_agents');
                checkScope('read');
                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'list_agents', status: 'success' });

                const { data: projects } = await fastify.supabase.from('projects').select('id').eq('user_id', userId);
                if (!projects?.length) return { content: [{ type: 'text', text: JSON.stringify([]) }] };

                const pIds = projects.map(p => p.id);
                const { data: agents } = await fastify.supabase
                    .from('agents')
                    .select('*, agent_actual_state(status)')
                    .in('project_id', pIds);

                return {
                    content: [{ type: 'text', text: JSON.stringify(agents, null, 2) }]
                };
            }
        );

        // 2. START AGENT
        server.tool(
            'start_agent',
            'Start a specific agent',
            { agent_id: z.string().uuid() },
            async ({ agent_id }) => {
                checkAccess('start_agent');
                checkScope('execute');
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                await fastify.supabase
                    .from('agent_desired_state')
                    .update({ enabled: true, updated_at: new Date().toISOString() })
                    .eq('agent_id', agent_id);

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'start_agent', agentId: agent_id, status: 'success' });
                return { content: [{ type: 'text', text: `Start command queued for agent ${agent_id}` }] };
            }
        );

        // 3. STOP AGENT
        server.tool(
            'stop_agent',
            'Stop a specific agent',
            { agent_id: z.string().uuid() },
            async ({ agent_id }) => {
                checkAccess('stop_agent');
                checkScope('execute');
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                await fastify.supabase
                    .from('agent_desired_state')
                    .update({ enabled: false, updated_at: new Date().toISOString() })
                    .eq('agent_id', agent_id);

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'stop_agent', agentId: agent_id, status: 'success' });
                return { content: [{ type: 'text', text: `Stop command queued for agent ${agent_id}` }] };
            }
        );

        // 4. CREATE AGENT
        server.tool(
            'create_agent',
            'Create a new agent in a project',
            {
                project_id: z.string().uuid().optional(),
                name: z.string().min(1),
                framework: z.enum(['eliza', 'openclaw']).default('openclaw'),
                config: z.record(z.string(), z.any()).optional()
            },
            async ({ project_id, name, framework, config }) => {
                checkAccess('create_agent');
                checkScope('write');
                let targetProjectId = project_id;

                if (!targetProjectId) {
                    const { data: projects } = await fastify.supabase
                        .from('projects')
                        .select('id')
                        .eq('user_id', userId)
                        .limit(1);

                    if (projects && projects.length > 0) {
                        targetProjectId = projects[0].id;
                    } else {
                        const clusterName = generateClusterName();
                        const { data: newProject, error: pErr } = await fastify.supabase
                            .from('projects')
                            .insert({ name: clusterName, user_id: userId })
                            .select('id')
                            .single();

                        if (pErr) throw pErr;
                        targetProjectId = newProject.id;
                    }
                }

                const { data: project } = await fastify.supabase
                    .from('projects')
                    .select('user_id')
                    .eq('id', targetProjectId)
                    .single();

                if (!project || project.user_id !== userId) throw new Error('Unauthorized or project not found');

                const { data: agent, error: aErr } = await fastify.supabase
                    .from('agents')
                    .insert({ project_id: targetProjectId, name, framework })
                    .select('id')
                    .single();

                if (aErr) throw aErr;

                const encryptedConfig = config ? cryptoUtils.encryptConfig(config) : {};
                await fastify.supabase
                    .from('agent_desired_state')
                    .insert({ agent_id: agent.id, config: encryptedConfig, enabled: false });

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'create_agent', agentId: agent.id, status: 'success' });
                return { content: [{ type: 'text', text: `Agent '${name}' created in project '${targetProjectId}' with ID: ${agent.id}` }] };
            }
        );

        // 5. AGENT STATUS
        server.tool(
            'agent_status',
            'Get detailed status and health information for an agent',
            { agent_id: z.string().uuid() },
            async ({ agent_id }) => {
                checkAccess('agent_status');
                checkScope('read');
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id, name')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                const { data: actual } = await fastify.supabase
                    .from('agent_actual_state')
                    .select('*')
                    .eq('agent_id', agent_id)
                    .single();

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'agent_status', agentId: agent_id, status: 'success' });
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            name: agent.name,
                            id: agent_id,
                            status: actual?.status || 'unknown',
                            last_sync: actual?.last_sync,
                            stats: actual?.stats,
                            error_message: actual?.error_message
                        }, null, 2)
                    }]
                };
            }
        );

        // 6. EDIT AGENT CONFIG
        server.tool(
            'edit_agent_config',
            'Update an agent\'s configuration',
            {
                agent_id: z.string().uuid(),
                config: z.record(z.string(), z.any())
            },
            async ({ agent_id, config }) => {
                checkAccess('edit_agent_config');
                checkScope('write');
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                const encryptedConfig = cryptoUtils.encryptConfig(config);
                await fastify.supabase
                    .from('agent_desired_state')
                    .update({ config: encryptedConfig, updated_at: new Date().toISOString() })
                    .eq('agent_id', agent_id);

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'edit_agent_config', agentId: agent_id, status: 'success' });
                return { content: [{ type: 'text', text: `Configuration updated for agent ${agent_id}` }] };
            }
        );

        // 7. REMOVE AGENT
        server.tool(
            'remove_agent',
            'Delete an agent permanently',
            { agent_id: z.string().uuid() },
            async ({ agent_id }) => {
                checkAccess('remove_agent');
                checkScope('write');
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                await fastify.supabase.from('agents').delete().eq('id', agent_id);
                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'remove_agent', agentId: agent_id, status: 'success' });
                return { content: [{ type: 'text', text: `Agent ${agent_id} removed permanently.` }] };
            }
        );

        // 8. SEND MESSAGE
        server.tool(
            'send_message',
            'Send a message to an agent\'s conversation log',
            {
                agent_id: z.string().uuid(),
                content: z.string().min(1)
            },
            async ({ agent_id, content }) => {
                checkAccess('send_message');
                checkScope('write');

                // Terminal guard: prevent /terminal usage in chat if missing execute/terminal scope
                if (content.startsWith('/terminal')) {
                    checkScope('terminal');
                }

                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                await fastify.supabase
                    .from('agent_conversations')
                    .insert({ agent_id, user_id: userId, content, sender: 'user' });

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'send_message', agentId: agent_id, status: 'success' });
                return { content: [{ type: 'text', text: `Message delivered to agent ${agent_id}` }] };
            }
        );

        // 9. SEND TERMINAL COMMAND
        server.tool(
            'send_terminal',
            'Execute a command in the agent container terminal',
            {
                agent_id: z.string().uuid(),
                command: z.string().min(1)
            },
            async ({ agent_id, command }) => {
                checkAccess('send_terminal');
                checkScope('terminal');

                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                // We execute by posting a /terminal message to agent_conversations,
                // which is then picked up by the worker's message bus.
                await fastify.supabase
                    .from('agent_conversations')
                    .insert({ agent_id, user_id: userId, content: `/terminal ${command}`, sender: 'user' });

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'send_terminal', agentId: agent_id, status: 'success' });
                return { content: [{ type: 'text', text: `Command '$ ${command}' queued for agent ${agent_id}` }] };
            }
        );

        // 10. ACCOUNT & BILLING
        server.tool(
            'account_register',
            'Register for a new account (Placeholder)',
            { email: z.string() },
            async () => {
                return { content: [{ type: 'text', text: 'Account registration is currently handled via the web dashboard at https://blueprints-backend.onrender.com/signup' }] };
            }
        );

        server.tool(
            'pay_upgrade',
            'Upgrade account tier (Placeholder)',
            { tier: z.enum(['pro', 'enterprise']) },
            async ({ tier }) => {
                return { content: [{ type: 'text', text: `Upgrading to ${tier.toUpperCase()} is handled via the dashboard billing section. Please visit https://blueprints-backend.onrender.com/upgrade` }] };
            }
        );

        // --- RESOURCES ---

        server.resource(
            'agent_config',
            new ResourceTemplate('agent://{agent_id}/config', { list: undefined }),
            async (uri, { agent_id }) => {
                if (typeof agent_id !== 'string') throw new Error('Invalid agent_id');
                const { data: agent } = await fastify.supabase.from('agents').select('project_id').eq('id', agent_id).single();
                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                const { data: desired } = await fastify.supabase.from('agent_desired_state').select('config').eq('agent_id', agent_id).single();
                let config = {};
                if (desired?.config) {
                    try { config = cryptoUtils.decryptConfig(desired.config); } catch (e) { config = { error: 'Failed to decrypt' }; }
                }
                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'resource:config', agentId: agent_id, status: 'success' });
                return { contents: [{ uri: uri.href, text: JSON.stringify(config, null, 2) }] };
            }
        );

        server.resource(
            'agent_state',
            new ResourceTemplate('agent://{agent_id}/state', { list: undefined }),
            async (uri, { agent_id }) => {
                if (typeof agent_id !== 'string') throw new Error('Invalid agent_id');
                const { data: agent } = await fastify.supabase.from('agents').select('project_id').eq('id', agent_id).single();
                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                const { data: actual } = await fastify.supabase.from('agent_actual_state').select('*').eq('agent_id', agent_id).single();
                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'resource:state', agentId: agent_id, status: 'success' });
                return { contents: [{ uri: uri.href, text: JSON.stringify(actual, null, 2) }] };
            }
        );

        server.resource(
            'skill_manifest',
            'mcp://skill',
            async (uri) => {
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({
                            name: 'Blueprints MCP',
                            docs: 'agent://skill/docs',
                            manifest_url: '/mcp/skill.json'
                        }, null, 2)
                    }]
                };
            }
        );

        server.resource(
            'skill_docs',
            'agent://skill/docs',
            async (uri) => {
                const fs = await import('fs/promises');
                const path = await import('path');
                let content = '# Docs';
                try {
                    const docsPath = path.join(process.cwd(), '../../docs/skills/mcp-server.md');
                    content = await fs.readFile(docsPath, 'utf-8');
                } catch (e) { }
                return { contents: [{ uri: uri.href, text: content }] };
            }
        );

        return server;
    };

    // --- Routes ---

    // Discovery Endpoint (skill.json)
    fastify.get('/mcp/skill.json', async () => {
        return {
            name: 'Blueprints MCP',
            description: 'Manage AI agents programmatically',
            version: '1.0.0',
            docs_url: '/mcp/skill.md',
            capabilities: {
                tools: ['list_agents', 'start_agent', 'stop_agent', 'create_agent', 'edit_agent_config', 'remove_agent', 'send_message', 'agent_status'],
                resources: ['agent://{id}/state', 'agent://{id}/config', 'skill://manifest']
            }
        };
    });

    // Serve mcp-server.md
    fastify.get('/mcp/skill.md', async (request, reply) => {
        const fs = await import('fs/promises');
        const path = await import('path');
        try {
            const docsPath = path.join(process.cwd(), '../../docs/skills/mcp-server.md');
            let content = await fs.readFile(docsPath, 'utf-8');

            // Dynamic URL substitution
            const protocol = request.headers['x-forwarded-proto'] || 'http';
            const host = request.headers.host || 'localhost:4000';
            const baseUrl = `${protocol}://${host}`;
            content = content.replace(/\$\{BASE_URL\}/g, baseUrl);

            return reply.type('text/markdown').send(content);
        } catch (e) {
            return reply.type('text/markdown').send('# Blueprints MCP Server\n\nDocumentation not found on disk.');
        }
    });

    // Messages Endpoint - Initialization and Tool Calls
    fastify.post('/mcp/messages', async (request, reply) => {
        const sessionId = (request.query as any).sessionId;
        let transport: StreamableHTTPServerTransport | undefined;

        if (sessionId) {
            transport = transports.get(sessionId);
            if (!transport) {
                throw fastify.httpErrors.notFound('Session not found or expired');
            }
        } else {
            // No sessionId provided -> Assume Initialization attempt
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => crypto.randomUUID(),
                enableJsonResponse: true // Allow returning tool results directly in POST response
            });

            const server = setupMcpServer(request, transport);
            await server.connect(transport);
            // sessionId will be generated during handleRequest if the payload is an 'initialize' request
        }

        // Delegate handling to transport
        await transport.handleRequest(request.raw, reply.raw);

        // If this was a successful initialization, store the transport
        if (!sessionId && transport.sessionId) {
            transports.set(transport.sessionId, transport);
            fastify.log.info({ sessionId: transport.sessionId }, 'New MCP Session Initialized');

            // Log successful connect audit
            await auditService.log({
                mcpKeyId: request.mcpKey.id,
                userId: request.mcpUser.id,
                toolName: 'initialize',
                status: 'success'
            });
        }
    });
};

export default fp(mcpPlugin, {
    name: 'mcp',
    dependencies: ['settings', 'apiKeys', 'supabase']
});
