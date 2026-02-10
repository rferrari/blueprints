import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, sanitizeConfig } from '../lib/utils';
import { DOCKER_NETWORK_NAME, OPENCLAW_IMAGE, VPS_PUBLIC_IP } from '../lib/constants';
import { cryptoUtils } from '../lib/crypto';
import { UserTier, SecurityLevel, resolveSecurityLevel } from '@eliza-manager/shared';

export async function startOpenClawAgent(
    agentId: string,
    config: any,
    metadata: any = {},
    forceDoctor = false
) {
    logger.info(`Starting OpenClaw agent ${agentId} (doctor=${forceDoctor})...`);

    try {
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'starting'
        });

        const containerName = getAgentContainerName(agentId, 'openclaw');

        const hash = [...agentId].reduce((a, c) => a + c.charCodeAt(0), 0);
        const hostPort = 19000 + (hash % 1000);
        const endpointUrl = `http://${VPS_PUBLIC_IP}:${hostPort}`;

        // Remove old container
        try {
            const existing = await docker.getContainer(containerName);
            await existing.stop();
            await existing.remove();
        } catch { }

        const projectRoot = path.resolve(process.cwd(), process.cwd().includes('packages') ? '../../' : './');

        const workspaceRoot = process.env.HOST_WORKSPACES_PATH
            ? path.resolve(projectRoot, process.env.HOST_WORKSPACES_PATH)
            : path.resolve(projectRoot, 'workspaces');

        const workspacePath = path.join(workspaceRoot, agentId);
        const homeDir = path.join(workspacePath, 'home');

        fs.mkdirSync(homeDir, { recursive: true });

        const configPath = path.join(homeDir, '.openclaw', 'openclaw.json');
        fs.mkdirSync(path.dirname(configPath), { recursive: true });

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

        if (JSON.stringify(decrypted) !== JSON.stringify(finalConfig)) {
            await supabase
                .from('agent_desired_state')
                .update({ config: cryptoUtils.encryptConfig(finalConfig) })
                .eq('agent_id', agentId);
        }

        const configToWrite = { ...finalConfig };
        delete configToWrite.blueprints_chat;
        delete configToWrite.metadata;

        fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 2));

        const env = [
            `HOME=/home/node`,
            `OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json`,
            `OPENCLAW_GATEWAY_MODE=local`
        ];

        if (finalConfig.gateway?.auth?.token) {
            env.push(`OPENCLAW_GATEWAY_TOKEN=${finalConfig.gateway.auth.token}`);
        }

        const { data } = await supabase
            .from('agents')
            .select(`projects ( tier )`)
            .eq('id', agentId)
            .single();

        const userTier = (data?.projects as any)?.tier ?? UserTier.FREE;
        const requestedLevel = metadata?.security_level || SecurityLevel.SANDBOX;
        const effectiveLevel = resolveSecurityLevel(userTier, requestedLevel);

        let capAdd: string[] = [];

        if (effectiveLevel === SecurityLevel.ROOT) capAdd = ['SYS_ADMIN', 'NET_ADMIN'];
        if (effectiveLevel === SecurityLevel.SYSADMIN) capAdd = ['SYS_ADMIN'];

        try {
            await docker.inspectImage(OPENCLAW_IMAGE);
        } catch {
            await docker.pullImage(OPENCLAW_IMAGE);
        }

        const commonArgs = ['gateway', '--bind', 'lan', '--allow-unconfigured'];

        const cmd = [
            'sh',
            '-c',
            `cd /app && ${forceDoctor
                ? `node openclaw.mjs doctor --fix --non-interactive --yes && exec node openclaw.mjs ${commonArgs.join(' ')}`
                : `exec node openclaw.mjs ${commonArgs.join(' ')}`
            }`
        ];

        const container = await docker.createContainer({
            Image: OPENCLAW_IMAGE,
            name: containerName,
            Env: env,
            Cmd: cmd,
            ExposedPorts: { '18789/tcp': {} },
            HostConfig: {
                Binds: [`${homeDir}:/home/node`],
                PortBindings: { '18789/tcp': [{ HostPort: hostPort.toString() }] },
                RestartPolicy: { Name: 'unless-stopped' },
                CapAdd: capAdd,
                ReadonlyRootfs: effectiveLevel === SecurityLevel.SANDBOX
            },
            NetworkingConfig: {
                EndpointsConfig: { [DOCKER_NETWORK_NAME]: {} }
            }
        });

        await container.start();

        // Give OpenClaw time to boot
        await new Promise(r => setTimeout(r, 5000));

        const inspect = await container.inspect();

        if (!inspect.State.Running && !forceDoctor) {
            logger.warn(`Agent ${agentId} failed boot — retrying with doctor`);
            return startOpenClawAgent(agentId, config, metadata, true);
        }

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

export async function runTerminalCommand(agentId: string, command: string): Promise<string> {
    const containerName = getAgentContainerName(agentId, 'openclaw');

    try {
        const exec = await docker.createExec(containerName, {
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            WorkingDir: '/home/node',
            Cmd: ['sh', '-c', command]
        });

        const result = await docker.startExec(exec.Id, { Detach: false, Tty: true });
        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
        logger.error(`Terminal Error for ${agentId}:`, err.message);
        return `Error: ${err.message}`;
    }
}
