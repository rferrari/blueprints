import axios from 'axios';
import fs from 'fs';
import { supabase } from './lib/supabase';
import { logger } from './lib/logger';
import { cryptoUtils } from './lib/crypto';
import { runTerminalCommand } from './handlers/openclaw';
import { runTerminalCommand as runOpenClawTerminal } from './handlers/openclaw';
import { runElizaCommand } from './handlers/eliza';

const isDocker = fs.existsSync('/.dockerenv');

export async function handleUserMessage(payload: any) {
    const { id, agent_id, content: rawContent, user_id } = payload;
    const content = (rawContent || '').trim();

    logger.info(`Message Bus: [${id}] Processing message for agent ${agent_id}: "${content.substring(0, 20)}${content.length > 20 ? '...' : ''}"`);

    // Get agent's desired state (for framework and config)
    const { data: agent } = await supabase
        .from('agents')
        .select('framework')
        .eq('id', agent_id)
        .single();


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

            logger.info(`Message Bus: [${id}] Calling runTerminalCommand for ${command}...`);

            if (content === '/terminal' || content.startsWith('/terminal ')) {
                const command = content === '/terminal'
                    ? 'help'
                    : content.replace('/terminal ', '').trim();

                if (command === 'help' || !command) {
                    await supabase.from('agent_conversations').insert([{
                        agent_id,
                        user_id,
                        content:
                            `🖥️ Terminal Command Center

Commands prefixed with /terminal are executed inside the agent container.

Examples:

/terminal ls
/terminal whoami
/terminal node -v
/terminal ls

`,
                        sender: 'agent'
                    }]);
                    return;
                }

                let output = '';

                if (agent?.framework === 'eliza') {
                    output = await runElizaCommand(agent_id, command);
                } else {
                    output = await runOpenClawTerminal(agent_id, command);
                }

                await supabase.from('agent_conversations').insert([{
                    agent_id,
                    user_id,
                    content: `$ ${command}\n\n${output}`,
                    sender: 'agent'
                }]);

                // return;



                logger.info(`Message Bus: [${id}] runTerminalCommand finished. Output length: ${output.length}`);

                await supabase.from('agent_conversations').insert([{
                    agent_id,
                    user_id,
                    content: `$ ${command}\n\n${output}`,
                    sender: 'agent'
                }]);
                return;
            }
        }

        logger.info(`Message Bus: [${id}] Standard chat routing for agent ${agent_id}`);

        // --- Standard Chat Logic ---
        // 1. Get agent's actual state (for local endpoint)
        const { data: actual } = await supabase
            .from('agent_actual_state')
            .select('endpoint_url')
            .eq('agent_id', agent_id)
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
                    const res = await fetch(`${agentUrl}/v1/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
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
                        throw new Error(`HTTP ${res.status}: ${errorText}`);
                    }

                    const result: any = await res.json();
                    logger.debug(`Message Bus: [${id}] OpenClaw raw response: ${JSON.stringify(result)}`);
                    agentResponseContent = result.choices?.[0]?.message?.content || agentResponseContent;

                    if (agentResponseContent === 'No reply from agent.' || agentResponseContent.includes('No response from OpenClaw')) {
                        logger.error(`Message Bus: [${id}] [AGENT FAIL] Gateway returned: "${agentResponseContent}"`);
                        logger.debug(`Message Bus: [${id}] [FULL DATA] ${JSON.stringify(result)}`);
                    }

                    success = true;
                } catch (err: any) {
                    const isConnRefused = err.code === 'ECONNREFUSED' || err.message?.includes('Unable to connect') || err.message?.includes('Connection refused');
                    const detailedError = err.message;

                    if (isConnRefused) {
                        if (attempts < maxAttempts) {
                            logger.warn(`Message Bus: [TRANSPORT ERROR] Connection refused to ${agentUrl} (Agent starting?). Retrying attempt ${attempts}/${maxAttempts} in 1s...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } else {
                            logger.error(`Message Bus: [TRANSPORT ERROR] Connection refused to ${agentUrl} after ${maxAttempts} attempts. (Code: ${err.code})`);
                            if (err.stack) logger.debug(err.stack);
                            agentResponseContent = `[AGENT ERROR]: Connection refused to ${agentUrl}. Is the agent container running?`;
                            success = true; // Stop retrying
                        }
                    } else {
                        logger.error(`Message Bus: [AGENT ERROR] on attempt ${attempts}. Details: ${detailedError}. Agent URL: ${agentUrl}`);
                        if (err.stack) logger.debug(err.stack);
                        agentResponseContent = `[AGENT ERROR]: ${detailedError}`;
                        success = true; // Stop retrying for non-connection errors
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
