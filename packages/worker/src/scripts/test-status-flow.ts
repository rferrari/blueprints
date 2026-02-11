import { supabase } from '../lib/supabase';
import { cryptoUtils } from '@eliza-manager/shared/crypto';

// Test Configuration
const TEST_PROJECT_ID = 'e0031855-6345-4202-8610-8b5e9668ec77'; // We will fetch this dynamically if possible, or use a hardcoded one if found
const AGENT_COUNT = 3;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOrCreateProject() {
    const { data: projects } = await supabase.from('projects').select('id').limit(1);
    if (projects && projects.length > 0) return projects[0].id;
    throw new Error('No projects found. Please create a project in the UI first.');
}

async function createTestAgents(projectId: string) {
    console.log(`\n🏗️  Creating ${AGENT_COUNT} test agents (OpenClaw)...`);
    const agents = [];

    for (let i = 0; i < AGENT_COUNT; i++) {
        const name = `Test-Claw-${Date.now()}-${i}`;
        const { data: agent, error } = await supabase
            .from('agents')
            .insert([{ project_id: projectId, name, framework: 'openclaw' }])
            .select()
            .single();

        if (error) throw error;

        // Init Desired State for OpenClaw
        const initialConfig = {
            auth: {
                profiles: {
                    default: { provider: 'venice', mode: 'api_key', token: '' }
                }
            },
            gateway: {
                auth: { mode: 'token', token: 'test-token' }
            },
            agents: {
                defaults: {
                    workspace: "~/.openclaw/workspace",
                    maxConcurrent: 4,
                    subagents: { maxConcurrent: 4 },
                    compaction: { mode: "safeguard" }
                },
                list: [
                    {
                        id: "main",
                        name,
                        workspace: "~/.openclaw/workspace"
                    }
                ]
            }
        };

        await supabase.from('agent_desired_state').insert([{
            agent_id: agent.id,
            enabled: false,
            config: cryptoUtils.encryptConfig(initialConfig),
            metadata: {}
        }]);

        // Init Actual State
        await supabase.from('agent_actual_state').insert([{ agent_id: agent.id, status: 'stopped' }]);

        agents.push(agent);
    }
    console.log(`✅ Created: ${agents.map(a => a.name).join(', ')}`);
    return agents;
}

async function cleanupAgents(agentIds: string[]) {
    console.log('\n🧹 Cleaning up test agents...');
    // Delete desired/actual state first (cascade should handle it but being safe)
    await supabase.from('agent_desired_state').delete().in('agent_id', agentIds);
    await supabase.from('agent_actual_state').delete().in('agent_id', agentIds);
    await supabase.from('agents').delete().in('id', agentIds);
    console.log('✅ Cleanup complete.');
}

async function testParallelStart(agents: any[]) {
    console.log('\n🚀 TEST 1: Parallel Start');
    console.log('------------------------------------------------');

    const agentIds = agents.map(a => a.id);

    // 1. Trigger Start for ALL agents "simultaneously"
    console.log('Setting enabled=true for all agents...');
    const startTime = Date.now();

    await Promise.all(agentIds.map(id =>
        supabase.from('agent_desired_state').update({ enabled: true }).eq('agent_id', id)
    ));

    // 2. Poll for status changes
    const statuses: Record<string, string> = {};
    const startTimes: Record<string, number> = {};
    let allRunning = false;

    while (!allRunning && (Date.now() - startTime) < 60000) { // 60s timeout
        const { data: states } = await supabase
            .from('agent_actual_state')
            .select('agent_id, status')
            .in('agent_id', agentIds);

        if (states) {
            states.forEach((s: any) => {
                const prev = statuses[s.agent_id];
                if (prev !== s.status) {
                    console.log(`[${((Date.now() - startTime) / 1000).toFixed(2)}s] Agent ${s.agent_id.slice(0, 8)} transition: ${prev || 'stopped'} -> ${s.status}`);
                    statuses[s.agent_id] = s.status;

                    if (s.status === 'starting' && !startTimes[s.agent_id]) {
                        startTimes[s.agent_id] = Date.now();
                    }
                }
            });

            if (states.every((s: any) => s.status === 'running')) {
                allRunning = true;
            }
        }
        await sleep(500);
    }

    if (allRunning) {
        console.log('✅ All agents reached RUNNING state.');
        // Calculate max delay between first and last "starting" transition
        const times = Object.values(startTimes).sort();
        if (times.length > 1) {
            const spread = times[times.length - 1] - times[0];
            console.log(`⏱️  Spread between start times: ${spread}ms`);
            if (spread < 2000) console.log('✅ Parallelism verified (low spread).');
            else console.warn('⚠️  High spread detected - check concurrency limit.');
        }
    } else {
        console.error('❌ Timeout waiting for all agents to run.');
    }
}

async function testPurgeAbort(agent: any) {
    console.log('\n🛑 TEST 2: Purge Abort Logic');
    console.log('------------------------------------------------');

    // Setup: Stop the agent first
    console.log('Stopping agent...');
    await supabase.from('agent_desired_state').update({ enabled: false }).eq('agent_id', agent.id);

    // Wait for stopped
    let isStopped = false;
    while (!isStopped) {
        const { data } = await supabase.from('agent_actual_state').select('status').eq('agent_id', agent.id).single();
        if (data?.status === 'stopped') isStopped = true;
        else await sleep(500);
    }
    console.log('Agent is STOPPED.');

    // Scenario 1: Purge -> Wait -> Abort (Should stay stopped)
    console.log('Initiating Purge (purge_at = now + 24h)...');
    const purgeAt = new Date(Date.now() + 86400000).toISOString();
    await supabase.from('agent_desired_state').update({ purge_at: purgeAt }).eq('agent_id', agent.id);

    console.log('Simulating user hesitation (2s)...');
    await sleep(2000);

    console.log('Aborting Purge (purge_at = null, enabled = false)...');
    // Ensure we send enabled: false like the frontend now does
    await supabase.from('agent_desired_state').update({ purge_at: null, enabled: false }).eq('agent_id', agent.id);

    console.log('Monitoring for 5s to ensure NO restart...');
    const monitorStart = Date.now();
    let failed = false;
    while (Date.now() - monitorStart < 5000) {
        const { data } = await supabase.from('agent_actual_state').select('status').eq('agent_id', agent.id).single();
        if (data?.status !== 'stopped') {
            console.error(`❌ FAILURE: Agent transitioned to ${data?.status} after abort!`);
            failed = true;
            break;
        }
        await sleep(500);
    }

    if (!failed) console.log('✅ Agent remained stopped. Abort logic verified.');
}

async function main() {
    try {
        const projectId = await getOrCreateProject();
        console.log(`Using Project: ${projectId}`);

        const agents = await createTestAgents(projectId);

        await testParallelStart(agents);
        await testPurgeAbort(agents[0]);

        await cleanupAgents(agents.map(a => a.id));

    } catch (err: any) {
        console.error('Test Failed:', err);
    }
}

main();
