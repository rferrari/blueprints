import { FastifyPluginAsync } from 'fastify';
import {
    CreateManagedKeySchema,
    UpdateManagedKeySchema,
    RequestLeaseSchema,
    ExtendLeaseSchema,
    UserTier,
    LEASE_TIER_CONFIG,
    LeaseStatus,
} from '@eliza-manager/shared';
import { cryptoUtils } from '@eliza-manager/shared/crypto';

const buildAgentConfig = (selectedKey: any, existingConfig: any, framework: string) => {
    const managedConfig = selectedKey.config || {};
    const model = managedConfig.default_model || 'openrouter/auto';
    const baseUrl = managedConfig.base_url || 'https://openrouter.ai/api/v1';
    const modelApi = managedConfig.model_api || 'openai-completions';
    const modelParts = model.split('/');
    const modelId = modelParts.length > 1 ? modelParts.slice(1).join('/') : model;
    const providerName = 'openrouter';

    if (framework === 'openclaw') {
        const frameworkOverrides = managedConfig.frameworks?.openclaw || {};
        return {
            ...existingConfig,
            auth: {
                ...(existingConfig.auth || {}),
                profiles: {
                    ...(existingConfig.auth?.profiles || {}),
                    'default': { provider: providerName, mode: 'api_key' },
                },
            },
            models: {
                ...(existingConfig.models || {}),
                providers: {
                    ...(existingConfig.models?.providers || {}),
                    [providerName]: {
                        apiKey: selectedKey.encrypted_key,
                        baseUrl,
                        models: [{ id: modelId, name: model, api: modelApi, compat: {} }],
                    },
                },
            },
            agents: {
                ...(existingConfig.agents || {}),
                defaults: {
                    ...(existingConfig.agents?.defaults || {}),
                    model: {
                        ...(existingConfig.agents?.defaults?.model || {}),
                        primary: model
                    },
                    models: {
                        ...(existingConfig.agents?.defaults?.models || {}),
                        [model]: {}
                    },
                },
            },
            ...frameworkOverrides,
        };
    } else {
        const frameworkOverrides = managedConfig.frameworks?.[framework] || {};
        return {
            ...existingConfig,
            modelProvider: providerName,
            apiKey: selectedKey.encrypted_key,
            ...frameworkOverrides,
        };
    }
};

const managedKeysPlugin: FastifyPluginAsync = async (fastify) => {

    // ═══════════════════════════════════════════
    // ADMIN ROUTES — /admin/managed-keys
    // Uses fastify.adminGuard preHandler hook
    // ═══════════════════════════════════════════

    fastify.register(async (admin) => {
        admin.addHook('preHandler', fastify.adminGuard);

        // Create a managed key
        admin.post('/admin/managed-keys', async (request, reply) => {
            const body = CreateManagedKeySchema.parse(request.body);

            const encrypted_key = cryptoUtils.encrypt(body.api_key);

            const { data, error } = await fastify.supabase
                .from('managed_provider_keys')
                .insert([{
                    provider: body.provider,
                    label: body.label,
                    encrypted_key,
                    config: body.config,
                    daily_limit_usd: body.daily_limit_usd,
                    monthly_limit_usd: body.monthly_limit_usd,
                }])
                .select('id, provider, label, active, config, daily_limit_usd, monthly_limit_usd, created_at')
                .single();

            if (error) throw error;
            return reply.code(201).send(data);
        });

        // List all managed keys (no raw key exposed)
        admin.get('/admin/managed-keys', async () => {
            const { data, error } = await fastify.supabase
                .from('managed_provider_keys')
                .select('id, provider, label, active, config, daily_limit_usd, monthly_limit_usd, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Enrich with lease counts
            const enriched = await Promise.all((data || []).map(async (key: any) => {
                const { count } = await fastify.supabase
                    .from('key_leases')
                    .select('*', { count: 'exact', head: true })
                    .eq('managed_key_id', key.id)
                    .eq('status', LeaseStatus.ACTIVE);

                return { ...key, active_leases: count || 0 };
            }));

            return enriched;
        });

        // Update a managed key
        admin.patch('/admin/managed-keys/:id', async (request) => {
            const { id } = request.params as { id: string };
            const body = UpdateManagedKeySchema.parse(request.body);

            const updates: any = {};
            if (body.label !== undefined) updates.label = body.label;
            if (body.active !== undefined) updates.active = body.active;
            if (body.config !== undefined) {
                // Merge with existing config
                const { data: existing } = await fastify.supabase
                    .from('managed_provider_keys')
                    .select('config')
                    .eq('id', id)
                    .single();

                updates.config = { ...(existing?.config || {}), ...body.config };
            }
            if (body.daily_limit_usd !== undefined) updates.daily_limit_usd = body.daily_limit_usd;
            if (body.monthly_limit_usd !== undefined) updates.monthly_limit_usd = body.monthly_limit_usd;

            const { data, error } = await fastify.supabase
                .from('managed_provider_keys')
                .update(updates)
                .eq('id', id)
                .select('id, provider, label, active, config, daily_limit_usd, monthly_limit_usd, created_at')
                .single();

            if (error) throw error;

            // Trigger Reset for all affected agents
            if (body.active === false || body.config !== undefined) {
                fastify.log.info({ keyId: id }, 'Managed key modified, triggering agent resets');

                // Find all active leases for this key
                const { data: leases } = await fastify.supabase
                    .from('key_leases')
                    .select('agent_id, user_id')
                    .eq('managed_key_id', id)
                    .eq('status', LeaseStatus.ACTIVE);

                if (leases && leases.length > 0) {
                    for (const lease of leases) {
                        const { agent_id } = lease;

                        // Fetch agent to get framework
                        const { data: agent } = await fastify.supabase
                            .from('agents')
                            .select('framework')
                            .eq('id', agent_id)
                            .single();

                        if (!agent) continue;

                        const { data: state } = await fastify.supabase
                            .from('agent_desired_state')
                            .select('config, metadata')
                            .eq('agent_id', agent_id)
                            .single();

                        const currentConfig = cryptoUtils.decryptConfig(state?.config || {});
                        let nextConfig: any;
                        let nextMetadata = { ...(state?.metadata || {}) };

                        if (body.active === false) {
                            // Revoke leases
                            await fastify.supabase
                                .from('key_leases')
                                .update({ status: LeaseStatus.REVOKED, revoked_at: new Date().toISOString() })
                                .eq('managed_key_id', id)
                                .eq('status', LeaseStatus.ACTIVE);

                            // Clear lease metadata from agent
                            delete nextMetadata.lease_id;
                            delete nextMetadata.lease_expires_at;
                            delete nextMetadata.managed_key_provider;

                            // Clear managed key config details
                            if (agent.framework === 'openclaw') {
                                if (nextConfig.auth?.profiles?.default?.provider === 'openrouter') {
                                    delete nextConfig.auth.profiles.default;
                                }
                                if (nextConfig.models?.providers?.openrouter) {
                                    delete nextConfig.models.providers.openrouter;
                                }
                            } else {
                                delete nextConfig.modelProvider;
                                delete nextConfig.apiKey;
                            }
                        } else {
                            // Key still active but config changed - re-build
                            nextConfig = buildAgentConfig(data, currentConfig, agent.framework);
                        }

                        await fastify.supabase
                            .from('agent_desired_state')
                            .update({
                                config: cryptoUtils.encryptConfig(nextConfig),
                                metadata: nextMetadata,
                                updated_at: new Date().toISOString()
                            })
                            .eq('agent_id', agent_id);
                    }
                }
            }

            return data;
        });

        // Disable (soft-delete) a managed key
        admin.delete('/admin/managed-keys/:id', async (request) => {
            const { id } = request.params as { id: string };

            const { data, error } = await fastify.supabase
                .from('managed_provider_keys')
                .update({ active: false })
                .eq('id', id)
                .select('id, active')
                .single();

            if (error) throw error;
            return data;
        });

        // List leases for a specific managed key
        admin.get('/admin/managed-keys/:id/leases', async (request) => {
            const { id } = request.params as { id: string };

            const { data, error } = await fastify.supabase
                .from('key_leases')
                .select('*, profiles:user_id(email)')
                .eq('managed_key_id', id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        });

        // Revoke a lease
        admin.post('/admin/managed-keys/leases/:id/revoke', async (request) => {
            const { id } = request.params as { id: string };

            const { data, error } = await fastify.supabase
                .from('key_leases')
                .update({
                    status: LeaseStatus.REVOKED,
                    revoked_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('status', LeaseStatus.ACTIVE)
                .select()
                .single();

            if (error) throw error;
            if (!data) throw fastify.httpErrors.notFound('Active lease not found');

            return data;
        });

        // Extend a lease
        admin.post('/admin/managed-keys/leases/:id/extend', async (request) => {
            const { id } = request.params as { id: string };
            const { additional_days } = ExtendLeaseSchema.parse(request.body);

            // Get current lease
            const { data: lease, error: leaseError } = await fastify.supabase
                .from('key_leases')
                .select('*')
                .eq('id', id)
                .single();

            if (leaseError || !lease) throw fastify.httpErrors.notFound('Lease not found');

            const currentExpiry = new Date(lease.expires_at);
            const newExpiry = new Date(currentExpiry.getTime() + (additional_days * 24 * 60 * 60 * 1000));

            const updates: any = { expires_at: newExpiry.toISOString() };
            // Re-activate if it was expired
            if (lease.status === LeaseStatus.EXPIRED) {
                updates.status = LeaseStatus.ACTIVE;
            }

            const { data, error } = await fastify.supabase
                .from('key_leases')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        });
    });

    // ═══════════════════════════════════════════
    // USER ROUTES — /managed-keys
    // ═══════════════════════════════════════════

    // Request a new lease + write config to agent
    fastify.post('/managed-keys/lease', async (request, reply) => {
        const userId = request.userId;
        if (!userId) throw fastify.httpErrors.unauthorized('Authentication required');

        const { provider, agent_id, framework } = RequestLeaseSchema.parse(request.body);

        // 1. Get user tier for lease limits
        const { data: profile } = await fastify.supabase
            .from('profiles')
            .select('tier')
            .eq('id', userId)
            .single();

        const userTier = (profile?.tier as UserTier) || UserTier.FREE;
        const tierConfig = LEASE_TIER_CONFIG[userTier] || LEASE_TIER_CONFIG[UserTier.FREE];

        // 2. Check if user already has too many active leases
        const { count: activeLeases } = await fastify.supabase
            .from('key_leases')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', LeaseStatus.ACTIVE);

        if ((activeLeases || 0) >= tierConfig.max_agents) {
            throw fastify.httpErrors.forbidden(
                `Active lease limit reached for ${userTier.toUpperCase()} tier (${tierConfig.max_agents} max)`
            );
        }

        // 3. Select least-used active managed key for provider
        const { data: keys, error: keysError } = await fastify.supabase
            .from('managed_provider_keys')
            .select('*')
            .eq('provider', provider)
            .eq('active', true);

        if (keysError || !keys?.length) {
            throw fastify.httpErrors.serviceUnavailable('No managed keys available for this provider');
        }

        // Count active leases per key and pick least-used
        const keyUsage = await Promise.all(keys.map(async (key: any) => {
            const { count } = await fastify.supabase
                .from('key_leases')
                .select('*', { count: 'exact', head: true })
                .eq('managed_key_id', key.id)
                .eq('status', LeaseStatus.ACTIVE);
            return { key, usage: count || 0 };
        }));

        keyUsage.sort((a, b) => a.usage - b.usage);
        const selectedKey = keyUsage[0].key;

        // 4. Create lease
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + tierConfig.duration_days);

        const { data: lease, error: leaseError } = await fastify.supabase
            .from('key_leases')
            .insert([{
                managed_key_id: selectedKey.id,
                user_id: userId,
                agent_id, // Store the agent_id
                expires_at: expiresAt.toISOString(),
                max_agents: tierConfig.max_agents,
            }])
            .select()
            .single();

        if (leaseError) throw leaseError;

        // 5. Build framework config and write to agent
        const { data: agentState } = await fastify.supabase
            .from('agent_desired_state')
            .select('config, metadata')
            .eq('agent_id', agent_id)
            .single();

        const existingConfig = cryptoUtils.decryptConfig(agentState?.config || {});
        const agentConfig = buildAgentConfig(selectedKey, existingConfig, framework);

        // 6. Write config + lease metadata to agent desired state
        const { error: updateError } = await fastify.supabase
            .from('agent_desired_state')
            .update({
                config: cryptoUtils.encryptConfig(agentConfig),
                metadata: {
                    ...(agentState?.metadata || {}),
                    lease_id: lease.id,
                    lease_expires_at: lease.expires_at,
                    managed_key_provider: provider,
                },
                updated_at: new Date().toISOString(),
            })
            .eq('agent_id', agent_id);

        if (updateError) throw updateError;

        const model = selectedKey.config?.default_model || 'openrouter/auto';

        return reply.code(201).send({
            lease_id: lease.id,
            expires_at: lease.expires_at,
            provider,
            model,
            tier: userTier,
            duration_days: tierConfig.duration_days,
        });
    });

    // Get current user's active leases
    fastify.get('/managed-keys/lease', async (request) => {
        const userId = request.userId;
        if (!userId) throw fastify.httpErrors.unauthorized('Authentication required');

        const { data, error } = await fastify.supabase
            .from('key_leases')
            .select('id, managed_key_id, granted_at, expires_at, status, usage_usd, last_used_at, max_agents, managed_provider_keys(provider, label, config)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    });
};

export default managedKeysPlugin;
