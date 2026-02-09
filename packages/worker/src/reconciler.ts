import { supabase } from './lib/supabase';
import { logger } from './lib/logger';
import { docker } from './lib/docker';
import { getConfigHash, getAgentContainerName } from './lib/utils';
import { startOpenClawAgent, stopOpenClawAgent } from './handlers/openclaw';
import { startElizaAgent, stopElizaAgent } from './handlers/eliza';
import { RECONCILE_INTERVAL_MS } from './lib/constants';

let isReconciling = false;
const configHashes = new Map<string, string>();
const failCounts = new Map<string, number>();

export async function reconcile() {
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

            if (!desired) continue;

            const status = actual?.status || 'stopped';
            let isRunning = status === 'running';
            const shouldBeRunning = desired.enabled;

            // Verify Docker state for OpenClaw/Eliza agents
            const containerName = getAgentContainerName(agent.id, agent.framework);
            const containerIsReallyRunning = runningContainers.has(containerName);

            if (isRunning && !containerIsReallyRunning) {
                logger.warn(`Agent ${agent.id} marked as running in DB but container is missing/stopped. Syncing...`);
                await supabase.from('agent_actual_state').upsert({
                    agent_id: agent.id,
                    status: 'stopped',
                    endpoint_url: null,
                    last_sync: new Date().toISOString()
                });
                isRunning = false;
            }

            // Purge Logic
            if (desired.purge_at && now >= new Date(desired.purge_at)) {
                logger.info(`[TERMINATE] Executing final deletion for agent ${agent.id}...`);
                try {
                    if (agent.framework === 'openclaw') await stopOpenClawAgent(agent.id);
                    else await stopElizaAgent(agent.id);
                } catch (cleanupErr: any) {
                    logger.warn(`[PURGE] Failed to stop/remove container for ${agent.id}: ${cleanupErr.message}. Proceeding with DB deletion.`);
                }

                await supabase.from('agents').delete().eq('id', agent.id);
                continue;
            }

            const currentHash = getConfigHash(desired.config);
            const lastHash = configHashes.get(agent.id);
            const configChanged = lastHash && lastHash !== currentHash;

            if (shouldBeRunning && (!isRunning || configChanged)) {

                // CPU SAFETY: Check for retry limit
                const currentFailCount = failCounts.get(agent.id) || 0;
                if (currentFailCount >= 3) {
                    logger.error(`[CPU SAFETY] Agent ${agent.id} hit max retries (${currentFailCount}). Disabling...`);
                    await supabase.from('agent_desired_state').update({ enabled: false }).eq('agent_id', agent.id);
                    failCounts.delete(agent.id); // Reset so it can be tried again if user re-enables
                    continue;
                }

                try {
                    if (configChanged && isRunning) {
                        logger.info(`Config changed for agent ${agent.id}. Restarting...`);
                        if (agent.framework === 'openclaw') await stopOpenClawAgent(agent.id);
                        else await stopElizaAgent(agent.id);
                    }

                    if (agent.framework === 'openclaw') {
                        await startOpenClawAgent(agent.id, desired.config);
                    } else {
                        await startElizaAgent(agent.id, desired.config);
                    }
                    configHashes.set(agent.id, currentHash);

                    // Success! Reset fail count
                    if (failCounts.has(agent.id)) {
                        failCounts.delete(agent.id);
                        logger.info(`Agent ${agent.id} started successfully. Failure count reset.`);
                    }

                } catch (startError: any) {
                    const newCount = currentFailCount + 1;
                    failCounts.set(agent.id, newCount);
                    logger.error(`Failed to start agent ${agent.id} (Attempt ${newCount}/3):`, startError.message);
                }

            } else if (!shouldBeRunning && isRunning) {
                if (agent.framework === 'openclaw') await stopOpenClawAgent(agent.id);
                else await stopElizaAgent(agent.id);
                configHashes.delete(agent.id);
                failCounts.delete(agent.id);
            } else if (shouldBeRunning && isRunning && !lastHash) {
                configHashes.set(agent.id, currentHash);
            }
        }
    } catch (err: any) {
        logger.error('Reconciliation error:', err.message);
    } finally {
        isReconciling = false;
    }
}

export function startStateListener() {
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

export function startReconciler() {
    logger.info(`Starting Reconciler (Interval: ${RECONCILE_INTERVAL_MS}ms)...`);
    setInterval(reconcile, RECONCILE_INTERVAL_MS);
    // Initial run
    reconcile();
    startStateListener();
}
