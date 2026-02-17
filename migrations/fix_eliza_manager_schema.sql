-- Migration: Sync ElizaManager with Blueprints Schema
-- Description: Adds missing tables (managed_provider_keys, key_leases, blueprints, user_api_keys, mcp_audit_logs) and columns to agent_actual_state.

BEGIN;

-- 1. Managed Provider Keys
CREATE TABLE IF NOT EXISTS public.managed_provider_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    provider TEXT DEFAULT 'openrouter',
    label TEXT,
    encrypted_key TEXT,
    active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb,
    daily_limit_usd NUMERIC,
    monthly_limit_usd NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.managed_provider_keys ENABLE ROW LEVEL SECURITY;

-- 2. Key Leases
CREATE TABLE IF NOT EXISTS public.key_leases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    managed_key_id UUID REFERENCES public.managed_provider_keys(id) NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    agent_id UUID REFERENCES public.agents(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    usage_usd NUMERIC DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    max_agents INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.key_leases ENABLE ROW LEVEL SECURITY;

-- Check if agent_id column exists in key_leases if table already existed (idempotency for column)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'key_leases') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'key_leases' AND column_name = 'agent_id') THEN
             ALTER TABLE public.key_leases ADD COLUMN agent_id UUID REFERENCES public.agents(id);
        END IF;
    END IF;
END $$;


-- 3. Blueprints
CREATE TABLE IF NOT EXISTS public.blueprints (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    framework TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;

-- 4. User API Keys
CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    label TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    prefix TEXT NOT NULL,
    scopes JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- 5. MCP Audit Logs
CREATE TABLE IF NOT EXISTS public.mcp_audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    mcp_key_id UUID REFERENCES public.user_api_keys(id),
    user_id UUID REFERENCES auth.users(id),
    tool_name TEXT NOT NULL,
    agent_id UUID,
    payload_summary JSONB,
    status TEXT NOT NULL,
    error_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.mcp_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. Updates to Agent Actual State
ALTER TABLE public.agent_actual_state ADD COLUMN IF NOT EXISTS version TEXT;
ALTER TABLE public.agent_actual_state ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'::jsonb;

-- 7. Policies (Minimal set for admin/user access to new tables, matching existing patterns)

-- Managed Provider Keys: Only Admins can see/manage
DROP POLICY IF EXISTS "Admins manage provider keys" ON public.managed_provider_keys;
CREATE POLICY "Admins manage provider keys" ON public.managed_provider_keys
    FOR ALL USING (public.is_admin());

-- Key Leases: Users can see own
DROP POLICY IF EXISTS "Users see own key leases" ON public.key_leases;
CREATE POLICY "Users see own key leases" ON public.key_leases
    FOR SELECT USING (user_id = auth.uid());
    
-- Blueprints: Public/Auth read
DROP POLICY IF EXISTS "Authenticated users see blueprints" ON public.blueprints;
CREATE POLICY "Authenticated users see blueprints" ON public.blueprints
    FOR SELECT USING (auth.role() = 'authenticated');
    
-- User API Keys: Users manage own
DROP POLICY IF EXISTS "Users manage own api keys" ON public.user_api_keys;
CREATE POLICY "Users manage own api keys" ON public.user_api_keys
    FOR ALL USING (user_id = auth.uid());

COMMIT;
