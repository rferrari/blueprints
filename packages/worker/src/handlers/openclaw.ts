import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, sanitizeConfig } from '../lib/utils';
import { DOCKER_NETWORK_NAME, OPENCLAW_IMAGE, VPS_PUBLIC_IP } from '../lib/constants';
import { cryptoUtils } from '../lib/crypto';
import { UserTier, SecurityLevel, resolveSecurityLevel } from '@eliza-manager/shared';

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
            try {
                fs.chownSync(openclawDir, 1000, 1000); // Ensure node user owns the directory
            } catch (e) {
                logger.warn(`Failed to chown openclaw dir: ${e}`);
            }
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

        // Filter out internal flags before writing to disk
        const configToWrite = { ...finalConfig };
        delete configToWrite.blueprints_chat;
        delete configToWrite.metadata;

        fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 2));
        try {
            fs.chownSync(configPath, 1000, 1000); // Ensure node user owns the config
        } catch (e) {
            logger.warn(`Failed to chown config file: ${e}`);
        }

        const env = [
            `OPENCLAW_WORKSPACE_DIR=/home/node/.openclaw`,
            `OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json`
        ];

        if (finalConfig.gateway?.auth?.token) {
            env.push(`OPENCLAW_GATEWAY_TOKEN=${finalConfig.gateway.auth.token}`);
        }

        // Fetch User Tier for Security Enforcement
        const { data: agentData, error: agentError } = await supabase
            .from('agents')
            .select(`
                project_id,
                projects (
                    user_id,
                    profiles (
                        tier
                    )
                )
            `)
            .eq('id', agentId)
            .single();

        if (agentError || !agentData) {
            logger.error(`Failed to fetch project/tier info for agent ${agentId}: ${agentError?.message}`);
        }

        // specific casting because supabase types might be loose here in the worker
        const userTier = (agentData?.projects as any)?.profiles?.tier as UserTier || UserTier.FREE;
        const requestedLevel = (config.metadata?.security_level as SecurityLevel) || SecurityLevel.SANDBOX;

        // Resolve Effective Security Level
        const effectiveLevel = resolveSecurityLevel(userTier, requestedLevel);

        // Apply Security Context
        let user = '1000:1000';
        let capAdd: string[] = [];
        const binds = [`${hostOpenclawDir}:/home/node/.openclaw`];

        switch (effectiveLevel) {
            case SecurityLevel.ROOT:
                user = '0:0';
                capAdd = ['SYS_ADMIN', 'NET_ADMIN'];
                logger.warn(`🚀 Agent ${agentId} starting in ROOT security level (User Tier: ${userTier})`);
                break;
            case SecurityLevel.SYSADMIN:
                user = '1000:1000';
                capAdd = ['SYS_ADMIN'];
                logger.info(`🛡️ Agent ${agentId} starting in SYSADMIN security level`);
                break;
            case SecurityLevel.SANDBOX:
            default:
                user = '1000:1000';
                logger.info(`🔒 Agent ${agentId} starting in SANDBOX security level`);
                break;
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
                Binds: binds,
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
            last_sync: new Date().toISOString(),
            effective_security_tier: effectiveLevel.toString()
        });

    } catch (err: any) {
        logger.error(`Failed to start OpenClaw agent ${agentId}:`, err.message);
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'error',
            error_message: err.message
        });
        throw err; // Re-throw for reconciler to handle retries
    }
}

export async function stopOpenClawAgent(agentId: string) {
    const containerName = getAgentContainerName(agentId, 'openclaw');
    try {
        const container = await docker.getContainer(containerName);
        console.log(`Stopping container ${containerName}...`);
        await container.stop();
        console.log(`Removing container ${containerName}...`);
        await container.remove();
        logger.info(`OpenClaw agent ${agentId} stopped and container removed.`);

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'stopped',
            endpoint_url: null,
            last_sync: new Date().toISOString()
        });
    } catch (err: any) {
        logger.warn(`Failed to stop OpenClaw agent ${agentId} (likely already stopped):`, err.message);
    }
}

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
        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
        logger.error(`Terminal Error for ${agentId}:`, err.message);
        return `Error: ${err.message}`;
    }
}
