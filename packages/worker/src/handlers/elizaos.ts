import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, renameKey } from '../lib/utils';
import { DOCKER_NETWORK_NAME, ELIZAOS_IMAGE_BASE } from '../lib/constants';
import { cryptoUtils } from '@eliza-manager/shared/crypto';

// Project-level lock to prevent concurrent modifications to the same shared container
const projectLocks = new Map<string, Promise<void>>();

async function withLock(projectId: string, fn: () => Promise<void>) {
    while (projectLocks.has(projectId)) {
        await projectLocks.get(projectId);
    }
    const promise = fn();
    projectLocks.set(projectId, promise);
    try {
        await promise;
    } finally {
        projectLocks.delete(projectId);
    }
}

function resolvePath(envPath: string | undefined, fallback: string): string {
    const p = envPath || fallback;
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function getAgentContainerPath(agentId: string, projectId?: string) {
    const root = resolvePath(process.env.AGENTS_DATA_CONTAINER_PATH, './workspaces');
    return projectId ? path.join(root, projectId) : path.join(root, agentId);
}

function getAgentHostPath(agentId: string, projectId?: string) {
    const root = resolvePath(process.env.AGENTS_DATA_HOST_PATH, './workspaces');
    return projectId ? path.join(root, projectId) : path.join(root, agentId);
}

export async function startElizaOSAgent(agentId: string, config: any, projectId?: string) {
    logger.info(`Starting ElizaOS agent ${agentId} (Project: ${projectId || 'legacy'})`);

    await supabase.from('agent_actual_state').upsert({
        agent_id: agentId,
        status: 'starting'
    });

    if (projectId) {
        await withLock(projectId, async () => {
            await doStartElizaOS(agentId, config, projectId);
        });
    } else {
        await doStartElizaOS(agentId, config);
    }
}

async function doStartElizaOS(agentId: string, config: any, projectId?: string) {
    const containerName = getAgentContainerName(agentId, 'elizaos', projectId);
    let containerRunning = false;

    try {
        const existing = await docker.getContainer(containerName);
        const info = await existing.inspect();

        if (info.State.Status === 'running') {
            containerRunning = true;
        } else {
            await existing.remove();
        }
    } catch { }

    const decrypted = cryptoUtils.decryptConfig(config);
    let finalConfig = renameKey(decrypted, 'lore', 'knowledge');

    // Fix: modelProvider is not a valid key in the character schema.
    // We transform it into a plugin and remove the key to pass validation.
    if (finalConfig.modelProvider) {
        const provider = finalConfig.modelProvider.toLowerCase();
        const providerPlugin = `@elizaos/plugin-${provider}`;

        if (!finalConfig.plugins) finalConfig.plugins = [];
        if (!finalConfig.plugins.includes(providerPlugin)) {
            finalConfig.plugins.push(providerPlugin);
        }

        // Ensure settings.model matches if not set
        if (!finalConfig.settings) finalConfig.settings = {};
        if (!finalConfig.settings.model && provider === 'openai') {
            finalConfig.settings.model = 'gpt-4'; // default fallback
        }

        delete finalConfig.modelProvider;
    }

    const agentName = finalConfig.name || agentId;

    // === project/agent home ===
    const agentContainerRoot = getAgentContainerPath(agentId, projectId);
    const agentHome = path.join(agentContainerRoot, 'home');
    fs.mkdirSync(agentHome, { recursive: true });

    // Ensure permissions
    try {
        const { execSync } = require('child_process');
        execSync(`chown -R 1000:1000 "${agentHome}"`);
    } catch (e: any) {
        logger.warn(`Failed to chown elizaos directory ${agentHome}: ${e.message}`);
    }

    // Agent-specific character file
    const characterPath = path.join(agentHome, `${agentId}.json`);
    fs.writeFileSync(characterPath, JSON.stringify(finalConfig, null, 2));

    if (containerRunning) {
        logger.info(`Adding agent ${agentId} to running container ${containerName}`);
        try {
            const exec = await docker.createExec(containerName, {
                Cmd: ['/bin/bash', '-c', `export PATH="/root/.bun/bin:$PATH"; elizaos agent start --path "/agent-home/${agentId}.json"`],
                AttachStdout: true,
                AttachStderr: true
            });
            await docker.startExec(exec.Id, { Detach: false });
            logger.info(`Agent ${agentId} started dynamically in ${containerName}`);
        } catch (err: any) {
            logger.error(`Failed to dynamically start agent ${agentId}: ${err.message}`);
            // Fallback: Restart container? No, let reconciler handle retry or report error.
            throw err;
        }
    } else {
        // Ensure image
        try {
            await docker.inspectImage(ELIZAOS_IMAGE_BASE);
        } catch {
            await docker.pullImage(ELIZAOS_IMAGE_BASE);
        }

        await docker.createContainer({
            Image: ELIZAOS_IMAGE_BASE,
            name: containerName,
            User: '1000:1000',

            Cmd: [
                'elizaos',
                'start',
                '--character', `/agent-home/${agentId}.json`
            ],

            Env: [
                `AGENT_ID=${agentId}`,
                `HOME=/agent-home`
            ],

            HostConfig: {
                Binds: [
                    `${path.join(getAgentHostPath(agentId, projectId), 'home')}:/agent-home`
                ],
                RestartPolicy: { Name: 'unless-stopped' }
            },

            NetworkingConfig: {
                EndpointsConfig: {
                    [DOCKER_NETWORK_NAME]: {}
                }
            }
        });

        const container = await docker.getContainer(containerName);
        await container.start();
        logger.info(`Container ${containerName} started with agent ${agentId}`);
    }

    // Detect version
    let detectedVersion = 'unknown';
    try {
        const execInfo = await docker.createExec(containerName, {
            Cmd: ['/usr/local/bin/elizaos', '--version'],
            AttachStdout: true,
            AttachStderr: true
        });
        const output = await docker.startExec(execInfo.Id, { Detach: false });
        detectedVersion = output.trim().replace(/[^\x20-\x7E\n]/g, '');
    } catch { }

    await supabase.from('agent_actual_state').upsert({
        agent_id: agentId,
        status: 'running',
        last_sync: new Date().toISOString(),
        error_message: null,
        version: detectedVersion
    });
}

export async function hotReloadElizaOS(agentId: string, config: any, projectId?: string) {
    const containerName = getAgentContainerName(agentId, 'elizaos', projectId);

    const decrypted = cryptoUtils.decryptConfig(config);
    const finalConfig = renameKey(decrypted, 'lore', 'knowledge');

    const agentHome = path.join(getAgentContainerPath(agentId, projectId), 'home');
    const characterPath = path.join(agentHome, `${agentId}.json`);

    fs.writeFileSync(characterPath, JSON.stringify(finalConfig, null, 2));

    const exec = await docker.createExec(containerName, {
        Cmd: ['/bin/bash', '-c', `export PATH="/root/.bun/bin:$PATH"; elizaos agent set --path "/agent-home/${agentId}.json"`],
        AttachStdout: true,
        AttachStderr: true
    });

    await docker.startExec(exec.Id, {
        Detach: false,
        Tty: true
    });

    logger.info(`ElizaOS ${agentId} reloaded`);
}

export async function runElizaOSCommand(agentId: string, command: string, projectId?: string): Promise<string> {
    const containerName = getAgentContainerName(agentId, 'elizaos', projectId);

    try {
        const exec = await docker.createExec(containerName, {
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Cmd: ['/bin/bash', '-c', `export PATH="/root/.bun/bin:$PATH"; ${command}`]
        });

        const result = await docker.startExec(exec.Id, {
            Detach: false,
            Tty: true
        });

        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
        logger.error(`ElizaOS terminal error for ${agentId}:`, err.message);
        return `Error: ${err.message}`;
    }
}

export async function stopElizaOSAgent(agentId: string, projectId?: string) {
    const containerName = getAgentContainerName(agentId, 'elizaos', projectId);

    await supabase.from('agent_actual_state').upsert({
        agent_id: agentId,
        status: 'stopping'
    });

    if (projectId) {
        await withLock(projectId, async () => {
            await doStopElizaOS(agentId, projectId);
        });
    } else {
        await doStopElizaOS(agentId);
    }
}

async function doStopElizaOS(agentId: string, projectId?: string) {
    const containerName = getAgentContainerName(agentId, 'elizaos', projectId);

    try {
        const container = await docker.getContainer(containerName);
        const info = await container.inspect();

        if (info.State.Status === 'running') {
            // Try to stop just this agent via CLI first
            // We need the name. We'll try to find it from the file on host.
            const agentHome = path.join(getAgentContainerPath(agentId, projectId), 'home');
            const characterPath = path.join(agentHome, `${agentId}.json`);
            let agentName = agentId;
            try {
                const charData = JSON.parse(fs.readFileSync(characterPath, 'utf-8'));
                agentName = charData.name || agentId;
            } catch { }

            logger.info(`Stopping ElizaOS agent ${agentName} in container ${containerName}`);
            const exec = await docker.createExec(containerName, {
                Cmd: ['/bin/bash', '-c', `export PATH="/root/.bun/bin:$PATH"; elizaos agent stop --name "${agentName}"`],
                AttachStdout: true,
                AttachStderr: true
            });
            await docker.startExec(exec.Id, { Detach: false });

            // Check if any other ElizaOS agents are still enabled for this project
            if (projectId) {
                const { data: others } = await supabase
                    .from('agents')
                    .select('id, agent_desired_state(enabled)')
                    .eq('project_id', projectId)
                    .eq('framework', 'elizaos')
                    .neq('id', agentId) as any;

                const stillRunning = others?.some((o: any) => o.agent_desired_state?.enabled);

                if (!stillRunning) {
                    logger.info(`No more agents in project ${projectId}. Stopping container.`);
                    await container.stop();
                    await container.remove();
                }
            } else {
                await container.stop();
                await container.remove();
            }
        } else {
            await container.remove();
        }

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'stopped',
            endpoint_url: null,
            last_sync: new Date().toISOString()
        });
    } catch (err: any) {
        logger.warn(`Failed to stop ElizaOS agent ${agentId}:`, err.message);
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
