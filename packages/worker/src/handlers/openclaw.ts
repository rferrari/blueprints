import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, sanitizeConfig } from '../lib/utils';
import { DOCKER_NETWORK_NAME, OPENCLAW_IMAGE, VPS_PUBLIC_IP } from '../lib/constants';
import { cryptoUtils } from '../lib/crypto';

const failureCounts = new Map<string, number>();
const MAX_RETRIES = 3;

export async function startOpenClawAgent(agentId: string, config: any) {
    logger.info(`Starting OpenClaw agent ${agentId}...`);

    try {
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'starting'
        });

        const containerName = getAgentContainerName(agentId, 'openclaw');
        const container = await docker.getContainer(containerName);

        // Deterministic port mapping: 19000 + (hash of agentId % 1000)
        const hash = agentId.split('-').reduce((acc, part) => acc + parseInt(part, 16), 0);
        const hostPort = 19000 + (hash % 1000);

        const endpointUrl = `http://${VPS_PUBLIC_IP}:${hostPort}`;

        try {
            const info = await container.inspect();
            if (info.State.Status === 'running') {
                logger.info(`Container ${containerName} is already running. Syncing DB state.`);

                // Ensure workspace and config file exist
                const projectRoot = path.resolve(process.cwd(), (process.cwd().includes('packages') ? '../../' : './'));
                const workspacePath = path.resolve(projectRoot, 'workspaces', agentId);
                const openclawDir = path.join(workspacePath, '.openclaw');
                if (!fs.existsSync(openclawDir)) {
                    fs.mkdirSync(openclawDir, { recursive: true });
                }
                const configPath = path.join(openclawDir, 'openclaw.json');
                if (!fs.existsSync(configPath)) {
                    logger.warn(`Config file ${configPath} missing for running container. Re-creating...`);
                    const decrypted = cryptoUtils.decryptConfig(config);
                    fs.writeFileSync(configPath, JSON.stringify(decrypted, null, 2));
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
            // Container doesn't exist
        }

        const projectRoot = path.resolve(process.cwd(), (process.cwd().includes('packages') ? '../../' : './'));
        const workspacePath = path.resolve(projectRoot, 'workspaces', agentId);
        const openclawDir = path.join(workspacePath, '.openclaw');

        if (!fs.existsSync(openclawDir)) {
            fs.mkdirSync(openclawDir, { recursive: true });
        }

        // Determine Host path for Docker (Must be absolute)
        const hostWorkspacesPath = process.env.HOST_WORKSPACES_PATH;
        let hostOpenclawDir = openclawDir;

        if (hostWorkspacesPath) {
            // Resolve relative to projectRoot always
            const resolvedHostWorkspaces = path.isAbsolute(hostWorkspacesPath)
                ? hostWorkspacesPath
                : path.resolve(projectRoot, hostWorkspacesPath);
            hostOpenclawDir = path.join(resolvedHostWorkspaces, agentId, '.openclaw');
        }

        const configPath = path.join(openclawDir, 'openclaw.json');

        // ... (config logic exactly as before)
        const configWithDefaults = {
            ...config,
            gateway: {
                ...(config.gateway || {}),
                mode: 'local',
                bind: 'lan'
            }
        };

        const decrypted = cryptoUtils.decryptConfig(configWithDefaults);
        const finalConfig = sanitizeConfig(decrypted);

        // Self-Healing
        if (JSON.stringify(decrypted) !== JSON.stringify(finalConfig)) {
            logger.info(`Self-Healing: Configuration mismatch detected for agent ${agentId}. Updating database.`);
            const encryptedConfig = cryptoUtils.encryptConfig(finalConfig);
            await supabase.from('agent_desired_state').update({ config: encryptedConfig }).eq('agent_id', agentId);
        }

        fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));

        const env = [
            `OPENCLAW_AGENT_ID=${agentId}`,
            `OPENCLAW_WORKSPACE_DIR=/home/node/.openclaw`,
            `OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json`
        ];

        if (finalConfig.gateway?.auth?.token) {
            env.push(`OPENCLAW_GATEWAY_TOKEN=${finalConfig.gateway.auth.token}`);
        }

        // Security Tiers: low (sandbox), pro (elevated), custom (root)
        const tier = finalConfig.metadata?.security_tier || 'low';
        let user = '1000:1000';
        let capAdd: string[] = [];

        if (tier === 'custom') {
            user = '0:0'; // Root mode
            logger.warn(`🚀 Agent ${agentId} starting in CUSTOM tier (ROOT PRIVILEGES)`);
        } else if (tier === 'pro') {
            user = '1000:1000';
            capAdd = ['SYS_ADMIN']; // Example elevated privilege
            logger.info(`🛡️ Agent ${agentId} starting in PRO tier (Elevated Sandbox)`);
        } else {
            logger.info(`🔒 Agent ${agentId} starting in LOW tier (Strict Sandbox)`);
        }

        // Verify image exists locally or attempt to pull
        try {
            await docker.inspectImage(OPENCLAW_IMAGE);
        } catch (e: any) {
            if (e.status === 404) {
                logger.info(`Image ${OPENCLAW_IMAGE} not found locally. Attempting to pull...`);
                try {
                    await docker.pullImage(OPENCLAW_IMAGE);
                    logger.info(`Successfully pulled image ${OPENCLAW_IMAGE}`);
                } catch (pullErr: any) {
                    logger.error(`Failed to pull image ${OPENCLAW_IMAGE}: ${pullErr.message}`);
                    throw pullErr;
                }
            } else {
                throw e;
            }
        }

        const newContainer = await docker.createContainer({
            Image: OPENCLAW_IMAGE,
            User: user,
            name: containerName,
            Env: env,
            Cmd: ['node', 'dist/index.js', 'gateway', '--bind', 'lan'],
            ExposedPorts: { '18789/tcp': {} },
            HostConfig: {
                Binds: [`${hostOpenclawDir}:/home/node/.openclaw`],
                PortBindings: { '18789/tcp': [{ HostPort: hostPort.toString() }] },
                RestartPolicy: { Name: 'unless-stopped' },
                CapAdd: capAdd
            },
            NetworkingConfig: {
                EndpointsConfig: { [DOCKER_NETWORK_NAME]: {} }
            }
        });

        await newContainer.start();

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'running',
            endpoint_url: endpointUrl,
            last_sync: new Date().toISOString()
        });

        failureCounts.delete(agentId);
    } catch (err: any) {
        logger.error(`Failed to start OpenClaw agent ${agentId}:`, err.message);

        const currentFailures = (failureCounts.get(agentId) || 0) + 1;
        failureCounts.set(agentId, currentFailures);

        if (currentFailures >= MAX_RETRIES) {
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

export async function stopOpenClawAgent(agentId: string) {
    const containerName = getAgentContainerName(agentId, 'openclaw');
    try {
        const container = await docker.getContainer(containerName);
        await container.stop();
        await container.remove();
        logger.info(`OpenClaw agent ${agentId} stopped and container removed.`);
    } catch (err: any) {
        logger.warn(`Failed to stop OpenClaw agent ${agentId} (likely already stopped):`, err.message);
    }
}

/**
 * Executes a command inside the OpenClaw agent's container.
 * This powers the 'Terminal Tool' for OpenBot.
 */
export async function runTerminalCommand(agentId: string, command: string): Promise<string> {
    const containerName = getAgentContainerName(agentId, 'openclaw');
    try {
        const exec = await docker.createExec(containerName, {
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Cmd: ['sh', '-c', command]
        });

        logger.info(`OpenClaw: Starting exec ${exec.Id} for command "${command}"...`);
        const result = await docker.startExec(exec.Id, { Detach: false, Tty: true });
        logger.info(`OpenClaw: Exec ${exec.Id} finished.`);
        // The startExec result for sh -c is usually the output stream if Attached
        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
        logger.error(`Terminal Error for ${agentId}:`, err.message);
        return `Error: ${err.message}`;
    }
}
