import { startElizaOSAgent, stopElizaOSAgent, runElizaOSCommand } from './elizaos';
import { startOpenClawAgent, stopOpenClawAgent, runTerminalCommand as runOpenClawCommand } from './openclaw';
import { startPicoClawAgent, stopPicoClawAgent, runTerminalCommand as runPicoClawCommand } from './picoclaw';

export interface AgentHandler {
    start: (agentId: string, config: any, metadata: any, forceRestart?: boolean, projectId?: string) => Promise<void>;
    stop: (agentId: string, projectId?: string) => Promise<void>;
    runCommand?: (agentId: string, command: string, projectId?: string) => Promise<string>;
}

export const FRAMEWORK_HANDLERS: Record<string, AgentHandler> = {
    'elizaos': {
        start: async (id, config, _metadata, _force, projectId) => {
            return startElizaOSAgent(id, config, projectId);
        },
        stop: stopElizaOSAgent,
        runCommand: runElizaOSCommand
    },
    'openclaw': {
        start: async (id, config, metadata, force) => {
            return startOpenClawAgent(id, config, metadata, force);
        },
        stop: stopOpenClawAgent,
        runCommand: runOpenClawCommand
    },
    'picoclaw': {
        start: async (id, config, metadata, force) => {
            return startPicoClawAgent(id, config, metadata, force);
        },
        stop: stopPicoClawAgent,
        runCommand: runPicoClawCommand
    }
};

export function getHandler(framework: string): AgentHandler {
    const handler = FRAMEWORK_HANDLERS[framework];
    if (!handler) {
        throw new Error(`No handler found for framework: ${framework}`);
    }
    return handler;
}
