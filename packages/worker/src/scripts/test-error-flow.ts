import { supabase } from '../lib/supabase';
import { cryptoUtils } from '@eliza-manager/shared/crypto';

// Test Configuration
const AGENT_COUNT = 1;

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getOrCreateProject() {
    const { data: projects } = await supabase.from('projects').select('id').limit(1);
    if (projects && projects.length > 0) return projects[0].id;
    throw new Error('No projects found. Please create a project in the UI first.');
}

async function createTestAgent(projectId: string) {
    console.log(`\n🏗️  Creating Test Agent (OpenClaw)...`);
    const name = `Test-Error-${Date.now()}`;
    const { data: agent, error } = await supabase
        .from('agents')
        .insert([{ project_id: projectId, name, framework: 'openclaw' }])
        .select()
        .single();

    if (error) throw error;

    // Init Actual State
    await supabase.from('agent_actual_state').insert([{ agent_id: agent.id, status: 'stopped' }]);

    return agent;
}

async function cleanupAgent(agentId: string) {
    console.log('\n🧹 Cleaning up test agent...');
    await supabase.from('agents').delete().eq('id', agentId);
    console.log('✅ Cleanup complete.');
}

async function testErrorFlow(agent: any) {
    console.log('\n🚀 TEST: Error Persistence & Clearance');
    console.log('------------------------------------------------');

    // A. Simulate Error State (as if Reconciler put it there)
    console.log('1. Simulating Error State...');
    const errorMsg = "Simulated Docker Error";
    await supabase.from('agent_actual_state').update({
        status: 'error',
        error_message: errorMsg
    }).eq('agent_id', agent.id);

    // Verify it's there
    let state = await supabase.from('agent_actual_state').select('error_message').eq('agent_id', agent.id).single();
    if (state.data?.error_message === errorMsg) console.log('✅ Error persisted correctly.');
    else console.error('❌ Error NOT persisted.');

    // B. Simulate Successful Start (as if Handler succeeded)
    console.log('2. Simulating Success (Re-Start)...');

    // Set desired state to Enabled with valid config
    console.log('Enable agent (Valid Config)...');

    const validConfig = {
        auth: { profiles: { default: { provider: 'venice', mode: 'api_key', token: '' } } },
        gateway: { auth: { mode: 'token', token: 'test-token' } },
        agents: {
            defaults: { workspace: "~/.openclaw/workspace", maxConcurrent: 4 },
            list: [{ id: "main", name: agent.name, workspace: "~/.openclaw/workspace" }]
        }
    };

    await supabase.from('agent_desired_state').insert([{
        agent_id: agent.id,
        enabled: true,
        config: cryptoUtils.encryptConfig(validConfig),
        metadata: {}
    }]);

    // We need to wait for Reconciler to pick it up and mark it running.
    console.log('Waiting for Agent to reach RUNNING state...');
    let isRunning = false;
    const start = Date.now();

    // OpenClaw starts faster, let's wait up to 30s
    while (!isRunning && (Date.now() - start < 30000)) {
        const { data } = await supabase.from('agent_actual_state').select('status, error_message').eq('agent_id', agent.id).single();
        if (data?.status === 'running') {
            isRunning = true;
            if (data.error_message === null) {
                console.log('✅ Error message CLEARED upon success!');
            } else {
                console.error(`❌ Error message persisted: ${data.error_message}`);
            }
        }
        await sleep(1000);
    }

    if (!isRunning) console.log('⚠️ Timed out waiting for running state.');
}

async function main() {
    try {
        const projectId = await getOrCreateProject();
        const agent = await createTestAgent(projectId);
        await testErrorFlow(agent);
        await cleanupAgent(agent.id);
    } catch (err: any) {
        console.error('Test Failed:', err);
    }
}

main();
