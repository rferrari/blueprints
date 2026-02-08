import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import crypto from 'node:crypto';
import { cryptoUtils } from './lib/crypto';
import { logger } from './lib/logger';
import { docker } from './lib/docker';
import { startMessageBus } from './message-bus';
import { startOpenClawAgent, stopOpenClawAgent } from './handlers/openclaw';
import { startElizaAgent, stopElizaAgent } from './handlers/eliza';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let isReconciling = false;
const configHashes = new Map<string, string>();

function getConfigHash(config: any): string {
    if (!config) return 'empty';
    const str = typeof config === 'string' ? config : JSON.stringify(config);
    return crypto.createHash('md5').update(str).digest('hex');
}

async function reconcile() {
    if (isReconciling) return;
    isReconciling = true;

    try {
        const { data: agents, error } = await supabase
            .from('agents')
            .select(`
            id,
            name,
            framework,
            agent_desired_state (
                enabled,
                config,
                purge_at
            ),
            agent_actual_state (
                status,
                runtime_id
            ),
            project_id
        `) as any;

        if (error) {
            logger.error('Error fetching agents:', error);
            return;
        }

        const now = new Date();
        const dockerContainers = await docker.listContainers();
        const runningContainers = new Set(dockerContainers
            .filter((c: any) => (c.State || '').toLowerCase() === 'running')
            .map((c: any) => c.Names[0].replace('/', ''))
        );

        for (const agent of agents) {
            const desired = agent.agent_desired_state;
            const actual = agent.agent_actual_state;

            if (!desired || !actual) continue;

            let isRunning = actual.status === 'running';
            const shouldBeRunning = desired.enabled;

            if (agent.framework === 'openclaw') {
                const containerName = `openclaw-${agent.id}`;
                const containerIsReallyRunning = runningContainers.has(containerName);

                if (isRunning && !containerIsReallyRunning) {
                    logger.warn(`Agent ${agent.id} marked as running in DB but container is missing or stopped. Syncing DB...`);
                    await supabase.from('agent_actual_state').upsert({
                        agent_id: agent.id,
                        status: 'stopped',
                        endpoint_url: null,
                        last_sync: new Date().toISOString()
                    });
                    isRunning = false;
                }
            }

            if (desired.purge_at) {
                const purgeDate = new Date(desired.purge_at);
                if (now >= purgeDate) {
                    logger.info(`[TERMINATE] Executing final deletion for ${agent.framework} agent ${agent.id}...`);
                    if (agent.framework === 'openclaw') await stopOpenClawAgent(agent.id);
                    else await stopElizaAgent(agent.id);
                    await supabase.from('agents').delete().eq('id', agent.id);
                    continue;
                }
            }

            const currentHash = getConfigHash(desired.config);
            const lastHash = configHashes.get(agent.id);
            const configChanged = lastHash && lastHash !== currentHash;

            if (shouldBeRunning && (!isRunning || configChanged)) {
                if (configChanged && isRunning) {
                    logger.info(`Configuration changed for agent ${agent.id}. Restarting...`);
                    if (agent.framework === 'openclaw') await stopOpenClawAgent(agent.id);
                    else await stopElizaAgent(agent.id);
                }
                if (agent.framework === 'openclaw') await startOpenClawAgent(agent.id, desired.config);
                else await startElizaAgent(agent.id, desired.config);
                configHashes.set(agent.id, currentHash);
            } else if (!shouldBeRunning && isRunning) {
                if (agent.framework === 'openclaw') await stopOpenClawAgent(agent.id);
                else await stopElizaAgent(agent.id);
                configHashes.delete(agent.id);
            } else if (shouldBeRunning && isRunning && !lastHash) {
                configHashes.set(agent.id, currentHash);
            }
        }
    } finally {
        isReconciling = false;
    }
}

function startStateListener() {
    logger.info('🛰️  Starting State Change Listener...');
    supabase
        .channel('agent_state_changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'agent_desired_state'
        }, () => {
            logger.info('🔄 State change detected, triggering reconciliation...');
            reconcile();
        })
        .subscribe();
}

async function startReconciler() {
    await reconcile();
    setTimeout(startReconciler, 10000);
}

// Global process handling for clean exits
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Cleaning up...');
    process.exit(0);
});

startReconciler();
startMessageBus();
startStateListener();
