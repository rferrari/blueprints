-- Support Agent Proxy Infrastructure

-- 1. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Support Sessions Table (Abuse prevention & Analytics)
CREATE TABLE IF NOT EXISTS public.support_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_hash TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Support Conversations Table
CREATE TABLE IF NOT EXISTS public.support_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.support_sessions(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'agent', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Unique constraint for ordering safety
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_conv_session_sequence ON public.support_conversations(session_id, sequence);

-- 5. Performance Index
CREATE INDEX IF NOT EXISTS idx_support_conv_session_id ON public.support_conversations(session_id);

-- 6. RLS Implementation
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins manage all support sessions" ON public.support_sessions;
CREATE POLICY "Admins manage all support sessions" ON public.support_sessions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage all support conversations" ON public.support_conversations;
CREATE POLICY "Admins manage all support conversations" ON public.support_conversations FOR ALL USING (public.is_admin());

-- Users can see their own sessions/conversations if logged in
DROP POLICY IF EXISTS "Users see own support sessions" ON public.support_sessions;
CREATE POLICY "Users see own support sessions" ON public.support_sessions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users see own support conversations" ON public.support_conversations;
CREATE POLICY "Users see own support conversations" ON public.support_conversations FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.support_sessions WHERE id = session_id AND user_id = auth.uid())
);

-- 7. Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_old_support_data(days_threshold INTEGER DEFAULT 30)
RETURNS TABLE (deleted_sessions INTEGER, deleted_conversations INTEGER) AS $$
DECLARE
    s_count INTEGER;
    c_count INTEGER;
BEGIN
    -- Delete old sessions (cascade will handle conversations)
    DELETE FROM public.support_sessions
    WHERE created_at < now() - (days_threshold || ' days')::INTERVAL;
    GET DIAGNOSTICS s_count = ROW_COUNT;

    RETURN QUERY SELECT s_count, 0; -- Conversations are deleted via cascade
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
