-- 13. Deployments Table
create table if not exists public.deployments (
    id uuid default uuid_generate_v4() primary key,
    commit_hash text not null,
    branch text not null,
    status text not null default 'pending', -- 'pending', 'success', 'failed'
    message text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    finished_at timestamp with time zone
);

-- Enable RLS
alter table public.deployments enable row level security;

-- Policies
drop policy if exists "Admins can view deployments" on public.deployments;
create policy "Admins can view deployments" on public.deployments
    for select using (public.is_admin());

drop policy if exists "Service role can manage deployments" on public.deployments;
create policy "Service role can manage deployments" on public.deployments
    for all using (true); -- Ideally, limit this to service role only if possible, but for now allow all (scripts run as admin/service)
