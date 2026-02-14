-- BLUEPRINTS MANAGER COMPLETE UNIFIED SCHEMA
-- Consolidates Migrations 001 through 009

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (RBAC & Tiering)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin_read', 'super_admin')),
    tier TEXT NOT NULL DEFAULT 'free',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'enterprise'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 3. Runtimes Table
CREATE TABLE IF NOT EXISTS public.runtimes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    eliza_api_url TEXT NOT NULL,
    auth_token TEXT NOT NULL,
    version TEXT DEFAULT 'latest',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.runtimes ENABLE ROW LEVEL SECURITY;

-- 4. Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    version TEXT DEFAULT 'latest',
    framework TEXT DEFAULT 'eliza', -- 'eliza', 'openclaw'
    template_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- 5. Agent Desired State
CREATE TABLE IF NOT EXISTS public.agent_desired_state (
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    purge_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agent_desired_state ENABLE ROW LEVEL SECURITY;

-- 6. Agent Actual State
CREATE TABLE IF NOT EXISTS public.agent_actual_state (
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE PRIMARY KEY,
    status TEXT DEFAULT 'stopped',
    last_sync TIMESTAMP WITH TIME ZONE,
    runtime_id UUID REFERENCES public.runtimes(id) ON DELETE SET NULL,
    endpoint_url TEXT,
    effective_security_tier TEXT, -- Audit trail
    error_message TEXT
);

ALTER TABLE public.agent_actual_state ENABLE ROW LEVEL SECURITY;

-- 7. Agent Conversations
CREATE TABLE IF NOT EXISTS public.agent_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    sender TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

-- 8. Feedback Tables
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.upgrade_feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    plan_selected TEXT, -- 'Pro', 'Enterprise'
    payment_method TEXT, -- 'card', 'crypto', 'waitlist'
    crypto_type TEXT, -- 'USDC', 'USDT', 'BTC', 'ETH', 'Other'
    desired_plans JSONB, -- Array of { plan: string, value: string }
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.upgrade_feedback ENABLE ROW LEVEL SECURITY;

-- 9. Deployments Table
CREATE TABLE IF NOT EXISTS public.deployments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    commit_hash TEXT NOT NULL,
    branch TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

-- 10. Support Infrastructure
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.support_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_hash TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.support_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.support_sessions(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'agent', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_conv_session_sequence ON public.support_conversations(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_support_conv_session_id ON public.support_conversations(session_id);

-- 11. Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role IN ('admin_read', 'super_admin')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, tier)
    VALUES (
        new.id, 
        new.email, 
        'user',
        COALESCE(new.raw_user_meta_data->>'tier', 'free')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_old_support_data(days_threshold INTEGER DEFAULT 30)
RETURNS TABLE (deleted_sessions INTEGER, deleted_conversations INTEGER) AS $$
DECLARE
    s_count INTEGER;
BEGIN
    DELETE FROM public.support_sessions
    WHERE created_at < now() - (days_threshold || ' days')::INTERVAL;
    GET DIAGNOSTICS s_count = ROW_COUNT;

    RETURN QUERY SELECT s_count, 0; -- Conversations are deleted via cascade
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    END IF;
END $$;

-- 13. Policies

-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Projects: Owner or Admin
DROP POLICY IF EXISTS "Users and Admins can see projects" ON public.projects;
CREATE POLICY "Users and Admins can see projects" ON public.projects
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- Agents: Project Owner or Admin
DROP POLICY IF EXISTS "Users and Admins can see agents" ON public.agents;
CREATE POLICY "Users and Admins can see agents" ON public.agents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE public.projects.id = public.agents.project_id
            AND (public.projects.user_id = auth.uid() OR public.is_admin())
        )
    );

-- Desired State
DROP POLICY IF EXISTS "Users and Admins can see desired state" ON public.agent_desired_state;
CREATE POLICY "Users and Admins can see desired state" ON public.agent_desired_state
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.agents
            JOIN public.projects ON public.projects.id = public.agents.project_id
            WHERE public.agents.id = public.agent_desired_state.agent_id
            AND (public.projects.user_id = auth.uid() OR public.is_admin())
        )
    );

-- Actual State
DROP POLICY IF EXISTS "Users and Admins can see actual state" ON public.agent_actual_state;
CREATE POLICY "Users and Admins can see actual state" ON public.agent_actual_state
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.agents
            JOIN public.projects ON public.projects.id = public.agents.project_id
            WHERE public.agents.id = public.agent_actual_state.agent_id
            AND (public.projects.user_id = auth.uid() OR public.is_admin())
        )
    );

-- Conversations
DROP POLICY IF EXISTS "Users and Admins can see conversations" ON public.agent_conversations;
CREATE POLICY "Users and Admins can see conversations" ON public.agent_conversations
    FOR ALL USING (user_id = auth.uid() OR public.is_admin());

-- Runtimes
DROP POLICY IF EXISTS "Admins manage runtimes" ON public.runtimes;
CREATE POLICY "Admins manage runtimes" ON public.runtimes
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users see runtimes" ON public.runtimes;
CREATE POLICY "Users see runtimes" ON public.runtimes
    FOR SELECT USING (true);

-- Feedback
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
CREATE POLICY "Users can insert own feedback" ON public.feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can see feedback" ON public.feedback;
CREATE POLICY "Admins can see feedback" ON public.feedback
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Users can see own feedback" ON public.feedback;
CREATE POLICY "Users can see own feedback" ON public.feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Upgrade Feedback
DROP POLICY IF EXISTS "Users can insert own upgrade feedback" ON public.upgrade_feedback;
CREATE POLICY "Users can insert own upgrade feedback" ON public.upgrade_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can see upgrade feedback" ON public.upgrade_feedback;
CREATE POLICY "Admins can see upgrade feedback" ON public.upgrade_feedback
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Users can see own upgrade feedback" ON public.upgrade_feedback;
CREATE POLICY "Users can see own upgrade feedback" ON public.upgrade_feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Deployments
DROP POLICY IF EXISTS "Admins can view deployments" ON public.deployments;
CREATE POLICY "Admins can view deployments" ON public.deployments
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Service role can manage deployments" ON public.deployments;
CREATE POLICY "Service role can manage deployments" ON public.deployments
    FOR ALL USING (true);

-- Support
DROP POLICY IF EXISTS "Admins manage all support sessions" ON public.support_sessions;
CREATE POLICY "Admins manage all support sessions" ON public.support_sessions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage all support conversations" ON public.support_conversations;
CREATE POLICY "Admins manage all support conversations" ON public.support_conversations FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users see own support sessions" ON public.support_sessions;
CREATE POLICY "Users see own support sessions" ON public.support_sessions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users see own support conversations" ON public.support_conversations;
CREATE POLICY "Users see own support conversations" ON public.support_conversations FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.support_sessions WHERE id = session_id AND user_id = auth.uid())
);

-- 14. Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'agent_conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_conversations;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'support_conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
    END IF;
END $$;
