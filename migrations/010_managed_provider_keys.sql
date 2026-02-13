-- MIGRATION 010: Managed Provider Keys (MPK) Plugin
-- Feature-flagged system for Blueprint-managed API keys

-- 1. Managed Provider Keys Table (admin-owned)
CREATE TABLE IF NOT EXISTS public.managed_provider_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'openrouter',
    label TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- config stores full provider configuration per framework:
    -- {
    --   "default_model": "openrouter/auto",
    --   "fallback_models": ["anthropic/claude-3.5-sonnet", "openai/gpt-4o"],
    --   "base_url": "https://openrouter.ai/api/v1",
    --   "model_api": "openai-completions",
    --   "frameworks": {
    --     "openclaw": { ... openclaw config overrides ... },
    --     "eliza": { ... eliza config overrides ... }
    --   }
    -- }
    daily_limit_usd NUMERIC(10,2),
    monthly_limit_usd NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.managed_provider_keys ENABLE ROW LEVEL SECURITY;

-- 2. Key Leases Table (user access grants)
CREATE TABLE IF NOT EXISTS public.key_leases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    managed_key_id UUID REFERENCES public.managed_provider_keys(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    usage_usd NUMERIC(10,4) DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    max_agents INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.key_leases ENABLE ROW LEVEL SECURITY;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_key_leases_user_id ON public.key_leases(user_id);
CREATE INDEX IF NOT EXISTS idx_key_leases_managed_key_id ON public.key_leases(managed_key_id);
CREATE INDEX IF NOT EXISTS idx_key_leases_status ON public.key_leases(status);
CREATE INDEX IF NOT EXISTS idx_managed_keys_provider ON public.managed_provider_keys(provider);

-- 4. RLS Policies

-- managed_provider_keys: admin-only
DROP POLICY IF EXISTS "Admins manage managed provider keys" ON public.managed_provider_keys;
CREATE POLICY "Admins manage managed provider keys" ON public.managed_provider_keys
    FOR ALL USING (public.is_admin());

-- key_leases: users can see own, admins can see all
DROP POLICY IF EXISTS "Users see own leases" ON public.key_leases;
CREATE POLICY "Users see own leases" ON public.key_leases
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage all leases" ON public.key_leases;
CREATE POLICY "Admins manage all leases" ON public.key_leases
    FOR ALL USING (public.is_admin());
