import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import supabasePlugin from './plugins/supabase';
import authPlugin from './plugins/auth';
import adminPlugin from './plugins/admin';
import projectRoutes from './routes/projects';
import agentRoutes from './routes/agents';
import adminRoutes from './routes/admin';
import feedbackRoutes from './routes/feedback';
import upgradeFeedbackRoutes from './routes/upgrade-feedback';
import supportRoutes from './routes/support';
import rateLimit from '@fastify/rate-limit';

const fastify = Fastify({
    disableRequestLogging: true, // Reduce noise: standard incoming/completed logs moved to debug
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
            },
        },
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
        hint: error.hint, // PostgREST often provides hints
        fullError: isSupabaseError ? error : undefined,
        isDatabaseError: isSupabaseError
    }, 'Critical Request Error');

    // Beautify the response if it's a DB error
    if (isSupabaseError) {
        if (error.code === 'PGRST205') {
            return reply.status(500).send({
                error: 'Database Schema Cache Error',
                message: 'Supabase column cache is out of sync. Please run "NOTIFY pgrst, \'reload schema\';" in your SQL Editor.',
                code: error.code
            });
        }
        return reply.status(500).send({
            error: 'Database Error',
            message: `Supabase returned an error: ${error.message}`,
            code: error.code
        });
    }

    reply.send(error);
});

// Register plugins
await fastify.register(cors);
await fastify.register(sensible);

// Rate Limiting
await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
        // Use session_id if available in body, fallback to IP
        return (request.body as any)?.session_id || request.ip;
    },
    skipOnError: true
});
// REMOVED root-level authPlugin registration

// Use environment variables
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
fastify.get('/health', { logLevel: 'silent' }, async () => {
    return { status: 'ok' };
});

// Protected routes group
await fastify.register(async (authenticatedInstance) => {
    authenticatedInstance.register(authPlugin);
    authenticatedInstance.register(adminPlugin);
    authenticatedInstance.register(projectRoutes, { prefix: '/projects' });
    authenticatedInstance.register(agentRoutes, { prefix: '/agents' });
    authenticatedInstance.register(adminRoutes, { prefix: '/admin' });
    authenticatedInstance.register(feedbackRoutes, { prefix: '/feedback' });
    authenticatedInstance.register(upgradeFeedbackRoutes, { prefix: '/upgrade-feedback' });
    authenticatedInstance.register(supportRoutes, { prefix: '/support' });

    // Public settings endpoint
    authenticatedInstance.get('/settings/public', async () => {
        const { data } = await authenticatedInstance.supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'enable_managed_keys')
            .single();

        return {
            enableManagedKeys: (data?.value as any)?.enabled === true
        };
    });

    // Managed Provider Keys Plugin — database-flagged
    const { data: mkSetting } = await authenticatedInstance.supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'enable_managed_keys')
        .single();

    if ((mkSetting?.value as any)?.enabled === true) {
        const managedKeysPlugin = (await import('./plugins/managed-keys/index.js')).default;
        authenticatedInstance.register(managedKeysPlugin);
    }
});

const start = async () => {
    try {
        await fastify.listen({ port: Number(process.env.PORT) || 4000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();

export default fastify;
