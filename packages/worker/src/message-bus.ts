import fs from 'fs';
import { supabase } from './lib/supabase';
import { logger } from './lib/logger';
import { cryptoUtils } from '@eliza-manager/shared/crypto';
import { runTerminalCommand as runOpenClawTerminal } from './handlers/openclaw';
import { runElizaCommand } from './handlers/eliza';

const isDocker = fs.existsSync('/.dockerenv');

export async function handleUserMessage(payload: any) {
    const { id, agent_id, content: rawContent, user_id } = payload;
    const content = (rawContent || '').trim();

    logger.info(`Message Bus: [${id}] Processing message for agent ${agent_id}`);

    try {
        // Fetch agent framework
        const { data: agent } = await supabase
            .from('agents')
            .select('framework')
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

            if (!command || command === 'help') {
                await supabase.from('agent_conversations').insert([{
                    agent_id,
                    user_id,
                    sender: 'agent',
                    content: `🖥 Terminal Command Center

Commands prefixed with /terminal execute inside the agent container.

Examples:
/terminal ls
/terminal whoami
/terminal node -v
`
                }]);
                return;
            }

            logger.info(`Message Bus: [${id}] Terminal command: ${command}`);

            let output = '';

            if (agent.framework === 'eliza') {
                output = await runElizaCommand(agent_id, command);
            } else {
                output = await runOpenClawTerminal(agent_id, command);
            }

            await supabase.from('agent_conversations').insert([{
                agent_id,
                user_id,
                sender: 'agent',
                content: `$ ${command}\n\n${output}`
            }]);

            return;
        }

        //
        // ================= CHAT MODE =================
        //

        const { data: actual } = await supabase
            .from('agent_actual_state')
            .select('endpoint_url')
            .eq('agent_id', agent_id)
            .single();

        if (!actual?.endpoint_url) {
            logger.warn(`Agent ${agent_id} not ready`);
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
