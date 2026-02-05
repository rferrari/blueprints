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

import http from 'node:http';

const docker = {
    async _request(method: string, path: string, body?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const options = {
                socketPath: '/var/run/docker.sock',
                path: `/v1.44${path}`,
                method,
                headers: body ? { 'Content-Type': 'application/json' } : {}
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        const err = new Error(`Docker API Error (${res.statusCode}): ${data}`);
                        (err as any).status = res.statusCode;
                        (err as any).data = data;
                        return reject(err);
                    }
                    try {
                        resolve(data ? JSON.parse(data) : {});
                    } catch (e) {
                        resolve(data);
                    }
                });
            });

            req.on('error', (err) => reject(err));
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    },
    async listContainers() {
        return this._request('GET', '/containers/json?all=true');
    },
    async getContainer(name: string) {
        return {
            inspect: () => this._request('GET', `/containers/${name}/json`),
            start: () => this._request('POST', `/containers/${name}/start`),
            stop: () => this._request('POST', `/containers/${name}/stop`),
            remove: () => this._request('DELETE', `/containers/${name}?v=true&force=true`)
        };
    },
    async createContainer(config: any) {
        const { name, ...rest } = config;
        const data = await this._request('POST', `/containers/create?name=${name}`, rest);
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
        // Move to debug to avoid log spam every 10s
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
                    logger.info(`[TERMINATE] Executing final deletion for ${framework} agent ${agent.id}...`);
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
                //     console.log(`[TERMINATE] Entering decommissioning for agent ${agent.id}. Disabling...`);
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
        if (err.status || (err.isAxiosError && err.response)) {
            const status = err.status || err.response?.status;
            const data = err.data || err.response?.data;
            logger.error(`Runtime API Error (${status}):`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
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

        // Use VPS_PUBLIC_IP if set, otherwise fallback to 127.0.0.1 (IPv4) for standalone/dev
        // We avoid 'localhost' because node/bun often resolve it to ::1 (IPv6) which Docker may not bind to
        const vpsIp = process.env.VPS_PUBLIC_IP || '127.0.0.1';
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

        // Setup workspace directory with .openclaw subdirectory
        // Setup workspace directory with .openclaw subdirectory
        // This path is internal to the worker container/process
        const workspacePath = path.resolve(process.cwd(), (process.cwd().includes('packages') ? '../../' : './'), 'workspaces', agentId);
        const openclawDir = path.join(workspacePath, '.openclaw');
        if (!fs.existsSync(openclawDir)) {
            fs.mkdirSync(openclawDir, { recursive: true });
        }

        // Determine the path to be used for the Docker bind mount (what the Docker Daemon sees on the HOST)
        // If HOST_WORKSPACES_PATH is set (e.g. /root/project/workspaces), use that.
        // Otherwise, fall back to the resolved path (which works if worker is not in docker, or paths align).
        const hostWorkspacesPath = process.env.HOST_WORKSPACES_PATH;
        let hostOpenclawDir = openclawDir;

        if (hostWorkspacesPath) {
            hostOpenclawDir = path.join(hostWorkspacesPath, agentId, '.openclaw');
            logger.debug(`Using HOST_WORKSPACES_PATH: Mapping ${hostOpenclawDir} -> /home/node/.openclaw`);
        }

        // Write config to .openclaw subdirectory
        const configPath = path.join(openclawDir, 'openclaw.json');

        // Ensure gateway mode is set to local to bypass onboarding
        const finalConfig = {
            ...config,
            gateway: {
                ...(config.gateway || {}),
                mode: 'local'
            }
        };

        logger.info(`Writing OpenClaw config to ${configPath}...`);
        fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));

        // Setup environment variables
        const env = [
            `OPENCLAW_AGENT_ID=${agentId}`,
            `OPENCLAW_WORKSPACE_DIR=/home/node/.openclaw`,
            `OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json`
        ];

        // Ensure gateway token is set for worker-agent communication if provided in config
        if (finalConfig.gateway?.auth?.token) {
            env.push(`OPENCLAW_GATEWAY_TOKEN=${finalConfig.gateway.auth.token}`);
        }

        logger.debug(`Creating container ${containerName} with image openclaw:local (Port ${hostPort})...`);

        // Securely run as the same user as the worker to avoid permission issues without 777
        const uid = process.getuid ? process.getuid() : 1000;
        const gid = process.getgid ? process.getgid() : 1000;

        const newContainer = await docker.createContainer({
            Image: 'openclaw:local',
            User: `${uid}:${gid}`,
            name: containerName,
            Env: env,
            Cmd: ['node', 'dist/index.js', 'gateway', '--bind', 'lan'],
            ExposedPorts: {
                '18789/tcp': {}
            },
            HostConfig: {
                Binds: [
                    `${hostOpenclawDir}:/home/node/.openclaw`
                ],
                PortBindings: {
                    '18789/tcp': [{ HostPort: hostPort.toString() }]
                },
                RestartPolicy: { Name: 'unless-stopped' }
            },
            NetworkingConfig: {
                EndpointsConfig: {
                    'blueprints-network': {}
                }
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
        if (err.status || (err.isAxiosError && err.response)) {
            const status = err.status || err.response?.status;
            const data = err.data || err.response?.data;
            logger.error(`Docker API Error (${status}):`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
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

// --- Message Bus Implementation ---



const isDocker = fs.existsSync('/.dockerenv');

async function handleUserMessage(payload: any) {
    const { id, agent_id, content, user_id } = payload;
    logger.info(`Message Bus: Received user message for agent ${agent_id}`);

    try {
        // 1. Get agent's actual state (for local endpoint)
        const { data: actual } = await supabase
            .from('agent_actual_state')
            .select('endpoint_url')
            .eq('agent_id', agent_id)
            .single();

        // 2. Get agent's desired state (for framework and config)
        const { data: agent } = await supabase
            .from('agents')
            .select('framework')
            .eq('id', agent_id)
            .single();

        if (!actual?.endpoint_url || !agent) {
            logger.warn(`Message Bus: Agent ${agent_id} not ready or not found.`);
            return;
        }

        let agentResponseContent = `Response from ${agent.framework} agent.`;

        if (agent.framework === 'openclaw') {
            const { data: desired } = await supabase
                .from('agent_desired_state')
                .select('config')
                .eq('agent_id', agent_id)
                .single();

            const config = (desired?.config as any) || {};


            const token = config.gateway?.auth?.token;

            // Determine correct Agent URL
            // If running in Docker (VPS/Production), we MUST use the internal container hostname (blueprints-network).
            // If running locally (Host), we use the endpoint_url (localhost:port) from the DB.
            let agentUrl = actual.endpoint_url || `http://openclaw-${agent_id}:18789`;

            if (isDocker) {
                agentUrl = `http://openclaw-${agent_id}:18789`;
                logger.debug(`Message Bus: Running in Docker, switching to internal URL: ${agentUrl}`);
            }

            logger.info(`Message Bus: Calling agent at ${agentUrl}`);

            try {
                const res = await axios.post(`${agentUrl}/v1/chat/completions`, {
                    model: 'openclaw',
                    messages: [{ role: 'user', content }]
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'x-openclaw-agent-id': 'main',
                        'Connection': 'close' // Force close to avoid socket hangup/reuse issues in Bun
                    }
                });

                const result = res.data;
                agentResponseContent = result.choices?.[0]?.message?.content || agentResponseContent;
            } catch (err: any) {
                logger.error(`Message Bus: OpenClaw agent error (${err.status || err.message})`);
                agentResponseContent = `Error: Agent returned status ${err.status || err.message}`;
            }
        } else {
            // Placeholder for other frameworks (Eliza, etc.)
            agentResponseContent = `Protocol Note: ${agent.framework} messaging bridge pending.`;
        }

        // 3. Post response back to database
        const { error: postError } = await supabase
            .from('agent_conversations')
            .insert([{
                agent_id,
                user_id,
                content: agentResponseContent,
                sender: 'agent'
            }]);

        if (postError) {
            logger.error(`Message Bus: Failed to post agent response:`, postError.message);
        } else {
            logger.info(`Message Bus: Agent response posted for agent ${agent_id}`);
        }

    } catch (err: any) {
        logger.error(`Message Bus: Error processing message:`, err.message);
    }
}

function startMessageBus() {
    logger.info('🛰️  Starting Message Bus Listener...');

    supabase
        .channel('agent_conversations_changes')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_conversations',
            filter: 'sender=eq.user'
        }, (payload) => {
            handleUserMessage(payload.new);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                logger.info('✅ Message Bus: Subscribed to conversations');
            }
        });
}

// Run the reconciler every 10 seconds
async function startReconciler() {
    await reconcile();
    setTimeout(startReconciler, 10000);
}

startReconciler();
startMessageBus();
