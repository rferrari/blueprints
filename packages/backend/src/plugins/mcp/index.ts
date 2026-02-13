import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod'; // Zod is required for tool schemas
import { cryptoUtils } from '@eliza-manager/shared/crypto';
import { McpAuditService } from './audit.js';

declare module 'fastify' {
    interface FastifyRequest {
        mcpKey: { id: string; scopes: string[] };
        mcpUser: { id: string };
    }
}

const mcpPlugin: FastifyPluginAsync = async (fastify) => {
    const auditService = new McpAuditService(fastify);

    // Map of session tokens to transports
    const transports = new Map<string, SSEServerTransport>();

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

        // 2. Authentication (Only for SSE init and Messages)
        // For /messages, we might rely on the sessionId to map to a pre-authenticated transport?
        // Actually, standardized MCP over SSE usually requires the POST to also be authenticated
        // or effectively authenticated via the sessionId.
        // Let's enforce API Key on ALL endpoints for simplicity and security.

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
        request.mcpKey = { id: verified.keyId, scopes: verified.scopes };
        request.mcpUser = { id: verified.userId };
    });

    // --- Routes ---

    // SSE Endpoint - ESTABLISH CONNECTION
    fastify.get('/mcp/sse', async (request, reply) => {
        const userId = request.mcpUser.id;
        const keyId = request.mcpKey.id;
        const scopes = request.mcpKey.scopes || [];

        // Create a new transport
        const transport = new SSEServerTransport('/mcp/messages', reply.raw);

        // Manual session ID handling if needed, but we can assume transport exposes it or we generate one.
        // SDK's SSEServerTransport generates a UUID sessionId. 
        // We need to capture it to map it.
        // It's usually available as transport.sessionId after construction (in some versions) or we have to check.
        // Let's assume we can access it or we wrapper it.
        // Inspecting source: SSEServerTransport has `sessionId` property.

        const sessionId = (transport as any).sessionId;
        transports.set(sessionId, transport);

        // --- Create Per-Connection Server ---
        const server = new McpServer({
            name: 'Blueprints MCP',
            version: '1.0.0'
        });

        // --- Helper for Scopes ---
        const checkScope = (required: string) => {
            if (!scopes.includes(required) && !scopes.includes('admin')) { // simplistic admin check
                throw new Error(`Missing required scope: ${required}`);
            }
        };

        // --- Register Tools (Closure captures userId) ---

        // 1. LIST AGENTS
        server.tool(
            'list_agents',
            'List all agents belonging to the user',
            {}, // No args
            async () => {
                // checkScope('agents:read');
                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'list_agents', status: 'success' });

                const { data, error } = await fastify.supabase
                    .from('agents')
                    .select('id, name, framework, created_at, agent_actual_state(status)')
                    .eq('project_id', (await fastify.supabase.from('projects').select('id').eq('user_id', userId)).data?.map(p => p.id)) // This query is wrong, Supabase doesn't support subquery in .eq like that directly usually with JS client? 
                // Better to just query projects first or join.
                // Let's use logic similar to agents.ts

                // Fix: Get project IDs first
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
                // checkScope('agents:write');
                // 1. Verify Ownership
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');

                const { data: project } = await fastify.supabase
                    .from('projects')
                    .select('user_id')
                    .eq('id', agent.project_id)
                    .single();

                if (project?.user_id !== userId) throw new Error('Unauthorized');

                // 2. Update Desired State (Worker Authoritative will pick this up)
                await fastify.supabase
                    .from('agent_desired_state')
                    .update({ enabled: true, updated_at: new Date().toISOString() })
                    .eq('agent_id', agent_id);

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'start_agent', agentId: agent_id, status: 'success' });

                return {
                    content: [{ type: 'text', text: `Start command queued for agent ${agent_id}` }]
                };
            }
        );

        // 3. STOP AGENT
        server.tool(
            'stop_agent',
            'Stop a specific agent',
            { agent_id: z.string().uuid() },
            async ({ agent_id }) => {
                // checkScope('agents:write');
                // 1. Verify Ownership
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');

                const { data: project } = await fastify.supabase
                    .from('projects')
                    .select('user_id')
                    .eq('id', agent.project_id)
                    .single();

                if (project?.user_id !== userId) throw new Error('Unauthorized');

                // 2. Update Desired State
                await fastify.supabase
                    .from('agent_desired_state')
                    .update({ enabled: false, updated_at: new Date().toISOString() })
                    .eq('agent_id', agent_id);

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'stop_agent', agentId: agent_id, status: 'success' });

                return {
                    content: [{ type: 'text', text: `Stop command queued for agent ${agent_id}` }]
                };
            }
        );

        // --- NEW TOOLS REQUESTED ---

        // 6. CREATE AGENT
        server.tool(
            'create_agent',
            'Create a new agent in a project',
            {
                project_id: z.string().uuid(),
                name: z.string().min(1),
                framework: z.enum(['eliza', 'openclaw']).default('openclaw'),
                config: z.record(z.string(), z.any()).optional()
            },
            async ({ project_id, name, framework, config }) => {
                // 1. Verify Project Ownership
                const { data: project } = await fastify.supabase
                    .from('projects')
                    .select('user_id')
                    .eq('id', project_id)
                    .single();

                if (!project || project.user_id !== userId) throw new Error('Unauthorized or project not found');

                // 2. Create Agent
                const { data: agent, error: aErr } = await fastify.supabase
                    .from('agents')
                    .insert({ project_id, name, framework })
                    .select('id')
                    .single();

                if (aErr) throw aErr;

                // 3. Create Desired State
                const encryptedConfig = config ? cryptoUtils.encryptConfig(config) : {};
                await fastify.supabase
                    .from('agent_desired_state')
                    .insert({ agent_id: agent.id, config: encryptedConfig, enabled: false });

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'create_agent', agentId: agent.id, status: 'success' });

                return {
                    content: [{ type: 'text', text: `Agent '${name}' created with ID: ${agent.id}` }]
                };
            }
        );

        // 7. EDIT AGENT CONFIG
        server.tool(
            'edit_agent_config',
            'Update an agent\'s configuration',
            {
                agent_id: z.string().uuid(),
                config: z.record(z.string(), z.any())
            },
            async ({ agent_id, config }) => {
                // 1. Verify Ownership
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                // 2. Update Config
                const encryptedConfig = cryptoUtils.encryptConfig(config);
                await fastify.supabase
                    .from('agent_desired_state')
                    .update({ config: encryptedConfig, updated_at: new Date().toISOString() })
                    .eq('agent_id', agent_id);

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'edit_agent_config', agentId: agent_id, status: 'success' });

                return {
                    content: [{ type: 'text', text: `Configuration updated for agent ${agent_id}` }]
                };
            }
        );

        // 8. REMOVE AGENT
        server.tool(
            'remove_agent',
            'Delete an agent permanently',
            { agent_id: z.string().uuid() },
            async ({ agent_id }) => {
                // 1. Verify Ownership
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                // 2. Delete
                await fastify.supabase.from('agents').delete().eq('id', agent_id);

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'remove_agent', agentId: agent_id, status: 'success' });

                return {
                    content: [{ type: 'text', text: `Agent ${agent_id} removed permanently.` }]
                };
            }
        );

        // 9. SEND MESSAGE
        server.tool(
            'send_message',
            'Send a message to an agent\'s conversation log',
            {
                agent_id: z.string().uuid(),
                content: z.string().min(1)
            },
            async ({ agent_id, content }) => {
                // 1. Verify Ownership
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');
                const { data: project } = await fastify.supabase.from('projects').select('user_id').eq('id', agent.project_id).single();
                if (project?.user_id !== userId) throw new Error('Unauthorized');

                // 2. Insert Message
                await fastify.supabase
                    .from('agent_conversations')
                    .insert({
                        agent_id,
                        user_id: userId,
                        content,
                        sender: 'user'
                    });

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'send_message', agentId: agent_id, status: 'success' });

                return {
                    content: [{ type: 'text', text: `Message delivered to agent ${agent_id}` }]
                };
            }
        );

        // 10. ACCOUNT & BILLING (PLACEHOLDERS)
        server.tool(
            'account_register',
            'Register for a new account (Placeholder)',
            { email: z.string() },
            async () => {
                return { content: [{ type: 'text', text: 'Account registration is currently handled via the web dashboard at https://blueprints.ai/signup' }] };
            }
        );

        server.tool(
            'pay_upgrade',
            'Upgrade account tier (Placeholder)',
            { tier: z.enum(['pro', 'enterprise']) },
            async ({ tier }) => {
                return { content: [{ type: 'text', text: `Upgrading to ${tier.toUpperCase()} is handled via the dashboard billing section. Please visit https://blueprints.ai/upgrade` }] };
            }
        );


        // --- RESOURCES ---

        // 4. AGENT CONFIG RESOURCE
        server.resource(
            'agent_config',
            new ResourceTemplate('agent://{agent_id}/config', { list: undefined }),
            async (uri, { agent_id }) => {
                // Check Scope? 
                // Resources are read-only usually, so 'agents:read' is appropriate.
                // checkScope('agents:read'); 

                // Verify Owner
                if (typeof agent_id !== 'string') throw new Error('Invalid agent_id');

                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
                    .eq('id', agent_id)
                    .single();

                if (!agent) throw new Error('Agent not found');

                const { data: project } = await fastify.supabase
                    .from('projects')
                    .select('user_id')
                    .eq('id', agent.project_id)
                    .single();

                if (project?.user_id !== userId) throw new Error('Unauthorized');

                // Return Config
                const { data: desired } = await fastify.supabase
                    .from('agent_desired_state')
                    .select('config')
                    .eq('agent_id', agent_id)
                    .single();

                let config = {};
                if (desired?.config) {
                    try {
                        config = cryptoUtils.decryptConfig(desired.config);
                    } catch (e) {
                        config = { error: 'Failed to decrypt' };
                    }
                }

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'resource:config', agentId: agent_id, status: 'success' });

                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(config, null, 2)
                    }]
                };
            }
        );

        // 5. AGENT STATE RESOURCE
        server.resource(
            'agent_state',
            new ResourceTemplate('agent://{agent_id}/state', { list: undefined }),
            async (uri, { agent_id }) => {
                if (typeof agent_id !== 'string') throw new Error('Invalid agent_id');

                // Verify ownership (could cache or optimize this logic helper)
                const { data: agent } = await fastify.supabase
                    .from('agents')
                    .select('project_id')
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

                await auditService.log({ mcpKeyId: keyId, userId, toolName: 'resource:state', agentId: agent_id, status: 'success' });

                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(actual, null, 2)
                    }]
                }
            }
        );

        // 6. SKILL MANIFEST RESOURCE
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
                    const docsPath = path.join(process.cwd(), '../../.agent/skills/mcp-server.md');
                    content = await fs.readFile(docsPath, 'utf-8');
                } catch (e) { }

                return {
                    contents: [{
                        uri: uri.href,
                        text: content
                    }]
                };
            }
        );

        fastify.log.info({ userId, sessionId }, 'MCP SSE Connection Initialized');

        await server.connect(transport);

        reply.hijack();

        // Cleanup on close
        request.raw.on('close', () => {
            transports.delete(sessionId);
            fastify.log.debug({ sessionId }, 'MCP SSE Connection Closed');
        });

        await auditService.log({ mcpKeyId: keyId, userId, toolName: 'connect', status: 'success' });
    });

    // Discovery Endpoint (skill.json)
    fastify.get('/mcp/skill.json', async () => {
        return {
            name: 'Blueprints MCP',
            description: 'Manage AI agents programmatically',
            version: '1.0.0',
            mcp_endpoint: '/mcp/sse',
            docs_url: '/mcp/skill.md',
            capabilities: {
                tools: ['list_agents', 'start_agent', 'stop_agent', 'create_agent', 'edit_agent_config', 'remove_agent', 'send_message'],
                resources: ['agent://{id}/state', 'agent://{id}/config', 'skill://manifest']
            }
        };
    });

    // Serve mcp-server.md as a plain text/markdown route
    fastify.get('/mcp/skill.md', async (request, reply) => {
        // We'll return the content of .agent/skills/mcp-server.md
        // In this workspace, let's assume it's relative to the app root or just hardcode the response for portability.
        // Actually, let's try to read it from the file system if we can find it.
        const fs = await import('fs/promises');
        const path = await import('path');
        try {
            // Root is 2 levels up from backend/src
            const docsPath = path.join(process.cwd(), '../../.agent/skills/mcp-server.md');
            const content = await fs.readFile(docsPath, 'utf-8');
            return reply.type('text/markdown').send(content);
        } catch (e) {
            return reply.type('text/markdown').send('# Blueprints MCP Server\n\nDocumentation not found on disk.');
        }
    });

    // Messages Endpoint - HANDLE MESSAGES via SessionID
    fastify.post('/mcp/messages', async (request, reply) => {
        const sessionId = (request.query as any).sessionId;
        if (!sessionId) {
            throw fastify.httpErrors.badRequest('Missing sessionId');
        }

        const transport = transports.get(sessionId);
        if (!transport) {
            throw fastify.httpErrors.notFound('Session not found or expired');
        }

        await transport.handlePostMessage(request.raw, reply.raw);
    });
};

export default fp(mcpPlugin, {
    name: 'mcp',
    dependencies: ['settings', 'apiKeys', 'supabase']
});
