import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, renameKey } from '../lib/utils';
import { DOCKER_NETWORK_NAME, ELIZAOS_IMAGE_BASE } from '../lib/constants';
import { cryptoUtils } from '@eliza-manager/shared/crypto';

function resolvePath(envPath: string | undefined, fallback: string): string {
    const p = envPath || fallback;
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function getAgentContainerPath(agentId: string) {
    const root = resolvePath(process.env.AGENTS_DATA_CONTAINER_PATH, './workspaces');
    return path.join(root, agentId);
}

function getAgentHostPath(agentId: string) {
    const root = resolvePath(process.env.AGENTS_DATA_HOST_PATH, './workspaces');
    return path.join(root, agentId);
}

export async function startElizaOSAgent(agentId: string, config: any) {
    logger.info(`Starting ElizaOS agent ${agentId}`);

    await supabase.from('agent_actual_state').upsert({
        agent_id: agentId,
        status: 'starting'
    });

    const containerName = getAgentContainerName(agentId, 'elizaos');

    try {
        const existing = await docker.getContainer(containerName);
        const info = await existing.inspect();

        if (info.State.Status === 'running') {
            await hotReloadElizaOS(agentId, config);
            return;
        }

        await existing.remove();
    } catch { }

    const decrypted = cryptoUtils.decryptConfig(config);
    const finalConfig = renameKey(decrypted, 'lore', 'knowledge');

    // === agent home ===
    const agentContainerRoot = getAgentContainerPath(agentId);
    const agentHome = path.join(agentContainerRoot, 'home');
    fs.mkdirSync(agentHome, { recursive: true });

    // Ensure the agent (running as 1000:1000) can write to its home
    try {
        const { execSync } = require('child_process');
        execSync(`chown -R 1000:1000 "${agentHome}"`);
    } catch (e: any) {
        logger.warn(`Failed to chown elizaos agent directory ${agentHome}: ${e.message}`);
    }

    const characterPath = path.join(agentHome, 'character.json');
    fs.writeFileSync(characterPath, JSON.stringify(finalConfig, null, 2));

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
            '/agent-home/character.json'
        ],

        Env: [
            `AGENT_ID=${agentId}`,
            `HOME=/agent-home`
        ],

        HostConfig: {
            Binds: [
                `${path.join(getAgentHostPath(agentId), 'home')}:/agent-home`
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

    // Detect version from container
    let detectedVersion = 'unknown';
    try {
        const execInfo = await docker.createExec(containerName, {
            Cmd: ['elizaos', '--version'],
            AttachStdout: true,
            AttachStderr: true
        });
        const output = await docker.startExec(execInfo.Id, { Detach: false });
        detectedVersion = output.trim().replace(/[^\x20-\x7E\n]/g, '');
        logger.info(`Detected ElizaOS version ${detectedVersion} for agent ${agentId}`);
    } catch (vErr: any) {
        logger.warn(`Could not detect version for ElizaOS agent ${agentId}: ${vErr.message}`);
    }

    await supabase.from('agent_actual_state').upsert({
        agent_id: agentId,
        status: 'running',
        last_sync: new Date().toISOString(),
        error_message: null,
        version: detectedVersion
    });
}

export async function hotReloadElizaOS(agentId: string, config: any) {
    const containerName = getAgentContainerName(agentId, 'elizaos');

    const decrypted = cryptoUtils.decryptConfig(config);
    const finalConfig = renameKey(decrypted, 'lore', 'knowledge');

    const agentHome = path.join(getAgentContainerPath(agentId), 'home');
    const characterPath = path.join(agentHome, 'character.json');

    fs.writeFileSync(characterPath, JSON.stringify(finalConfig, null, 2));

    const exec = await docker.createExec(containerName, {
        Cmd: ['elizaos', 'reload'],
        AttachStdout: true,
        AttachStderr: true
    });

    await docker.startExec(exec.Id, {
        Detach: false,
        Tty: true
    });


    logger.info(`ElizaOS ${agentId} reloaded`);
}

export async function runElizaOSCommand(agentId: string, command: string): Promise<string> {
    const containerName = getAgentContainerName(agentId, 'elizaos');

    try {
        const exec = await docker.createExec(containerName, {
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,

            // Run through shell so users can chain commands
            Cmd: ['sh', '-c', command]
        });

        logger.info(`ElizaOS: Exec ${exec.Id} → ${command}`);

        const result = await docker.startExec(exec.Id, {
            Detach: false,
            Tty: true
        });

        return typeof result === 'string'
            ? result
            : JSON.stringify(result);

    } catch (err: any) {
        logger.error(`ElizaOS terminal error for ${agentId}:`, err.message);
        return `Error: ${err.message}`;
    }
}


export async function stopElizaOSAgent(agentId: string) {
    const containerName = getAgentContainerName(agentId, 'elizaos');
    try {
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'stopping'
        });

        const container = await docker.getContainer(containerName);
        await container.stop();
        await container.remove();

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'stopped',
            endpoint_url: null,
            last_sync: new Date().toISOString()
        });
    } catch (err: any) {
        logger.warn(`Failed to stop ElizaOS agent ${agentId}:`, err.message);
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
