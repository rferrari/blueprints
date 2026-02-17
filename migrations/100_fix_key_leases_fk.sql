-- Migration to fix agent_id foreign key constraint in key_leases
-- Allows deleting agents even if they have lease history

ALTER TABLE public.key_leases
DROP CONSTRAINT IF EXISTS key_leases_agent_id_fkey;

ALTER TABLE public.key_leases
ADD CONSTRAINT key_leases_agent_id_fkey
FOREIGN KEY (agent_id)
REFERENCES public.agents(id)
ON DELETE SET NULL;
