import fs from 'fs';
import { supabase } from './lib/supabase';
import { logger } from './lib/logger';
import { cryptoUtils } from '@eliza-manager/shared/crypto';
import { runTerminalCommand as runOpenClawTerminal } from './handlers/openclaw';
import { getHandler } from './handlers';

const isDocker = fs.existsSync('/.dockerenv');

/**
 * Strip ANSI/VT100 escape codes from terminal output before storing.
 * Handles fragmented sequences produced by TTY mode (each char may be on its own line).
 */
function stripAnsi(str: string): string {
    // First, collapse the fragmented ESC sequences written as:
    //   \u001b\r\n[\r\n3\r\n5\r\nm\r\n  →  \u001b[35m
    // Strategy: remove all \r and \n that appear between ESC and its terminator letter
    // We do this iteratively: join ESC...m sequences that are broken across lines
    let s = str
        // Normalize line endings first
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    // Rejoin fragmented ESC sequences: ESC followed by newlines, digits, semicolons, [
    // e.g. "\u001b\n[\n3\n5\nm" → "\u001b[35m"
    // Repeat until stable (handles deeply broken sequences)
    for (let i = 0; i < 5; i++) {
        s = s.replace(/\x1b\n?\[([\d;\n]*)([A-Za-z])/g, (_m, params, cmd) =>
            `\x1b[${params.replace(/\n/g, '')}${cmd}`
        );
    }

    return s
        // ESC [ ... letter  (CSI sequences: colors, cursor, etc.)
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        // ESC ] ... ST  (OSC sequences)
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        // ESC ( or ) ... (character set designation)
        .replace(/\x1b[()][A-Za-z0-9]/g, '')
        // Lone ESC + single char
        .replace(/\x1b./g, '')
        // Remaining lone ESC
        .replace(/\x1b/g, '')
        // Backspace sequences
        .replace(/.\x08/g, '')
        // Remove spinner artifact lines (lone spinner chars like ◒◐◓◑ on their own line)
        .split('\n')
        .filter(line => !/^[◒◐◓◑◇]$/.test(line.trim()))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export async function handleUserMessage(payload: any) {
    const { id, agent_id, content: rawContent, user_id } = payload;
    const content = (rawContent || '').trim();

    logger.info(`Message Bus: [${id}] Processing message for agent ${agent_id}`);

    try {
        // Fetch agent framework and project_id
        const { data: agent } = await supabase
            .from('agents')
            .select('framework, project_id')
            .eq('id', agent_id)
            .single();

        if (!agent) return;

        //
        // ================= TERMINAL MODE =================
        //
        if (content === '/terminal' || content.startsWith('/terminal ')) {
            const command =
                content === '/terminal'
                    ? 'help'
                    : content.replace('/terminal ', '').trim();

            const COMMAND_WHITELIST = ['ls', 'pwd', 'whoami', 'echo', 'cat', 'node -v', 'npm -v', 'bun -v', 'date'];
            const baseCommand = command.split(' ')[0];

            if (!command || command === 'help') {
                await supabase.from('agent_conversations').insert([{
                    agent_id,
                    user_id,
                    sender: 'agent',
                    content: `🖥 Terminal Command Center

Commands prefixed with /terminal execute inside the agent container.

Available commands: ${COMMAND_WHITELIST.join(', ')}

Examples:
/terminal ls
/terminal whoami
`
                }]);
                return;
            }

            if (!COMMAND_WHITELIST.includes(baseCommand)) {
                logger.warn(`Message Bus: [${id}] Blocked unauthorized terminal command: ${command}`);
                await supabase.from('agent_conversations').insert([{
                    agent_id,
                    user_id,
                    sender: 'agent',
                    content: `🚫 Error: Command "${baseCommand}" is not allowed. Only basic commands are permitted for security.`
                }]);
                return;
            }

            logger.info(`Message Bus: [${id}] Terminal command: ${command}`);

            let output = '';

            const handler = getHandler(agent.framework);
            if (handler?.runCommand) {
                output = await handler.runCommand(agent_id, command, agent.project_id);
            } else {
                throw new Error(`Framework ${agent.framework} does not support terminal commands`);
            }

            await supabase.from('agent_conversations').insert([{
                agent_id,
                user_id,
                sender: 'agent',
                content: `$ ${command}\n\n${stripAnsi(output)}`
            }]);

            return;
        }

        //
        // ================= CHAT MODE =================
        //

        const { data: actual } = await supabase
            .from('agent_actual_state')
            .select('status, endpoint_url')
            .eq('agent_id', agent_id)
            .single();

        if (actual?.status !== 'running') {
            logger.warn(`Agent ${agent_id} not running (status: ${actual?.status})`);
            return;
        }

        if (agent.framework !== 'elizaos' && !actual?.endpoint_url) {
            logger.warn(`Agent ${agent_id} missing endpoint_url`);
            return;
        }

        let agentResponse = '';

        if (agent.framework === 'openclaw') {
            const { data: desired } = await supabase
                .from('agent_desired_state')
                .select('config')
                .eq('agent_id', agent_id)
                .single();

            const config = cryptoUtils.decryptConfig((desired?.config as any) || {});
            const token = config.gateway?.auth?.token;

            let agentUrl = isDocker
                ? `http://openclaw-${agent_id}:18789`
                : actual.endpoint_url;

            let attempts = 0;

            const translateError = (err: string) => {
                if (err.includes('socket connection was closed') || err.includes('ECONNREFUSED')) {
                    return "🚫 [AGENT CONNECTION ERROR]: The agent container is unreachable. It might still be booting or has crashed. Please check the Agent Status in the dashboard.";
                }
                if (err.includes('context window')) {
                    return "⚠️ [MODEL CAPACITY ERROR]: This conversation has exceeded the AI model's memory limit (context window). Try using a model with a larger context (like gpt-4o) or start a new conversation.";
                }
                if (err.includes('Unauthorized') || err.includes('unauthorized') || err.includes('401')) {
                    return "🔑 [AUTHENTICATION ERROR]: Invalid API Key or Gateway Token. Please verify your Neural Configuration in the Wizard.";
                }
                return `❌ [AGENT ERROR]: ${err}`;
            };

            while (attempts < 5) {
                attempts++;

                try {
                    const res = await fetch(`${agentUrl}/v1/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                            'x-openclaw-agent-id': agent_id
                        },
                        body: JSON.stringify({
                            model: 'openclaw',
                            messages: [{ role: 'user', content }]
                        }),
                        signal: AbortSignal.timeout(120000)
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        throw new Error(errorText);
                    }

                    const json: any = await res.json();
                    agentResponse = json.choices?.[0]?.message?.content || '';

                    if (agentResponse === "No response from OpenClaw.") {
                        agentResponse = "📡 [GATEWAY TIMEOUT]: The agent failed to respond in time. This is often due to an overloaded model context window or a slow API provider connection.";
                    }

                    break;

                } catch (err: any) {
                    if (attempts >= 5) {
                        agentResponse = translateError(err.message);
                        break;
                    }

                    await new Promise(r => setTimeout(r, 1000));
                }
            }

        } else if (agent.framework === 'elizaos') {
            let baseUrl = actual.endpoint_url;

            // Fallback for container networking or legacy records
            if (!baseUrl) {
                baseUrl = isDocker
                    ? `http://elizaos-${agent.project_id}:3000`
                    : `http://localhost:3000`;
            }

            try {
                // 1. Get or Create Session (with retry logic for expired sessions)
                let elizaSessionId: string | null = null;
                let sessionAttempts = 0;
                let agentResponse = '';

                while (sessionAttempts < 2 && !agentResponse) {
                    sessionAttempts++;

                    // A. Fetch existing session ID from DB
                    if (!elizaSessionId) {
                        const { data: sessionData } = await supabase
                            .from('agent_sessions')
                            .select('eliza_session_id')
                            .eq('agent_id', agent_id)
                            .eq('user_id', user_id)
                            .single();
                        elizaSessionId = sessionData?.eliza_session_id || null;
                    }

                    // B. Create new session if missing
                    if (!elizaSessionId) {
                        logger.info(`Creating new ElizaOS session for agent ${agent_id} and user ${user_id}`);
                        const createRes = await fetch(`${baseUrl}/api/messaging/sessions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                agentId: agent_id,
                                userId: user_id,
                                metadata: { source: 'blueprints-worker' }
                            })
                        });

                        if (!createRes.ok) {
                            const error = await createRes.text();
                            throw new Error(`Failed to create ElizaOS session: ${error}`);
                        }

                        const sessionJson: any = await createRes.json();
                        elizaSessionId = sessionJson.sessionId;

                        await supabase.from('agent_sessions').upsert({
                            agent_id,
                            user_id,
                            project_id: agent.project_id,
                            eliza_session_id: elizaSessionId
                        });
                    }

                    // C. Send Message
                    try {
                        const res = await fetch(`${baseUrl}/api/messaging/sessions/${elizaSessionId}/messages`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                content,
                                transport: 'http'
                            }),
                            signal: AbortSignal.timeout(120000)
                        });

                        if (res.ok) {
                            const msgJson: any = await res.json();
                            agentResponse = msgJson.agentResponse?.text || msgJson.agentResponse;
                            break; // Success!
                        } else {
                            const errorText = await res.text();
                            // Check for SESSION_NOT_FOUND error
                            if (errorText.includes('SESSION_NOT_FOUND') || errorText.includes('Session with ID') && errorText.includes('not found')) {
                                logger.warn(`ElizaOS session ${elizaSessionId} not found (likely server restart). Recreating...`);
                                // Clear invalid session from DB and memory to force recreation in next loop
                                await supabase
                                    .from('agent_sessions')
                                    .delete()
                                    .eq('eliza_session_id', elizaSessionId);
                                elizaSessionId = null;
                                continue; // Retry loop entirely
                            }

                            // Other errors: fall back to polling if it was a transport error, or just log
                            logger.warn(`ElizaOS synchronous message failed (will poll): ${errorText}`);
                            if (res.status === 500 || res.status === 504) {
                                // proceed to polling fallback
                                break;
                            }
                            // unexpected error, but let's try polling anyway just in case
                            break;
                        }
                    } catch (sendErr: any) {
                        logger.warn(`ElizaOS send error (will poll): ${sendErr.message}`);
                        break; // Fall through to polling
                    }
                }

                // 3. Polling Fallback if synchronous response failed or timed out
                if (!agentResponse && elizaSessionId) {
                    logger.info(`Synchronous response missing for session ${elizaSessionId}, polling...`);
                    let pollAttempts = 0;
                    while (pollAttempts < 15) {
                        pollAttempts++;
                        await new Promise(r => setTimeout(r, 2000));

                        try {
                            const pollRes = await fetch(`${baseUrl}/api/messaging/sessions/${elizaSessionId}/messages?limit=1`, {
                                headers: { 'Content-Type': 'application/json' }
                            });

                            if (pollRes.ok) {
                                const pollJson: any = await pollRes.json();
                                const lastMsg = pollJson.messages?.[0];
                                if (lastMsg?.isAgent) {
                                    agentResponse = lastMsg.content;
                                    break;
                                }
                            } else if (pollRes.status === 404) {
                                // Session truly gone during polling? Stop.
                                break;
                            }
                        } catch (e) {
                            // ignore polling errors
                        }
                    }
                }

                if (!agentResponse) {
                    agentResponse = 'No response from ElizaOS (Timeout).';
                }

            } catch (err: any) {
                logger.error(`ElizaOS bridge error: ${err.message}`);
                agentResponse = `❌ [ELIZAOS ERROR]: ${err.message}`;
            }
        } else {
            agentResponse = `Protocol Note: ${agent.framework} bridge pending.`;
        }

        await supabase.from('agent_conversations').insert([{
            agent_id,
            user_id,
            sender: 'agent',
            content: agentResponse
        }]);

        logger.info(`Message Bus: Agent response posted`);

    } catch (err: any) {
        logger.error(`Message Bus failure: ${err.message}`);
    }
}

export function startMessageBus() {
    logger.info('Message Bus: Subscribing to Supabase...');

    supabase
        .channel('agent_conversations_all')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'agent_conversations',
                filter: 'sender=eq.user'
            },
            payload => handleUserMessage(payload.new)
        )
        .subscribe();
}
