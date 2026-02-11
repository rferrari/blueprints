import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, renameKey } from '../lib/utils';
import { DOCKER_NETWORK_NAME, ELIZA_IMAGE_BASE } from '../lib/constants';
import { cryptoUtils } from '@eliza-manager/shared/crypto';

function getAgentWorkspace(agentId: string) {
    const root = process.env.HOST_WORKSPACES_PATH;
    if (!root) throw new Error('HOST_WORKSPACES_PATH not set');

    return path.join(root, 'workspaces', agentId);
}

export async function startElizaAgent(agentId: string, config: any) {
    logger.info(`Starting Eliza agent ${agentId}`);

    await supabase.from('agent_actual_state').upsert({
        agent_id: agentId,
        status: 'starting'
    });

    const containerName = getAgentContainerName(agentId, 'eliza');

    try {
        const existing = await docker.getContainer(containerName);
        const info = await existing.inspect();

        if (info.State.Status === 'running') {
            await hotReloadEliza(agentId, config);
            return;
        }

        await existing.remove();
    } catch { }

    const decrypted = cryptoUtils.decryptConfig(config);
    const finalConfig = renameKey(decrypted, 'lore', 'knowledge');

    // === shared workspace ===
    const agentWorkspace = getAgentWorkspace(agentId);
    fs.mkdirSync(agentWorkspace, { recursive: true });

    const characterPath = path.join(agentWorkspace, 'character.json');
    fs.writeFileSync(characterPath, JSON.stringify(finalConfig, null, 2));

    // Ensure image
    try {
        await docker.inspectImage(ELIZA_IMAGE_BASE);
    } catch {
        await docker.pullImage(ELIZA_IMAGE_BASE);
    }

    await docker.createContainer({
        Image: ELIZA_IMAGE_BASE,
        name: containerName,
        User: '1000:1000',

        Cmd: [
            'elizaos',
            'start',
            `/agents/${agentId}/character.json`
        ],

        Env: [`AGENT_ID=${agentId}`],

        HostConfig: {
            Binds: [
                `${agentWorkspace}:/agents/${agentId}`
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

    await supabase.from('agent_actual_state').upsert({
        agent_id: agentId,
        status: 'running',
        last_sync: new Date().toISOString(),
        error_message: null
    });
}

export async function hotReloadEliza(agentId: string, config: any) {
    const containerName = getAgentContainerName(agentId, 'eliza');

    const decrypted = cryptoUtils.decryptConfig(config);
    const finalConfig = renameKey(decrypted, 'lore', 'knowledge');

    const agentWorkspace = getAgentWorkspace(agentId);
    const characterPath = path.join(agentWorkspace, 'character.json');

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


    logger.info(`Eliza ${agentId} reloaded`);
}

export async function runElizaCommand(agentId: string, command: string): Promise<string> {
    const containerName = getAgentContainerName(agentId, 'eliza');

    try {
        const exec = await docker.createExec(containerName, {
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,

            // Run through shell so users can chain commands
            Cmd: ['sh', '-c', command]
        });

        logger.info(`Eliza: Exec ${exec.Id} → ${command}`);

        const result = await docker.startExec(exec.Id, {
            Detach: false,
            Tty: true
        });

        return typeof result === 'string'
            ? result
            : JSON.stringify(result);

    } catch (err: any) {
        logger.error(`Eliza terminal error for ${agentId}:`, err.message);
        return `Error: ${err.message}`;
    }
}


export async function stopElizaAgent(agentId: string) {
    const containerName = getAgentContainerName(agentId, 'eliza');
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
        logger.warn(`Failed to stop Eliza agent ${agentId}:`, err.message);
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
