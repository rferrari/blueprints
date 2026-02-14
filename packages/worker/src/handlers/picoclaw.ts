
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../lib/logger';
import { docker } from '../lib/docker';
import { getAgentContainerName } from '../lib/utils';
import { mkdirSync } from 'fs';

const PICOCLAW_IMAGE = 'picoclaw:local';

function ensureAgentDirectorySync(agentId: string) {
    const agentsDataContainerPath = process.env.AGENTS_DATA_CONTAINER_PATH || './workspaces';

    // Resolve absolute path
    const absolutePath = path.isAbsolute(agentsDataContainerPath)
        ? agentsDataContainerPath
        : path.resolve(process.cwd(), agentsDataContainerPath);

    const agentDir = path.join(absolutePath, agentId, 'home', '.picoclaw');

    // Create directory
    mkdirSync(agentDir, { recursive: true });

    // Ensure workspace exists
    mkdirSync(path.join(agentDir, 'workspace'), { recursive: true });

    return agentDir;
}

export async function startPicoClawAgent(
    agentId: string,
    config: any,
    metadata: any = {},
    forceRestart = false
) {
    const containerName = getAgentContainerName(agentId, 'picoclaw');
    const agentDir = ensureAgentDirectorySync(agentId);

    // 1. Prepare Config
    const picoConfig = {
        agents: {
            defaults: {
                workspace: "/root/.picoclaw/workspace",
                model: config.model || "openrouter/auto",
                // Map other config fields if needed
                ...config
            }
        },
        providers: config.providers || {},
        tools: config.tools || {}
    };

    // Write config.json
    await fs.writeFile(
        path.join(agentDir, 'config.json'),
        JSON.stringify(picoConfig, null, 2)
    );

    // Write identity/metadata if needed
    if (metadata.character) {
        await fs.writeFile(
            path.join(agentDir, 'IDENTITY.md'),
            JSON.stringify(metadata.character, null, 2)
        );
    }

    // 2. Check if container exists
    const existing = await docker.listContainers(); // Logic in docker.ts enforces all=true
    const container = existing.find((c: any) => c.Names.includes(`/${containerName}`));

    if (container) {
        if (container.State === 'running' && !forceRestart) {
            return; // Already running
        }
        // Stop and remove if forcing restart or stopped
        await stopPicoClawAgent(agentId);
    }

    // 3. Start Container
    logger.info(`Starting PicoClaw agent ${agentId}...`);

    // Ensure image exists
    try {
        await docker.inspectImage(PICOCLAW_IMAGE);
    } catch {
        logger.warn(`Image ${PICOCLAW_IMAGE} not found.`);
        // Attempting pull/build logic would go here, assuming pre-built for now
    }

    const createdContainer = await docker.createContainer({
        Image: PICOCLAW_IMAGE,
        name: containerName,
        Env: [
            `PICOCLAW_HOME=/root/.picoclaw`,
            `AGENT_ID=${agentId}`
        ],
        HostConfig: {
            Binds: [
                `${agentDir}:/root/.picoclaw:rw`
            ],
            NetworkMode: 'blueprints-network',
            RestartPolicy: { Name: 'unless-stopped' }
        },
        Cmd: ['picoclaw', 'gateway'] // Running in gateway mode
    });

    await createdContainer.start();

    logger.info(`PicoClaw agent ${agentId} started.`);
}

export async function stopPicoClawAgent(agentId: string) {
    const containerName = getAgentContainerName(agentId, 'picoclaw');
    logger.info(`Stopping PicoClaw agent ${agentId}...`);
    try {
        const container = await docker.getContainer(containerName);
        await container.stop().catch(() => { }); // Ignore if already stopped
        await container.remove();
        logger.info(`PicoClaw agent ${agentId} stopped and removed.`);
    } catch (err: any) {
        if (err.message.includes('no such container') || err.message.includes('404')) {
            // Ignore 404 (already gone)
            logger.error(`Error stopping PicoClaw agent ${agentId}:`, err);
        }
    }
}

export async function runTerminalCommand(agentId: string, command: string): Promise<string> {
    const containerName = getAgentContainerName(agentId, 'picoclaw');

    try {
        const exec = await docker.createExec(containerName, {
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            WorkingDir: '/root/.picoclaw',
            Cmd: ['sh', '-c', command]
        });

        const result = await docker.startExec(exec.Id, { Detach: false, Tty: true });
        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
        logger.error(`PicoClaw terminal error for ${agentId}:`, err.message);
        return `Error: ${err.message}`;
    }
}
