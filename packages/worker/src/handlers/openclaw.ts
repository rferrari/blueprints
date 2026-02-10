import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, sanitizeConfig } from '../lib/utils';
import { DOCKER_NETWORK_NAME, OPENCLAW_IMAGE, VPS_PUBLIC_IP } from '../lib/constants';
import { cryptoUtils } from '../lib/crypto';
import { UserTier, SecurityLevel, resolveSecurityLevel } from '@eliza-manager/shared';


async function ensureCorrectPermissions(workspacePath: string) {
    try {
        const workspaceDir = path.resolve(workspacePath);
        logger.info(`[PERM] Fixing permissions for ${workspaceDir}...`);

        // Use a temporary busybox container to chown the directory
        // This works even if the host worker doesn't have root privileges (via Docker)
        const container = await docker.createContainer({
            Image: 'busybox',
            User: 'root',
            name: `fix-perms-${Math.random().toString(36).substring(7)}`,
            HostConfig: {
                Binds: [`${workspaceDir}:/fix`],
                AutoRemove: true
            },
            Cmd: ['chown', '-R', '1000:1000', '/fix']
        });

        await container.start();
        logger.info(`[PERM] Started fix container. Waiting...`);
        const waitResult = await container.wait();
        logger.info(`[PERM] Fix finished. Status: ${JSON.stringify(waitResult)}`);
    } catch (err: any) {
        logger.warn(`[PERM] Failed to fix permissions for ${workspacePath}: ${err.message}`);
    }
}

export async function startOpenClawAgent(agentId: string, config: any, metadata: any = {}, forceDoctor: boolean = false) {
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
                const projectRoot = path.resolve(process.cwd(), process.cwd().includes('packages') ? '../../' : './');
                const workspacePath = path.resolve(projectRoot, 'workspaces', agentId);
                const openclawDir = path.join(workspacePath, '.openclaw');
                if (!fs.existsSync(openclawDir)) {
                    fs.mkdirSync(openclawDir, { recursive: true });
                }
                // Ensure workspace subdirectory exists (agent writes files here)
                const workspaceSubdir = path.join(openclawDir, 'workspace');
                if (!fs.existsSync(workspaceSubdir)) {
                    fs.mkdirSync(workspaceSubdir, { recursive: true });
                }
                const configPath = path.join(openclawDir, 'openclaw.json');
                if (!fs.existsSync(configPath)) {
                    logger.warn(`Config file ${configPath} missing for running container. Re-creating...`);
                    const decrypted = cryptoUtils.decryptConfig(config);

                    // Enable chatCompletions if missing
                    if (!decrypted.gateway?.http?.endpoints?.chatCompletions?.enabled) {
                        decrypted.gateway = {
                            ...(decrypted.gateway || {}),
                            http: {
                                ...(decrypted.gateway?.http || {}),
                                endpoints: {
                                    ...(decrypted.gateway?.http?.endpoints || {}),
                                    chatCompletions: { enabled: true }
                                }
                            }
                        };
                    }

                    // Force correct workspace path
                    decrypted.agents = decrypted.agents || {};
                    decrypted.agents.defaults = decrypted.agents.defaults || {};
                    decrypted.agents.defaults.workspace = '/home/node/.openclaw/workspace';

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

        const projectRoot = path.resolve(process.cwd(), process.cwd().includes('packages') ? '../../' : './');

        // Determine Workspace and Host path (Must be consistent)
        const hostWorkspacesPath = process.env.HOST_WORKSPACES_PATH;
        let workspaceRoot = path.resolve(projectRoot, 'workspaces');

        if (hostWorkspacesPath) {
            workspaceRoot = path.isAbsolute(hostWorkspacesPath)
                ? hostWorkspacesPath
                : path.resolve(projectRoot, hostWorkspacesPath);
        }

        const workspacePath = path.resolve(workspaceRoot, agentId);
        const openclawDir = path.join(workspacePath, '.openclaw');

        if (!fs.existsSync(openclawDir)) {
            logger.info(`Creating openclaw directory at ${openclawDir}`);
            fs.mkdirSync(openclawDir, { recursive: true });
            try {
                fs.chmodSync(openclawDir, 0o700);
            } catch (e) {
                logger.warn(`Failed to set permissions on openclaw dir: ${e}`);
            }
        }

        const hostOpenclawDir = openclawDir; // Since they are now the same physical path

        const configPath = path.join(openclawDir, 'openclaw.json');
        const workspaceSubdir = path.join(openclawDir, 'workspace');

        if (!fs.existsSync(workspaceSubdir)) {
            logger.info(`Creating openclaw workspace subdirectory at ${workspaceSubdir}`);
            fs.mkdirSync(workspaceSubdir, { recursive: true });
        }

        // Explicitly set workspace to a subfolder to match user expectations
        const internalWorkspace = '/home/node/.openclaw/workspace';

        const configWithDefaults = {
            ...config,
            agents: {
                ...(config.agents || {}),
                defaults: {
                    ...(config.agents?.defaults || {}),
                },
                list: [
                    {
                        id: 'main',
                        name: metadata.name || 'OpenClaw Agent',
                        workspace: internalWorkspace
                    }
                ]
            },
            gateway: {
                ...(config.gateway || {}),
                mode: 'local',
                bind: 'lan',
                http: {
                    ...(config.gateway?.http || {}),
                    endpoints: {
                        ...(config.gateway?.http?.endpoints || {}),
                        chatCompletions: {
                            enabled: true
                        }
                    }
                }
            }
        };

        // Force workspace path AFTER the spread so stale DB values can't override it
        configWithDefaults.agents.defaults.workspace = internalWorkspace;

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

        // Ensure Venice AI (and other OpenAI-compatible providers) use openai-responses
        if (configToWrite.models?.providers) {
            for (const provider of Object.values(configToWrite.models.providers) as any[]) {
                if (provider.baseUrl?.includes('venice.ai') || provider.baseUrl?.includes('openai.com')) {
                    if (provider.models) {
                        for (const model of provider.models) {
                            model.api = 'openai-completions';
                        }
                    }
                }
            }
        }

        fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 2));
        try {
            // OpenClaw is sensitive to permissions (similar to SSH keys)
            // It may ignore configs that are group/world readable.
            fs.chmodSync(configPath, 0o600); // -rw-------

            // Tighten the workspace directory too
            const workspaceDir = path.dirname(configPath);
            fs.chmodSync(workspaceDir, 0o700); // drwx------
        } catch (e) {
            logger.warn(`Failed to set permissions on config: ${e}`);
        }

        // Fix permissions recursively for the whole .openclaw dir on the host
        // This handles cases where subfolders like 'agents' or 'identity' were created as root in previous runs
        // Use the host-absolute path (hostOpenclawDir) for the Docker bind mount in the permissions fixer
        await ensureCorrectPermissions(hostOpenclawDir);

        const env = [
            `HOME=/home/node`,
            `OPENCLAW_WORKSPACE_DIR=/home/node/.openclaw`,
            `OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json`,
            `OPENCLAW_GATEWAY_MODE=local`
        ];

        if (finalConfig.gateway?.auth?.token) {
            env.push(`OPENCLAW_GATEWAY_TOKEN=${finalConfig.gateway.auth.token}`);
        }

        // Fetch User Tier and Project Tier for Security Enforcement
        const { data: agentData, error: agentError } = await supabase
            .from('agents')
            .select(`
                project_id,
                projects (
                    user_id,
                    tier
                )
            `)
            .eq('id', agentId)
            .single();

        if (agentError || !agentData) {
            logger.error(`Failed to fetch project/tier info for agent ${agentId}: ${agentError?.message}`);
        }

        // specific casting because supabase types might be loose here in the worker
        const userTier = (agentData?.projects as any)?.tier as UserTier || UserTier.FREE;
        const requestedLevel = (metadata?.security_level as SecurityLevel) || SecurityLevel.SANDBOX;

        // Resolve Effective Security Level
        const effectiveLevel = resolveSecurityLevel(userTier, requestedLevel);

        // Apply Security Context
        let user = '1000:1000'; // Standardized to UID 1000 (node) for better host compatibility
        let capAdd: string[] = [];
        const binds = [`${hostOpenclawDir}:/home/node/.openclaw`];

        switch (effectiveLevel) {
            case SecurityLevel.ROOT:
                // user = '0:0'; // Removed to satisfy user request for 'node' user
                capAdd = ['SYS_ADMIN', 'NET_ADMIN'];
                logger.warn(`🚀 Agent ${agentId} starting in ROOT security level (running as node user)`);
                break;
            case SecurityLevel.SYSADMIN:
                capAdd = ['SYS_ADMIN'];
                logger.info(`🛡️ Agent ${agentId} starting in SYSADMIN security level`);
                break;
            case SecurityLevel.SANDBOX:
            default:
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

        // Use the CLI entrypoint (openclaw.mjs) for proper bootstrapping
        const commonArgs = ['gateway', '--bind', 'lan', '--allow-unconfigured'];

        const cmd = forceDoctor
            ? ['sh', '-c', `node openclaw.mjs doctor --fix --non-interactive --yes && node openclaw.mjs ${commonArgs.join(' ')}`]
            : ['node', 'openclaw.mjs', ...commonArgs];

        const newContainer = await docker.createContainer({
            Image: OPENCLAW_IMAGE,
            User: user,
            name: containerName,
            Env: env,
            Cmd: cmd,
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
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'stopping'
        });

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
        // Ensure we mark as stopped if the container is gone
        if (err.message.includes('no such container') || err.message.includes('404')) {
            await supabase.from('agent_actual_state').upsert({
                agent_id: agentId,
                status: 'stopped',
                endpoint_url: null,
                last_sync: new Date().toISOString()
            });
        }
    }
}

export async function runTerminalCommand(agentId: string, command: string): Promise<string> {
    const containerName = getAgentContainerName(agentId, 'openclaw');
    try {
        // Fetch security level to determine working directory
        const { data: actual } = await supabase
            .from('agent_actual_state')
            .select('effective_security_tier')
            .eq('agent_id', agentId)
            .single();

        const securityLevel = parseInt(actual?.effective_security_tier || '0');

        // Allowed to navigate anywhere (restricted by Docker User)
        const workingDir = securityLevel >= 1 ? '/' : '/home/node/.openclaw';

        const exec = await docker.createExec(containerName, {
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            WorkingDir: workingDir,
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
