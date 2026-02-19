import { supabase } from '../lib/supabase';
import { cryptoUtils } from '@eliza-manager/shared/crypto';
import { docker } from '../lib/docker';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOrCreateProject() {
    const { data: projects } = await supabase.from('projects').select('id').limit(1);
    if (projects && projects.length > 0) return projects[0].id;
    throw new Error('No projects found. Please create a project in the UI first.');
}

async function cleanupAgent(agentId: string) {
    console.log(`\n🧹 Cleaning up test agent ${agentId}...`);
    try {
        await supabase.from('agent_desired_state').delete().eq('agent_id', agentId);
        await supabase.from('agent_actual_state').delete().eq('agent_id', agentId);
        await supabase.from('agents').delete().eq('id', agentId);
        console.log('✅ Cleanup complete.');
    } catch (e: any) {
        console.warn('Cleanup failed (expected if already deleted):', e.message);
    }
}

async function main() {
    const projectId = await getOrCreateProject();
    const name = `Integration-Claw-${Date.now()}`;

    console.log(`\n🚀 Starting Integration Test for agent: ${name}`);

    // 1. Create Agent
    const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert([{ project_id: projectId, name, framework: 'openclaw' }])
        .select()
        .single();

    if (agentError) throw agentError;
    const agentId = agent.id;

    // 2. Init Desired State (stopped)
    const initialConfig = {
        gateway: {
            auth: { mode: 'token', token: 'integration-test-token' }
        }
    };

    await supabase.from('agent_desired_state').insert([{
        agent_id: agentId,
        enabled: false,
        config: cryptoUtils.encryptConfig(initialConfig),
        metadata: {}
    }]);

    await supabase.from('agent_actual_state').insert([{ agent_id: agentId, status: 'stopped' }]);

    try {
        // 3. Enable Agent
        console.log('Enabling agent...');
        await supabase.from('agent_desired_state').update({ enabled: true }).eq('agent_id', agentId);

        // 4. Poll for 'running' status
        console.log('Waiting for agent to reach "running" state...');
        const startTime = Date.now();
        let isRunning = false;
        while (!isRunning && (Date.now() - startTime) < 120000) { // 2m timeout
            const { data } = await supabase.from('agent_actual_state').select('status').eq('agent_id', agentId).single();
            if (data?.status === 'running') isRunning = true;
            else {
                process.stdout.write('.');
                await sleep(2000);
            }
        }

        if (!isRunning) {
            throw new Error('Agent failed to reach "running" state within 2 minutes.');
        }

        console.log('\n✅ Agent is running!');

        // 5. Verify Docker Logs
        console.log('Verifying Docker logs...');
        const containerName = `openclaw-${agentId}`;
        const container = await docker.getContainer(containerName);

        let logsFound = false;
        const logStartTime = Date.now();
        while (!logsFound && (Date.now() - logStartTime) < 45000) {
            try {
                const logs = await container.logs({ tail: 100 });
                if (!logs || logs.length === 0) {
                    process.stdout.write('?');
                    await sleep(2000);
                    continue;
                }

                // logs is now a Buffer from our updated docker.ts
                // Docker multiplexes logs: 8-byte header (type, 0, 0, 0, size1, size2, size3, size4)
                let cleanLogs = '';
                let offset = 0;
                while (offset + 8 <= logs.length) {
                    const type = logs[offset];
                    // 1 = stdout, 2 = stderr
                    const size = logs.readUInt32BE(offset + 4);
                    const end = offset + 8 + size;
                    if (end > logs.length) break;

                    const chunk = logs.subarray(offset + 8, end).toString('utf8');
                    cleanLogs += chunk;
                    offset = end;
                }

                // Fallback if not multiplexed (though Docker socket logs usually are)
                if (cleanLogs.length === 0 && logs.length > 0) {
                    cleanLogs = logs.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
                }

                if (cleanLogs.length < 5) {
                    process.stdout.write('z'); // Very short/zero logs
                    if (logs.length > 0) {
                        console.log(`\n[DEBUG] Raw logs length: ${logs.length}, Hex: ${logs.subarray(0, 16).toString('hex')}...`);
                    }
                } else if (cleanLogs.includes('OpenClaw') || cleanLogs.includes('Gateway') || cleanLogs.includes('Starting') || cleanLogs.includes('Server') || cleanLogs.includes('listening on')) {
                    console.log('\n✅ Found startup signals in logs!');
                    console.log('--- Log Excerpt ---');
                    console.log(cleanLogs.slice(-500));
                    console.log('-------------------');
                    logsFound = true;
                } else {
                    process.stdout.write('.');
                    await sleep(2000);
                }
            } catch (e: any) {
                console.warn('\nLog check retry:', e.message);
                await sleep(2000);
            }
        }

        if (!logsFound) {
            console.error('\n❌ Failed to find expected patterns in Docker logs.');
        } else {
            console.log('\n🏆 Integration Test PASSED!');
        }

    } catch (err: any) {
        console.error('\n❌ Integration Test FAILED:', err.message);
    } finally {
        // await cleanupAgent(agentId);
        console.log(`\n⚠️ Cleanup SKIPPED for inspection. Container: openclaw-${agentId}`);
    }
}

main();
