-- MCP Server Schema Migration

-- 1. Update system_settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. User API Keys for MCP
CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- 3. MCP Audit Logs
CREATE TABLE IF NOT EXISTS public.mcp_audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    mcp_key_id UUID REFERENCES public.user_api_keys(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tool_name TEXT NOT NULL,
    agent_id UUID, -- Setup FK to agents? Optional, as agent might be deleted. keep loose for audit.
    payload_summary JSONB,
    status TEXT NOT NULL, -- 'success', 'failure'
    error_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.mcp_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies

-- user_api_keys
DROP POLICY IF EXISTS "Users manage own keys" ON public.user_api_keys;
CREATE POLICY "Users manage own keys" ON public.user_api_keys
    FOR ALL USING (auth.uid() = user_id);

-- mcp_audit_logs
DROP POLICY IF EXISTS "Admins view all mcp logs" ON public.mcp_audit_logs;
CREATE POLICY "Admins view all mcp logs" ON public.mcp_audit_logs
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Users view own mcp logs" ON public.mcp_audit_logs;
CREATE POLICY "Users view own mcp logs" ON public.mcp_audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Service Role Policies (for Backend/MCP usage)
-- Assuming service role bypasses RLS, but if not:
-- CREATE POLICY "Service role manages everything" ... 

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON public.user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_user_id ON public.mcp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_created_at ON public.mcp_audit_logs(created_at DESC);
