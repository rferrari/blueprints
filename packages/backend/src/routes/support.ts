import { FastifyPluginAsync } from 'fastify';
import { CreateSupportSessionSchema, SupportMessageSchema } from '@eliza-manager/shared';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const supportRoutes: FastifyPluginAsync = async (fastify) => {
    // 1. Session Initialization
    fastify.post('/session', async (request, reply) => {
        const { user_agent } = request.body as { user_agent?: string };
        const ip = request.ip;
        const ip_hash = crypto.createHash('sha256').update(ip).digest('hex');

        const sessionId = uuidv4();

        const { data, error } = await fastify.supabase
            .from('support_sessions')
            .insert([{
                id: sessionId,
                user_id: request.userId || null,
                ip_hash,
                user_agent,
            }])
            .select()
            .single();

        if (error) {
            fastify.log.error(error, 'Failed to create support session');
            throw error;
        }

        return { sessionId: data.id };
    });

    // 2. Chat Proxy
    fastify.post('/chat', async (request, reply) => {
        const { session_id, content, sequence } = SupportMessageSchema.parse(request.body);

        // A. Verify Session
        const { data: session, error: sError } = await fastify.supabase
            .from('support_sessions')
            .select('id')
            .eq('id', session_id)
            .single();

        if (sError || !session) {
            throw fastify.httpErrors.notFound('Session not found or expired');
        }

        // B. Get Assigned Support Agent
        const { data: setting, error: setError } = await fastify.supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'support_agent_id')
            .single();

        const supportAgentId = setting?.value?.agent_id;

        if (!supportAgentId) {
            return reply.status(503).send({
                error: 'Service Unavailable',
                message: 'No support agent is currently assigned. Please try again later.'
            });
        }

        // C. Record User Message
        const { data: userMsg, error: userMsgError } = await fastify.supabase
            .from('support_conversations')
            .insert([{
                session_id,
                sequence,
                agent_id: supportAgentId,
                content,
                sender: 'user'
            }])
            .select()
            .single();

        if (userMsgError) {
            if (userMsgError.code === '23505') { // Unique constraint violation on (session_id, sequence)
                throw fastify.httpErrors.conflict('Message sequence out of sync');
            }
            throw userMsgError;
        }

        // D. Update Last Seen
        await fastify.supabase
            .from('support_sessions')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', session_id);

        // E. Check Agent Online Status
        const { data: agentStatus } = await fastify.supabase
            .from('agent_actual_state')
            .select('status')
            .eq('agent_id', supportAgentId)
            .single();

        if (agentStatus?.status !== 'running') {
            // Log the "failure" and return mock or fallback handled by frontend/backend
            fastify.log.warn({ supportAgentId }, 'Support agent is not running. Returning availability error.');

            // Optionally insert a system message in the DB
            await fastify.supabase
                .from('support_conversations')
                .insert([{
                    session_id,
                    sequence: sequence + 1,
                    agent_id: supportAgentId,
                    content: 'Our support agent is currently busy or unavailable. Connection closed. Please try again later.',
                    sender: 'system'
                }]);

            return reply.status(503).send({
                error: 'Agent Offline',
                message: 'Our support agent is currently busy or unavailable. Please try again later.'
            });
        }

        // The worker process is expected to pick up the 'user' message and respond.
        // For the Proxy feature, the backend just confirms receipt.
        return { success: true, messageId: userMsg.id };
    });

    // 3. Conversation History (for recovery)
    fastify.get('/history/:sessionId', async (request) => {
        const { sessionId } = request.params as { sessionId: string };

        const { data, error } = await fastify.supabase
            .from('support_conversations')
            .select('*')
            .eq('session_id', sessionId)
            .order('sequence', { ascending: true });

        if (error) throw error;
        return data;
    });
};

export default supportRoutes;
