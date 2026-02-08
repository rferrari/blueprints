import axios from 'axios';
import fs from 'fs';
import { supabase } from './lib/supabase';
import { logger } from './lib/logger';
import { cryptoUtils } from './lib/crypto';
import { runTerminalCommand } from './handlers/openclaw';

const isDocker = fs.existsSync('/.dockerenv');

export async function handleUserMessage(payload: any) {
    const { id, agent_id, content: rawContent, user_id } = payload;
    const content = (rawContent || '').trim();

    logger.info(`Message Bus: [${id}] Processing message for agent ${agent_id}: "${content.substring(0, 20)}${content.length > 20 ? '...' : ''}"`);

    try {
        // --- Terminal Tool Logic ---
        if (content === '/terminal' || content.startsWith('/terminal ')) {
            const command = content === '/terminal' ? 'help' : content.replace('/terminal ', '').trim();

            logger.info(`Message Bus: [${id}] Terminal command detected: "${command}"`);

            if (command === 'help' || !command) {
                await supabase.from('agent_conversations').insert([{
                    agent_id,
                    user_id,
                    content: `🖥️ Terminal Command Center\n\nCommands prefixed with \`/terminal\` are executed directly inside the agent container.\n\n💡 **Tip**: You can run terminal commands even in **Chat Mode** by starting your message with \`/terminal \`.\n\n**Examples**:\n• \`/terminal ls -la\`\n• \`/terminal whoami\`\n• \`/terminal pwd\``,
                    sender: 'agent'
                }]);
                return;
            }

            const output = await runTerminalCommand(agent_id, command);

            await supabase.from('agent_conversations').insert([{
                agent_id,
                user_id,
                content: `\`\`\`bash\n$ ${command}\n\n${output}\n\`\`\``,
                sender: 'agent'
            }]);
            return;
        }

        logger.info(`Message Bus: [${id}] Standard chat routing for agent ${agent_id}`);

        // --- Standard Chat Logic ---
        // 1. Get agent's actual state (for local endpoint)
        const { data: actual } = await supabase
            .from('agent_actual_state')
            .select('endpoint_url')
            .eq('agent_id', agent_id)
            .single();

        // 2. Get agent's desired state (for framework and config)
        const { data: agent } = await supabase
            .from('agents')
            .select('framework')
            .eq('id', agent_id)
            .single();

        if (!actual?.endpoint_url || !agent) {
            logger.warn(`Message Bus: Agent ${agent_id} not ready or not found.`);
            return;
        }

        let agentResponseContent = `Response from ${agent.framework} agent.`;

        if (agent.framework === 'openclaw') {
            const { data: desired } = await supabase
                .from('agent_desired_state')
                .select('config')
                .eq('agent_id', agent_id)
                .single();

            const config = cryptoUtils.decryptConfig((desired?.config as any) || {});
            const token = config.gateway?.auth?.token;

            // Determine correct Agent URL
            let agentUrl = actual.endpoint_url || `http://openclaw-${agent_id}:18789`;
            if (isDocker) {
                agentUrl = `http://openclaw-${agent_id}:18789`;
            }

            const maskToken = (t: string) => t ? `${t.substring(0, 4)}...${t.substring(t.length - 4)}` : 'null';
            logger.info(`Message Bus: Calling OpenClaw at ${agentUrl} (Token: ${maskToken(token)})`);

            let attempts = 0;
            const maxAttempts = 5;
            let success = false;

            while (attempts < maxAttempts && !success) {
                attempts++;
                try {
                    const res = await axios.post(`${agentUrl}/v1/chat/completions`, {
                        model: 'openclaw',
                        messages: [{ role: 'user', content }]
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'x-openclaw-agent-id': agent_id,
                            'Connection': 'close'
                        },
                        timeout: 120000
                    });

                    const result = res.data;
                    agentResponseContent = result.choices?.[0]?.message?.content || agentResponseContent;

                    if (agentResponseContent === 'No reply from agent.') {
                        agentResponseContent = `[PROVIDER TIMEOUT]: ${agentResponseContent}`;
                        logger.error(`Message Bus: [PROVIDER TIMEOUT] for agent ${agent_id}`);
                    }

                    success = true;
                } catch (err: any) {
                    const isConnRefused = err.code === 'ECONNREFUSED' || err.message?.includes('Unable to connect');
                    const status = err.response?.status;
                    const responseData = err.response?.data;
                    const detailedError = responseData ? (typeof responseData === 'object' ? JSON.stringify(responseData) : responseData) : err.message;

                    if (isConnRefused) {
                        if (attempts < maxAttempts) {
                            logger.warn(`Message Bus: [TRANSPORT ERROR] Connection refused (Agent starting?). Retrying attempt ${attempts}/${maxAttempts} in 1s...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } else {
                            logger.error(`Message Bus: [TRANSPORT ERROR] Failed to connect to agent at ${agentUrl} after ${attempts} attempts.`);
                            agentResponseContent = `Error: Agent unreachable at ${agentUrl}`;
                            break;
                        }
                    } else {
                        let label = '[AGENT ERROR]';
                        if (status === 403 || status === 401) {
                            label = '[AGENT GATEWAY ERROR]';
                        } else if (detailedError.toLowerCase().includes('model') || detailedError.toLowerCase().includes('provider')) {
                            label = '[PROVIDER ERROR]';
                        }

                        logger.error(`Message Bus: ${label} (Status: ${status || err.code}) on attempt ${attempts}. Details: ${detailedError}`);
                        agentResponseContent = `${label}: ${detailedError}`;
                        break;
                    }
                }
            }
        } else {
            agentResponseContent = `Protocol Note: ${agent.framework} messaging bridge pending.`;
        }

        // 3. Post response back to database
        const { error: postError } = await supabase
            .from('agent_conversations')
            .insert([{
                agent_id,
                user_id,
                content: agentResponseContent,
                sender: 'agent'
            }]);

        if (postError) {
            logger.error(`Message Bus: Failed to post agent response:`, postError.message);
        } else {
            logger.info(`Message Bus: Agent response posted for agent ${agent_id}`);
        }

    } catch (err: any) {
        logger.error(`Message Bus: Error processing message:`, err.message);
    }
}

export function startMessageBus() {
    logger.info('Message Bus: Initializing real-time subscription...');

    supabase
        .channel('agent_conversations_all')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_conversations',
            filter: 'sender=eq.user'
        }, (payload) => {
            handleUserMessage(payload.new);
        })
        .subscribe();
}
