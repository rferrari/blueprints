-- Add tier column to profiles with default 'free'
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tier') THEN
        ALTER TABLE public.profiles ADD COLUMN tier text NOT NULL DEFAULT 'free';
    END IF;
END $$;

-- Add metadata column to agent_desired_state with default '{}'
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_desired_state' AND column_name = 'metadata') THEN
        ALTER TABLE public.agent_desired_state ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add effective_security_tier column to agent_actual_state
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_actual_state' AND column_name = 'effective_security_tier') THEN
        ALTER TABLE public.agent_actual_state ADD COLUMN effective_security_tier text;
    END IF;
END $$;

-- Update handle_new_user function to set default tier if not provided (though default on column handles it, good practice to be explicit)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, full_name, avatar_url, tier)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'tier', 'free') -- Allow setting tier from metadata if valid, else free
  );
  return new;
end;
$function$;
