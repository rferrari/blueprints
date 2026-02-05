import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Simple Logger with levels
const LogLevels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LOG_LEVEL = (process.env.LOG_LEVEL?.toUpperCase() as keyof typeof LogLevels) || 'INFO';

const logger = {
    _log: (level: string, icon: string, ...args: any[]) => {
        const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        console.log(`${time} ${icon} ${level.padEnd(5)} |`, ...args);
    },
    debug: (...args: any[]) => (LogLevels as any)[CURRENT_LOG_LEVEL] <= LogLevels.DEBUG && logger._log('DEBUG', '⚙️', ...args),
    info: (...args: any[]) => (LogLevels as any)[CURRENT_LOG_LEVEL] <= LogLevels.INFO && logger._log('INFO', '🚀', ...args),
    warn: (...args: any[]) => (LogLevels as any)[CURRENT_LOG_LEVEL] <= LogLevels.WARN && logger._log('WARN', '⚠️', ...args),
    error: (...args: any[]) => (LogLevels as any)[CURRENT_LOG_LEVEL] <= LogLevels.ERROR && logger._log('ERROR', '🛑', ...args),
};

// Simplified Docker API Client to bypass problematic native dependencies
const dockerSocket = { socketPath: '/var/run/docker.sock' };
const dockerApi = axios.create({
    ...dockerSocket,
    baseURL: 'http://localhost'
});

const docker = {
    async listContainers() {
        const { data } = await dockerApi.get('/containers/json?all=true');
        return data;
    },
    async getContainer(name: string) {
        return {
            async inspect() {
                const { data } = await dockerApi.get(`/containers/${name}/json`);
                return data;
            },
            async start() {
                await dockerApi.post(`/containers/${name}/start`);
            },
            async stop() {
                await dockerApi.post(`/containers/${name}/stop`);
            },
            async remove() {
                await dockerApi.delete(`/containers/${name}?v=true&force=true`);
            }
        };
    },
    async createContainer(config: any) {
        // Destructure name as it goes into the query param, pass the rest in body
        const { name, ...rest } = config;
        const { data } = await dockerApi.post(`/containers/create?name=${name}`, rest);
        return this.getContainer(data.Id || data.Id);
    }
};

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Track consecutive failures to implement a retry limit
const failureCounts = new Map<string, number>();
const MAX_RETRIES = 3;

let isReconciling = false;

async function reconcile() {
    if (isReconciling) return;
    isReconciling = true;

    try {
        logger.debug('--- Reconciling Agents ---');

        // 1. Fetch all agents with their states
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

        // 2. Process each agent
        for (const agent of agents) {
            const desired = agent.agent_desired_state;
            const actual = agent.agent_actual_state;

            if (!desired || !actual) continue;

            // Standard Reconcile
            let isRunning = actual.status === 'running';
            const shouldBeRunning = desired.enabled;

            // Verify Docker state for OpenClaw agents to ensure the DB reflects reality
            if (agent.framework === 'openclaw') {
                const containerName = `openclaw-${agent.id}`;
                const containerIsReallyRunning = runningContainers.has(containerName);

                if (isRunning && !containerIsReallyRunning) {
                    logger.warn(`Agent ${agent.id} marked as running in DB but container is missing or stopped. Syncing DB...`);

                    const { error: syncError } = await supabase.from('agent_actual_state').upsert({
                        agent_id: agent.id,
                        status: 'stopped',
                        endpoint_url: null,
                        last_sync: new Date().toISOString()
                    });

                    if (syncError) {
                        logger.error(`Failed to sync stopped state for agent ${agent.id}:`, syncError.message, syncError.code);
                    } else {
                        isRunning = false;
                    }
                }
            }

            // Check Purge Logic
            if (desired.purge_at) {
                const purgeDate = new Date(desired.purge_at);

                // Stage 1: Absolute Purge (Time to delete)
                if (now >= purgeDate) {
                    const framework = agent.framework === 'openclaw' ? 'OpenClaw' : 'Eliza';
                    logger.info(`[PURGE] Executing final deletion for ${framework} agent ${agent.id}...`);
                    if (agent.framework === 'openclaw') {
                        await stopOpenClawAgent(agent.id);
                    } else {
                        await stopElizaAgent(agent.id);
                    }
                    await supabase.from('agents').delete().eq('id', agent.id);
                    continue;
                }

                // Stage 2: Stopping Sequence (Time to stop)
                // The original logic for stopDate was removed as per the patch.
                // If it needs to be re-added, it should be done explicitly.
                // const stopDate = new Date(purgeDate.getTime() - (24 * 60 * 60 * 1000));
                // if (now >= stopDate && desired.enabled) {
                //     console.log(`[PURGE] Entering decommissioning for agent ${agent.id}. Disabling...`);
                //     await supabase.from('agent_desired_state').update({ enabled: false }).eq('agent_id', agent.id);
                //     desired.enabled = false; // Update local state for subsequent logic
                // }
            }

            if (shouldBeRunning && !isRunning) {
                if (agent.framework === 'openclaw') {
                    await startOpenClawAgent(agent.id, desired.config);
                } else {
                    await startElizaAgent(agent.id, desired.config);
                }
            } else if (!shouldBeRunning && isRunning) {
                if (agent.framework === 'openclaw') {
                    await stopOpenClawAgent(agent.id);
                } else {
                    await stopElizaAgent(agent.id);
                }
            }
        }
    } finally {
        isReconciling = false;
    }
}

// --- Eliza Framework Logic ---

async function startElizaAgent(agentId: string, config: any) {
    logger.info(`Starting Eliza agent ${agentId}...`);

    const { data: runtime } = await supabase.from('runtimes').select('*').limit(1).single();

    if (!runtime) {
        logger.error('No runtime available to start Eliza agent');
        return;
    }

    try {
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'starting',
            runtime_id: runtime.id
        });

        await axios.post(`${runtime.eliza_api_url}/agents`, {
            agent: { ...config, id: agentId }
        }, {
            headers: { 'Authorization': `Bearer ${runtime.auth_token}` }
        });

        await axios.post(`${runtime.eliza_api_url}/agents/${agentId}/start`, { config }, {
            headers: { 'Authorization': `Bearer ${runtime.auth_token}` }
        });

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'running',
            runtime_id: runtime.id,
            last_sync: new Date().toISOString()
        });

        failureCounts.delete(agentId); // Success! Reset counter
        logger.info(`Eliza agent ${agentId} started successfully on runtime ${runtime.id}`);
    } catch (err: any) {
        if (err.isAxiosError && err.response) {
            logger.error(`Runtime API Error (${err.response.status}):`, JSON.stringify(err.response.data, null, 2));
        }
        logger.error(`Failed to start Eliza agent ${agentId}:`, err.message);

        const currentFailures = (failureCounts.get(agentId) || 0) + 1;
        failureCounts.set(agentId, currentFailures);

        if (currentFailures >= MAX_RETRIES) {
            logger.error(`Agent ${agentId} failed ${currentFailures} times. Disabling...`);
            await supabase.from('agent_desired_state').update({ enabled: false }).eq('agent_id', agentId);
            failureCounts.delete(agentId);
        }

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'error',
            error_message: err.message
        });
    }
}

async function stopElizaAgent(agentId: string) {
    logger.info(`Stopping Eliza agent ${agentId}...`);

    const { data: actual } = await supabase
        .from('agent_actual_state')
        .select('*')
        .eq('agent_id', agentId)
        .single();

    if (!actual || !actual.runtime_id) return;

    const { data: runtime } = await supabase
        .from('runtimes')
        .select('*')
        .eq('id', actual.runtime_id)
        .single();

    if (!runtime) return;

    try {
        await axios.post(`${runtime.eliza_api_url}/agents/${agentId}/stop`, {}, {
            headers: { 'Authorization': `Bearer ${runtime.auth_token}` }
        });

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'stopped',
            runtime_id: null,
            last_sync: new Date().toISOString()
        });

        logger.info(`Eliza agent ${agentId} stopped successfully.`);
    } catch (err: any) {
        logger.error(`Failed to stop Eliza agent ${agentId}:`, err.message);
    }
}

// --- OpenClaw Framework Logic ---

async function startOpenClawAgent(agentId: string, config: any) {
    logger.info(`Starting OpenClaw agent ${agentId}...`);

    try {
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'starting'
        });

        const containerName = `openclaw-${agentId}`;
        const container = await docker.getContainer(containerName);

        // Deterministic port mapping: 19000 + (hash of agentId % 1000)
        const hash = agentId.split('-').reduce((acc, part) => acc + parseInt(part, 16), 0);
        const hostPort = 19000 + (hash % 1000);

        // Use VPS_PUBLIC_IP if set, otherwise fallback to localhost for standalone/dev
        const vpsIp = process.env.VPS_PUBLIC_IP || 'localhost';
        const endpointUrl = `http://${vpsIp}:${hostPort}`;

        try {
            const info = await container.inspect();
            // Docker's 'Running' boolean can be true during 'restarting', so we check 'Status' specifically.
            if (info.State.Status === 'running') {
                logger.info(`Container ${containerName} is already running. Syncing DB state.`);

                // Ensure workspace and config file exist even if container is running
                const workspacePath = path.resolve(process.cwd(), (process.cwd().includes('packages') ? '../../' : './'), 'workspaces', agentId);
                if (!fs.existsSync(workspacePath)) {
                    fs.mkdirSync(workspacePath, { recursive: true });
                }
                const configPath = path.join(workspacePath, 'openclaw.json');
                if (!fs.existsSync(configPath)) {
                    logger.warn(`Config file ${configPath} missing for running container. Re-creating...`);
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                }

                const { error: syncError } = await supabase.from('agent_actual_state').upsert({
                    agent_id: agentId,
                    status: 'running',
                    endpoint_url: endpointUrl,
                    last_sync: new Date().toISOString()
                });
                if (syncError) throw syncError;
                failureCounts.delete(agentId);
                return;
            }
            logger.info(`Container ${containerName} is in state "${info.State.Status}". Removing and recreating...`);
            await container.remove();
        } catch (e: any) {
            // Container doesn't exist, proceed to create
        }

        // Setup workspace directory in project root
        const workspacePath = path.resolve(process.cwd(), (process.cwd().includes('packages') ? '../../' : './'), 'workspaces', agentId);
        if (!fs.existsSync(workspacePath)) {
            fs.mkdirSync(workspacePath, { recursive: true });
        }

        // Write config to file in workspace
        const configPath = path.join(workspacePath, 'openclaw.json');
        logger.info(`Writing OpenClaw config to ${configPath}...`);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        // Setup environment variables
        const env = [
            `OPENCLAW_AGENT_ID=${agentId}`,
            `OPENCLAW_WORKSPACE_DIR=/home/node/.openclaw`,
            `OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json`
        ];

        // Ensure gateway token is set for worker-agent communication if provided in config
        if (config.gateway?.auth?.token) {
            env.push(`OPENCLAW_GATEWAY_TOKEN=${config.gateway.auth.token}`);
        }

        logger.debug(`Creating container ${containerName} with image openclaw:local (Port ${hostPort})...`);
        const newContainer = await docker.createContainer({
            Image: 'openclaw:local',
            name: containerName,
            Env: env,
            Cmd: ['node', 'dist/index.js', 'gateway', '--allow-unconfigured', '--bind', 'lan'],
            ExposedPorts: {
                '18789/tcp': {}
            },
            HostConfig: {
                Binds: [
                    `${workspacePath}:/home/node/.openclaw`
                ],
                PortBindings: {
                    '18789/tcp': [{ HostPort: hostPort.toString() }]
                },
                RestartPolicy: { Name: 'unless-stopped' }
            }
        });

        await newContainer.start();

        const { error: upsertError } = await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'running',
            endpoint_url: endpointUrl,
            last_sync: new Date().toISOString()
        });

        if (upsertError) throw upsertError;

        failureCounts.delete(agentId); // Success! Reset counter
        logger.info(`OpenClaw agent ${agentId} started via Docker successfully.`);
    } catch (err: any) {
        if (err.isAxiosError && err.response) {
            logger.error(`Docker API Error (${err.response.status}):`, JSON.stringify(err.response.data, null, 2));
        }
        logger.error(`Failed to start OpenClaw agent ${agentId}:`, err.message);

        const currentFailures = (failureCounts.get(agentId) || 0) + 1;
        failureCounts.set(agentId, currentFailures);

        if (currentFailures >= MAX_RETRIES) {
            logger.error(`Agent ${agentId} failed ${currentFailures} times. Disabling...`);
            await supabase.from('agent_desired_state').update({ enabled: false }).eq('agent_id', agentId);
            failureCounts.delete(agentId);
        }

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'error',
            error_message: err.message
        });
    }
}

async function stopOpenClawAgent(agentId: string) {
    logger.info(`Stopping OpenClaw agent ${agentId}...`);

    const containerName = `openclaw-${agentId}`;
    const container = await docker.getContainer(containerName);

    try {
        await container.stop();
        await container.remove();

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'stopped',
            runtime_id: null,
            last_sync: new Date().toISOString()
        });

        logger.info(`OpenClaw agent ${agentId} stopped and container removed.`);
    } catch (err: any) {
        logger.error(`Failed to stop OpenClaw agent ${agentId}:`, err.message);
    }
}

// Run the reconciler every 10 seconds
async function startReconciler() {
    await reconcile();
    setTimeout(startReconciler, 10000);
}

startReconciler();
