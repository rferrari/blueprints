import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, sanitizeConfig } from '../lib/utils';
import { DOCKER_NETWORK_NAME, OPENCLAW_IMAGE, VPS_PUBLIC_IP } from '../lib/constants';
import { cryptoUtils } from '../lib/crypto';
import { UserTier, SecurityLevel, resolveSecurityLevel } from '@eliza-manager/shared';

export async function startOpenClawAgent(agentId: string, config: any, metadata: any = {}, forceDoctor: boolean = false) {
    logger.info(`Starting OpenClaw agent ${agentId}...`);

    try {
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'starting'
        });

        const containerName = getAgentContainerName(agentId, 'openclaw');

        // Safe deterministic port
        const hash = [...agentId].reduce((a, c) => a + c.charCodeAt(0), 0);
        const hostPort = 19000 + (hash % 1000);

        const endpointUrl = `http://${VPS_PUBLIC_IP}:${hostPort}`;

        // Remove existing container if present
        try {
            const existing = await docker.getContainer(containerName);
            await existing.remove();
        } catch {
        }

        const projectRoot = path.resolve(process.cwd(), process.cwd().includes('packages') ? '../../' : './');

        const hostWorkspacesPath = process.env.HOST_WORKSPACES_PATH;
        const workspaceRoot = hostWorkspacesPath
            ? path.resolve(projectRoot, hostWorkspacesPath)
            : path.resolve(projectRoot, 'workspaces');

        const workspacePath = path.join(workspaceRoot, agentId);
        const openclawDir = path.join(workspacePath, '.openclaw');
        const workspaceSubdir = path.join(openclawDir, 'workspace');

        // Create host directories FIRST
        fs.mkdirSync(workspaceSubdir, { recursive: true });
        fs.closeSync(fs.openSync(workspaceSubdir, 'r'));


        const configPath = path.join(openclawDir, 'openclaw.json');

        const internalWorkspace = '/home/node/.openclaw/workspace';

        const configWithDefaults = {
            ...config,
            gateway: {
                ...(config.gateway || {}),
                mode: 'local',
                bind: 'lan',
                http: {
                    ...(config.gateway?.http || {}),
                    endpoints: {
                        ...(config.gateway?.http?.endpoints || {}),
                        chatCompletions: { enabled: true }
                    }
                }
            }
        };

        const decrypted = cryptoUtils.decryptConfig(configWithDefaults);
        const finalConfig = sanitizeConfig(decrypted);

        // Self heal DB
        if (JSON.stringify(decrypted) !== JSON.stringify(finalConfig)) {
            const encrypted = cryptoUtils.encryptConfig(finalConfig);
            await supabase.from('agent_desired_state').update({ config: encrypted }).eq('agent_id', agentId);
        }

        const configToWrite = { ...finalConfig };
        delete configToWrite.blueprints_chat;
        delete configToWrite.metadata;

        fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 2));

        const env = [
            `HOME=/home/node`,
            `OPENCLAW_WORKSPACE_DIR=${internalWorkspace}`,
            `OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json`,
            `OPENCLAW_GATEWAY_MODE=local`
        ];

        if (finalConfig.gateway?.auth?.token) {
            env.push(`OPENCLAW_GATEWAY_TOKEN=${finalConfig.gateway.auth.token}`);
        }

        // Fetch tier
        const { data } = await supabase
            .from('agents')
            .select(`projects ( tier )`)
            .eq('id', agentId)
            .single();

        // const userTier = (data?.projects as any)?.tier as UserTier || UserTier.FREE;
        const userTier = (data?.projects as any)?.tier ?? UserTier.FREE;

        const requestedLevel = metadata?.security_level || SecurityLevel.SANDBOX;
        const effectiveLevel = resolveSecurityLevel(userTier, requestedLevel);

        let capAdd: string[] = [];

        switch (effectiveLevel) {
            case SecurityLevel.ROOT:
                capAdd = ['SYS_ADMIN', 'NET_ADMIN'];
                break;
            case SecurityLevel.SYSADMIN:
                capAdd = ['SYS_ADMIN'];
                break;
        }

        try {
            await docker.inspectImage(OPENCLAW_IMAGE);
        } catch {
            await docker.pullImage(OPENCLAW_IMAGE);
        }


        const commonArgs = ['gateway', '--bind', 'lan', '--allow-unconfigured'];

        const innerCmd = forceDoctor
            ? `node openclaw.mjs doctor --fix --non-interactive --yes && node openclaw.mjs ${commonArgs.join(' ')}`
            : `node openclaw.mjs ${commonArgs.join(' ')}`;

        // ROOT bootstrap → chown → drop to node
        const cmd = [
            'sh',
            '-c',
            `
            chown -R 1000:1000 /home/node/.openclaw &&
            sleep 0.2 &&
            exec su node -c "${innerCmd}"
            `
        ];

        const newContainer = await docker.createContainer({
            Image: OPENCLAW_IMAGE,
            User: '0:0',
            name: containerName,
            Env: env,
            Cmd: cmd,
            ExposedPorts: { '18789/tcp': {} },
            HostConfig: {
                Binds: [`${openclawDir}:/home/node/.openclaw`],
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
        throw err;
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
        // const { data: actual } = await supabase
        //     .from('agent_actual_state')
        //     .select('effective_security_tier')
        //     .eq('agent_id', agentId)
        //     .single();

        // const securityLevel = parseInt(actual?.effective_security_tier || '0');

        // // Allowed to navigate anywhere (restricted by Docker User)
        // const workingDir = securityLevel >= 1 ? '/' : '/home/node/.openclaw';

        const exec = await docker.createExec(containerName, {
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            // WorkingDir: workingDir, // TODO: Re-enable when we figure out the permissions
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
