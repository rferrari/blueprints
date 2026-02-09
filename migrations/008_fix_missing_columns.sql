-- Add missing columns identified by integrity check

-- 1. Add tier to projects
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'tier') THEN
        ALTER TABLE public.projects ADD COLUMN tier text NOT NULL DEFAULT 'free';
    END IF;
END $$;

-- 2. Add template_id to agents
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'template_id') THEN
        ALTER TABLE public.agents ADD COLUMN template_id text;
    END IF;
END $$;
