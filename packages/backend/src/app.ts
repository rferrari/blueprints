import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import supabasePlugin from './plugins/supabase';
import authPlugin from './plugins/auth';
import projectRoutes from './routes/projects';
import agentRoutes from './routes/agents';

const fastify = Fastify({
    logger: {
        level: 'info',
        serializers: {
            req: (req) => ({ method: req.method, url: req.url }),
            res: (res) => ({ statusCode: res.statusCode })
        }
    },
});

// Global error handler for cleaner logs
fastify.setErrorHandler((error: any, request, reply) => {
    const isSupabaseError = error.code?.startsWith('PGRST');

    fastify.log.error({
        msg: error.message,
        path: request.url,
        code: error.code,
        details: error.details,
        isDatabaseError: isSupabaseError
    }, 'Critical Request Error');

    // Beautify the response if it's a DB error
    if (isSupabaseError) {
        return reply.status(500).send({
            error: 'Database Schema Sync Error',
            message: `The server is out of sync with the database: ${error.message}`,
            code: error.code
        });
    }

    reply.send(error);
});

// Register plugins
await fastify.register(cors);
await fastify.register(sensible);
// REMOVED root-level authPlugin registration

// In a real app, use environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    fastify.log.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Backend will have limited functionality.');
}

await fastify.register(supabasePlugin, {
    url: SUPABASE_URL,
    key: SUPABASE_SERVICE_ROLE_KEY,
});

// Register routes
fastify.get('/health', async () => {
    return { status: 'ok' };
});

// Protected routes group
await fastify.register(async (authenticatedInstance) => {
    authenticatedInstance.register(authPlugin);
    authenticatedInstance.register(projectRoutes, { prefix: '/projects' });
    authenticatedInstance.register(agentRoutes, { prefix: '/agents' });
});

const start = async () => {
    try {
        await fastify.listen({ port: 4000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();

export default fastify;
