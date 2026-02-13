import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LeaseStatus } from '@eliza-manager/shared';

let supabase: SupabaseClient;

function getSupabase(): SupabaseClient {
    if (!supabase) {
        supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return supabase;
}

const CRON_INTERVAL_MS = 60 * 1000; // 60 seconds

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Expire stale leases and stop their attached agents.
 */
async function expireLeases(): Promise<void> {
    const sb = getSupabase();

    try {
        // 1. Find active leases that have expired
        const { data: expiredLeases, error } = await sb
            .from('key_leases')
            .select('id')
            .eq('status', LeaseStatus.ACTIVE)
            .lt('expires_at', new Date().toISOString());

        if (error) {
            console.error('[lease-cron] Error querying expired leases:', error.message);
            return;
        }

        if (!expiredLeases?.length) return;

        const leaseIds = expiredLeases.map((l: any) => l.id);

        // 2. Mark them expired
        const { error: updateError } = await sb
            .from('key_leases')
            .update({ status: LeaseStatus.EXPIRED })
            .in('id', leaseIds);

        if (updateError) {
            console.error('[lease-cron] Error expiring leases:', updateError.message);
            return;
        }

        console.log(`[lease-cron] Expired ${leaseIds.length} lease(s): ${leaseIds.join(', ')}`);

        // 3. Find agents using these leases and stop them
        for (const leaseId of leaseIds) {
            const { data: agents } = await sb
                .from('agent_desired_state')
                .select('agent_id')
                .contains('metadata', { lease_id: leaseId })
                .eq('enabled', true);

            if (agents?.length) {
                for (const agent of agents) {
                    console.log(`[lease-cron] Stopping agent ${agent.agent_id} (lease ${leaseId} expired)`);

                    await sb
                        .from('agent_actual_state')
                        .upsert({
                            agent_id: agent.agent_id,
                            status: 'error',
                            error_message: 'Shared API key lease has expired. Agent stopped automatically.',
                            updated_at: new Date().toISOString(),
                        });

                    await sb
                        .from('agent_desired_state')
                        .update({ enabled: false, updated_at: new Date().toISOString() })
                        .eq('agent_id', agent.agent_id);
                }
            }
        }
    } catch (err) {
        console.error('[lease-cron] Unexpected error:', err);
    }
}

/**
 * Start the lease expiration cron job.
 */
export function startLeaseCron(): void {
    if (intervalId) return; // Already running

    console.log('[lease-cron] Starting lease expiration cron (every 60s)');
    intervalId = setInterval(expireLeases, CRON_INTERVAL_MS);

    // Run once immediately
    expireLeases();
}

/**
 * Stop the lease expiration cron job.
 */
export function stopLeaseCron(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[lease-cron] Stopped lease expiration cron');
    }
}
