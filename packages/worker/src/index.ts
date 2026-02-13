import 'dotenv/config';
import { logger } from './lib/logger';
import { startMessageBus } from './message-bus';
import { startReconciler } from './reconciler';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
    process.exit(1);
}

import { createServer } from 'http';

const PORT = process.env.PORT || 5000;

// Simple Health Check Server
const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    logger.info(`🏥 Health check server listening on port ${PORT}`);
});

startReconciler();
startMessageBus();

// Managed Provider Keys: start lease expiration cron
if (process.env.ENABLE_MANAGED_KEYS === 'true') {
    import('./lib/lease-cron').then(({ startLeaseCron }) => {
        startLeaseCron();
    });
}

// Global process handling for clean exits
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Cleaning up...');
    server.close();
    process.exit(0);
});

