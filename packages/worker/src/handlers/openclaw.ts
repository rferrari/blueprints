import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, sanitizeConfig } from '../lib/utils';
import { DOCKER_NETWORK_NAME, OPENCLAW_IMAGE, VPS_PUBLIC_IP } from '../lib/constants';
import { cryptoUtils } from '@eliza-manager/shared/crypto';
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

        // Managed Provider Keys: validate lease before starting
        if (process.env.ENABLE_MANAGED_KEYS === 'true' && metadata?.lease_id) {
            const { validateAgentLease, stopAgentForInvalidLease } = await import('../lib/lease-resolver');
            const leaseResult = await validateAgentLease(agentId, metadata);
            if (leaseResult && !leaseResult.valid) {
                logger.warn(`Agent ${agentId}: lease invalid — ${leaseResult.error}`);
                await stopAgentForInvalidLease(agentId, leaseResult.error || 'Invalid lease');
                return;
            }
        }

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

        const agentsDataContainerPath = process.env.AGENTS_DATA_CONTAINER_PATH || './workspaces';
        const agentsDataHostPath = process.env.AGENTS_DATA_HOST_PATH || './workspaces';

        const absoluteContainerPath = path.isAbsolute(agentsDataContainerPath)
            ? agentsDataContainerPath
            : path.resolve(process.cwd(), agentsDataContainerPath);

        const absoluteHostPath = path.isAbsolute(agentsDataHostPath)
            ? agentsDataHostPath
            : path.resolve(process.cwd(), agentsDataHostPath);

        const agentRootPath = path.join(absoluteContainerPath, agentId);
        const homeDir = path.join(agentRootPath, 'home');
        const openclawDir = path.join(homeDir, '.openclaw');

        fs.mkdirSync(openclawDir, { recursive: true });
        fs.mkdirSync(path.join(openclawDir, 'workspace'), { recursive: true });

        // Ensure the agent (running as node:1000) can write to these volumes
        try {
            const { execSync } = require('child_process');
            execSync(`chown -R 1000:1000 "${homeDir}"`);
        } catch (e: any) {
            logger.warn(`Failed to chown agent directory ${homeDir}: ${e.message}`);
        }

        const configPath = path.join(openclawDir, 'openclaw.json');

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

        // Force workspace path in the config to match what we expect in the container
        if (!finalConfig.agents) finalConfig.agents = {};
        if (!finalConfig.agents.defaults) finalConfig.agents.defaults = {};
        finalConfig.agents.defaults.workspace = "/agent-home/.openclaw/workspace";

        // Also force for any specific agent in the list to avoid UUID suffixes
        if (Array.isArray(finalConfig.agents.list)) {
            finalConfig.agents.list.forEach((a: any) => {
                a.workspace = "/agent-home/.openclaw/workspace";

                // CRITICAL: Synchronize the agent ID with the database UUID.
                // If we don't do this, the message bus (which uses the UUID in x-openclaw-agent-id)
                // won't match the config ID ("main"), causing OpenClaw to auto-generate
                // a new agent entry with a "workspace-<uuid>" suffix.
                if (a.id === 'main' || finalConfig.agents.list.length === 1) {
                    a.id = agentId;
                }
            });
        }

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
            `HOME=/agent-home`,
            `OPENCLAW_CONFIG_PATH=/agent-home/.openclaw/openclaw.json`,
            `OPENCLAW_GATEWAY_MODE=local`,
            `OPENCLAW_WORKSPACE_DIR=/agent-home/.openclaw/workspace`
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
        const requestedLevel = metadata?.security_level || SecurityLevel.STANDARD;
        const effectiveLevel = resolveSecurityLevel(userTier, requestedLevel);

        let capAdd: string[] = [];
        let readonlyRoot = true;
        let user = 'node';

        switch (effectiveLevel) {
            case SecurityLevel.STANDARD:
                readonlyRoot = true;
                capAdd = [];
                user = 'node';
                break;

            case SecurityLevel.PRO:
                readonlyRoot = true;
                capAdd = ['SYS_ADMIN'];
                user = 'node';
                break;

            case SecurityLevel.ADVANCED:
                readonlyRoot = false;
                capAdd = ['SYS_ADMIN', 'NET_ADMIN'];
                user = 'node';
                break;

            case SecurityLevel.ROOT:
                readonlyRoot = false;
                capAdd = ['SYS_ADMIN', 'NET_ADMIN'];
                user = 'root';
                break;
        }

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
                Binds: [`${path.join(absoluteHostPath, agentId, 'home')}:/agent-home`],
                PortBindings: { '18789/tcp': [{ HostPort: hostPort.toString(), HostIp: '127.0.0.1' }] },
                RestartPolicy: { Name: 'unless-stopped' },

                CapAdd: capAdd,
                CapDrop: effectiveLevel === SecurityLevel.STANDARD ? ['ALL'] : undefined,

                ReadonlyRootfs: readonlyRoot,
                User: user,

                SecurityOpt: effectiveLevel === SecurityLevel.STANDARD
                    ? ['no-new-privileges']
                    : undefined,

                Tmpfs: effectiveLevel === SecurityLevel.STANDARD
                    ? { '/tmp': 'rw,noexec,nosuid,size=64m' }
                    : undefined
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
            effective_security_tier: effectiveLevel.toString(),
            error_message: null
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
            WorkingDir: '/agent-home',
            Cmd: ['sh', '-c', command]
        });

        const result = await docker.startExec(exec.Id, { Detach: false, Tty: true });
        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
        logger.error(`Terminal Error for ${agentId}:`, err.message);
        return `Error: ${err.message}`;
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
