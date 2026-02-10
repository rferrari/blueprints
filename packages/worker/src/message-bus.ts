import fs from 'fs';
import { supabase } from './lib/supabase';
import { logger } from './lib/logger';
import { cryptoUtils } from './lib/crypto';
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

                    if (!res.ok) throw new Error(await res.text());

                    const json: any = await res.json();
                    agentResponse = json.choices?.[0]?.message?.content || '';
                    break;

                } catch (err: any) {
                    if (attempts >= 5) {
                        agentResponse = `[AGENT ERROR]: ${err.message}`;
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
