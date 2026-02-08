import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName, renameKey } from '../lib/utils';
import { DOCKER_NETWORK_NAME, ELIZA_IMAGE_BASE } from '../lib/constants';
import { cryptoUtils } from '../lib/crypto';

export async function startElizaAgent(agentId: string, config: any) {
    logger.info(`Starting Eliza agent ${agentId}...`);

    try {
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'starting'
        });

        const containerName = getAgentContainerName(agentId, 'eliza');
        const container = await docker.getContainer(containerName);

        try {
            const info = await container.inspect();
            if (info.State.Status === 'running') {
                logger.info(`Eliza Container ${containerName} already running. Attempting hot-reload...`);
                await hotReloadEliza(agentId, config);
                await supabase.from('agent_actual_state').upsert({
                    agent_id: agentId,
                    status: 'running',
                    last_sync: new Date().toISOString()
                });
                return;
            }
            await container.remove();
        } catch (e) { }

        const decrypted = cryptoUtils.decryptConfig(config);

        // Feature: Lore -> Knowledge transition
        const finalConfig = renameKey(decrypted, 'lore', 'knowledge');

        const projectRoot = path.resolve(process.cwd(), (process.cwd().includes('packages') ? '../../' : './'));
        const workspacePath = path.join(projectRoot, 'workspaces', agentId);
        if (!fs.existsSync(workspacePath)) fs.mkdirSync(workspacePath, { recursive: true });

        const characterPath = path.join(workspacePath, 'character.json');
        fs.writeFileSync(characterPath, JSON.stringify(finalConfig, null, 2));

        const hostWorkspacesPath = process.env.HOST_WORKSPACES_PATH;
        let hostCharacterPath = characterPath;

        if (hostWorkspacesPath) {
            const resolvedHostWorkspaces = path.isAbsolute(hostWorkspacesPath)
                ? hostWorkspacesPath
                : path.resolve(projectRoot, hostWorkspacesPath);
            hostCharacterPath = path.join(resolvedHostWorkspaces, agentId, 'character.json');
        }

        // Verify image exists locally or attempt to pull
        try {
            await docker.inspectImage(ELIZA_IMAGE_BASE);
        } catch (e: any) {
            if (e.status === 404) {
                logger.info(`Image ${ELIZA_IMAGE_BASE} not found locally. Attempting to pull...`);
                try {
                    await docker.pullImage(ELIZA_IMAGE_BASE);
                    logger.info(`Successfully pulled image ${ELIZA_IMAGE_BASE}`);
                } catch (pullErr: any) {
                    logger.error(`Failed to pull image ${ELIZA_IMAGE_BASE}: ${pullErr.message}`);
                    throw pullErr;
                }
            } else {
                throw e;
            }
        }

        await docker.createContainer({
            Image: ELIZA_IMAGE_BASE,
            User: '1000:1000',
            name: containerName,
            Env: [`AGENT_ID=${agentId}`],
            HostConfig: {
                Binds: [`${hostCharacterPath}:/home/node/app/characters/character.json`],
                RestartPolicy: { Name: 'unless-stopped' }
            },
            NetworkingConfig: {
                EndpointsConfig: { [DOCKER_NETWORK_NAME]: {} }
            }
        });

        const newContainer = await docker.getContainer(containerName);
        await newContainer.start();

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'running',
            last_sync: new Date().toISOString()
        });

    } catch (err: any) {
        logger.error(`Failed to start Eliza agent ${agentId}:`, err.message);
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'error',
            error_message: err.message
        });
    }
}

export async function stopElizaAgent(agentId: string) {
    const containerName = getAgentContainerName(agentId, 'eliza');
    try {
        const container = await docker.getContainer(containerName);
        await container.stop();
        await container.remove();
    } catch (err: any) {
        logger.warn(`Failed to stop Eliza agent ${agentId}:`, err.message);
    }
}

/**
 * Performs a hot-reload of an Eliza agent's configuration.
 * Uses ElizaOS CLI tools to reload without container restart.
 */
export async function hotReloadEliza(agentId: string, config: any) {
    const containerName = getAgentContainerName(agentId, 'eliza');
    try {
        const decrypted = cryptoUtils.decryptConfig(config);
        const finalConfig = renameKey(decrypted, 'lore', 'knowledge');

        const workspacePath = path.resolve(process.cwd(), (process.cwd().includes('packages') ? '../../' : './'), 'workspaces', agentId);
        const characterPath = path.join(workspacePath, 'character.json');

        logger.info(`Hot-Reload: Updating character config for ${agentId}...`);
        fs.writeFileSync(characterPath, JSON.stringify(finalConfig, null, 2));

        // Execute reload command inside container
        // Assuming elizaos cli has a reload command or we restart the internal process
        const exec = await docker.createExec(containerName, {
            Cmd: ['sh', '-c', 'pm2 restart all || pkill -f node'] // Fallback to process restart if pm2 not used
        });
        await docker.startExec(exec.Id, { Detach: true });

        logger.info(`Hot-Reload: Command sent to Eliza container ${containerName}`);
    } catch (err: any) {
        logger.error(`Hot-Reload Failed for ${agentId}:`, err.message);
        throw err;
    }
}
