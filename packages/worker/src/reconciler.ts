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
                    metadata,
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

            const now = new Date();
            const purgeDate = desired.purge_at ? new Date(desired.purge_at) : null;
            const stopDate = purgeDate ? new Date(purgeDate.getTime() - (24 * 60 * 60 * 1000)) : null;

            // 1. Handle Auto-Stop during countdown transition
            const isInTerminationWindow = stopDate && now >= stopDate;
            const shouldBeRunning = desired.enabled && !isInTerminationWindow;

            const status = actual?.status || 'stopped';
            let isRunning = status === 'running';

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

            // Purge Logic: Final Execution
            if (purgeDate && now >= purgeDate) {
                logger.info(`[TERMINATE] Executing final deletion for agent ${agent.id}...`);
                try {
                    if (agent.framework === 'openclaw') await stopOpenClawAgent(agent.id);
                    else await stopElizaAgent(agent.id);
                    // ONLY delete from DB if cleanup succeeded
                    await supabase.from('agents').delete().eq('id', agent.id);
                    logger.info(`[TERMINATE] Agent ${agent.id} successfully purged from both Docker and DB.`);
                } catch (cleanupErr: any) {
                    logger.error(`[PURGE] Critical failure during termination for ${agent.id}: ${cleanupErr.message}. DB record preserved for retry.`);
                }
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
                        const forceDoctor = currentFailCount > 0;
                        await startOpenClawAgent(agent.id, desired.config, desired.metadata, forceDoctor);
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

async function cleanupOrphanContainers() {
    logger.info('🧹 Starting Orphan Container Cleanup...');
    try {
        const { data: agents, error } = await supabase.from('agents').select('id');
        if (error) {
            logger.error('Cleanup Error: Failed to fetch agents:', error.message);
            return;
        }

        const activeAgentIds = new Set(agents.map(a => a.id));
        const containers = await docker.listContainers();

        for (const container of containers) {
            const name = container.Names[0].replace('/', '');
            // Pattern: [framework]-[agent_id]
            const match = name.match(/^(openclaw|eliza)-([a-f0-9-]{36})$/);
            if (match) {
                const agentId = match[2];
                if (!activeAgentIds.has(agentId)) {
                    logger.warn(`[CLEANUP] Found orphan container ${name} (Agent ${agentId} missing from DB). Removing...`);
                    try {
                        const c = await docker.getContainer(container.Id);
                        if (container.State === 'running') {
                            await c.stop();
                        }
                        await c.remove();
                        logger.info(`[CLEANUP] Successfully removed orphan container ${name}`);
                    } catch (err: any) {
                        logger.error(`[CLEANUP] Failed to remove ${name}:`, err.message);
                    }
                }
            }
        }
    } catch (err: any) {
        logger.error('Cleanup Loop Error:', err.message);
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

    // Zombie Cleanup: Run every 5 minutes
    setInterval(cleanupOrphanContainers, 5 * 60 * 1000);

    // Initial run
    reconcile();
    cleanupOrphanContainers();
    startStateListener();
}
