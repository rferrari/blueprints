import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AgentStateMismatch {
    agent_id: string;
    desired_enabled: boolean;
    desired_config: any;
    actual_status: string;
    actual_runtime_id: string;
    eliza_api_url: string;
    auth_token: string;
}

async function reconcile() {
    console.log('--- Reconciling Agents ---');

    // 1. Get all agents with their states
    const { data: agents, error } = await supabase
        .from('agents')
        .select(`
            id,
            agent_desired_state(enabled, config, purge_at),
            agent_actual_state(status, runtime_id),
            project_id
        `) as any;

    if (error) {
        console.error('Error fetching agents:', error);
        return;
    }

    const now = new Date();

    // 2. Process each agent
    for (const agent of agents) {
        const desired = agent.agent_desired_state;
        const actual = agent.agent_actual_state;

        if (!desired || !actual) continue;

        // Check Purge Logic
        if (desired.purge_at) {
            const purgeDate = new Date(desired.purge_at);
            const stopDate = new Date(purgeDate.getTime() - (24 * 60 * 60 * 1000));

            // Stage 1: Absolute Purge (Time to delete)
            if (now >= purgeDate) {
                console.log(`[PURGE] Executing final deletion for agent ${agent.id}...`);
                await supabase.from('agents').delete().eq('id', agent.id);
                continue; // Agent is gone
            }

            // Stage 2: Stopping Sequence (Time to stop)
            if (now >= stopDate && desired.enabled) {
                console.log(`[PURGE] Entering decommissioning for agent ${agent.id}. Disabling...`);
                await supabase.from('agent_desired_state').update({ enabled: false }).eq('agent_id', agent.id);
                desired.enabled = false; // Update local state for subsequent logic
            }
        }

        // Standard Reconcile
        // If enabled but not running -> Start
        if (desired.enabled && actual.status !== 'running') {
            await startAgent(agent.id, desired.config);
        }
        // If disabled but running -> Stop
        else if (!desired.enabled && actual.status === 'running') {
            await stopAgent(agent.id);
        }
    }
}

async function startAgent(agentId: string, config: any) {
    console.log(`Starting agent ${agentId}...`);

    // In a real scenario, we would find a runtime to host this agent
    // For MVP, let's assume there's one runtime in the DB
    const { data: runtime } = await supabase.from('runtimes').select('*').limit(1).single();

    if (!runtime) {
        console.error('No runtime available to start agent');
        return;
    }

    try {
        // Update actual state to starting
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'starting',
            runtime_id: runtime.id
        });

        // 1. Check if agent exists on runtime or just try to create/update it
        // ElizaOS POST /api/agents handles creation/update from character JSON
        console.log(`Ensuring agent ${agentId} is registered on runtime...`);
        await axios.post(`${runtime.eliza_api_url}/agents`, {
            agent: { ...config, id: agentId }
        }, {
            headers: { 'Authorization': `Bearer ${runtime.auth_token}` }
        });

        // 2. Call ElizaOS API to start
        console.log(`Sending start command to runtime for agent ${agentId}...`);
        await axios.post(`${runtime.eliza_api_url}/agents/${agentId}/start`, {}, {
            headers: { 'Authorization': `Bearer ${runtime.auth_token}` }
        });

        // Update actual state to running
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'running',
            last_sync: new Date().toISOString()
        });

        console.log(`Agent ${agentId} started successfully.`);
    } catch (err: any) {
        console.error(`Failed to start agent ${agentId}:`, err.message);
        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'error',
            error_message: err.message
        });
    }
}

async function stopAgent(agentId: string) {
    console.log(`Stopping agent ${agentId}...`);

    const { data: actual } = await supabase
        .from('agent_actual_state')
        .select('runtime_id')
        .eq('agent_id', agentId)
        .single();

    if (!actual?.runtime_id) return;

    const { data: runtime } = await supabase
        .from('runtimes')
        .select('*')
        .eq('id', actual.runtime_id)
        .single();

    if (!runtime) return;

    try {
        await axios.post(`${runtime.eliza_api_url}/agents/${agentId}/stop`, {}, {
            headers: { 'Authorization': `Bearer ${runtime.auth_token}` }
        });

        await supabase.from('agent_actual_state').upsert({
            agent_id: agentId,
            status: 'stopped',
            runtime_id: null,
            last_sync: new Date().toISOString()
        });

        console.log(`Agent ${agentId} stopped successfully.`);
    } catch (err: any) {
        console.error(`Failed to stop agent ${agentId}:`, err.message);
    }
}

// Run the reconciler every 10 seconds
setInterval(reconcile, 10000);
reconcile();
