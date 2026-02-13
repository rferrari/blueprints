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

export interface LeaseValidation {
    valid: boolean;
    leaseId: string;
    expiresAt: string;
    provider: string;
    error?: string;
}

/**
 * Validate that an agent's lease is still active.
 * 
 * Called by the reconciler before starting an agent that uses a managed key.
 * If the lease is invalid, the reconciler should stop the agent.
 * 
 * NOTE: The config itself is already written to agent_desired_state by the
 * backend when the lease is granted — no config injection needed here.
 */
export async function validateAgentLease(
    agentId: string,
    metadata: Record<string, any>
): Promise<LeaseValidation | null> {
    const leaseId = metadata?.lease_id;
    if (!leaseId) return null; // Not a managed key agent

    const sb = getSupabase();
    const { data: lease, error } = await sb
        .from('key_leases')
        .select('id, status, expires_at, managed_key_id, managed_provider_keys(provider, active)')
        .eq('id', leaseId)
        .single();

    if (error || !lease) {
        return {
            valid: false,
            leaseId,
            expiresAt: '',
            provider: metadata.managed_key_provider || 'unknown',
            error: 'Lease not found',
        };
    }

    const managedKey = (lease as any).managed_provider_keys;

    // Check lease status
    if (lease.status !== LeaseStatus.ACTIVE) {
        return {
            valid: false,
            leaseId,
            expiresAt: lease.expires_at,
            provider: managedKey?.provider || 'unknown',
            error: `Lease is ${lease.status}`,
        };
    }

    // Check expiration
    if (new Date(lease.expires_at) < new Date()) {
        // Proactively mark expired
        await sb
            .from('key_leases')
            .update({ status: LeaseStatus.EXPIRED })
            .eq('id', leaseId);

        return {
            valid: false,
            leaseId,
            expiresAt: lease.expires_at,
            provider: managedKey?.provider || 'unknown',
            error: 'Lease has expired',
        };
    }

    // Check managed key is still active
    if (!managedKey?.active) {
        return {
            valid: false,
            leaseId,
            expiresAt: lease.expires_at,
            provider: managedKey?.provider || 'unknown',
            error: 'Managed provider key has been disabled',
        };
    }

    // Update last used
    await sb
        .from('key_leases')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', leaseId);

    return {
        valid: true,
        leaseId,
        expiresAt: lease.expires_at,
        provider: managedKey.provider,
    };
}

/**
 * Stop an agent that has an invalid lease.
 * Sets status to error and disables the agent.
 */
export async function stopAgentForInvalidLease(
    agentId: string,
    reason: string
): Promise<void> {
    const sb = getSupabase();

    await sb
        .from('agent_actual_state')
        .upsert({
            agent_id: agentId,
            status: 'error',
            error_message: `Managed key: ${reason}. Agent stopped automatically.`,
            updated_at: new Date().toISOString(),
        });

    await sb
        .from('agent_desired_state')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('agent_id', agentId);
}
