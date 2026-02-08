-- Blueprints RBAC Migration (001_profiles_rbac.sql)

-- 1. Create profiles table
create table if not exists public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    email text,
    role text not null default 'user' check (role in ('user', 'admin_read', 'super_admin')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

-- 2. Profile Policies
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles
    for select using (true);

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile." on public.profiles
    for update using (auth.uid() = id);

-- 3. RBAC Helper Function
create or replace function public.is_admin()
returns boolean as $$
begin
  return (
    select role in ('admin_read', 'super_admin')
    from public.profiles
    where id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- 4. Update Policies for Projects
drop policy if exists "Users can see their own projects" on public.projects;
drop policy if exists "Users and Admins can see projects" on public.projects;
create policy "Users and Admins can see projects" on public.projects
    for all using (auth.uid() = user_id or public.is_admin());

-- 4. Update Policies for Agents
drop policy if exists "Users can see agents in their projects" on public.agents;
drop policy if exists "Users and Admins can see agents" on public.agents;
create policy "Users and Admins can see agents" on public.agents
    for all using (
        exists (
            select 1 from public.projects
            where public.projects.id = public.agents.project_id
            and (public.projects.user_id = auth.uid() or public.is_admin())
        )
    );

-- 5. Update Policies for Desired State
drop policy if exists "Users can see desired state of their agents" on public.agent_desired_state;
drop policy if exists "Users and Admins can see desired state" on public.agent_desired_state;
create policy "Users and Admins can see desired state" on public.agent_desired_state
    for all using (
        exists (
            select 1 from public.agents
            join public.projects on public.projects.id = public.agents.project_id
            where public.agents.id = public.agent_desired_state.agent_id
            and (public.projects.user_id = auth.uid() or public.is_admin())
        )
    );

-- 6. Update Policies for Actual State
drop policy if exists "Users can see actual state of their agents" on public.agent_actual_state;
drop policy if exists "Users and Admins can see actual state" on public.agent_actual_state;
create policy "Users and Admins can see actual state" on public.agent_actual_state
    for all using (
        exists (
            select 1 from public.agents
            join public.projects on public.projects.id = public.agents.project_id
            where public.agents.id = public.agent_actual_state.agent_id
            and (public.projects.user_id = auth.uid() or public.is_admin())
        )
    );

-- 7. Update Policies for Conversations
drop policy if exists "Users can see and manage their own agent conversations" on public.agent_conversations;
drop policy if exists "Users and Admins can see conversations" on public.agent_conversations;
create policy "Users and Admins can see conversations" on public.agent_conversations
    for all using (user_id = auth.uid() or public.is_admin());

-- 8. Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'user');
    return new;
end;
$$ language plpgsql security definer;

-- Use DO block to ensure trigger creation is idempotent
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        create trigger on_auth_user_created
            after insert on auth.users
            for each row execute procedure public.handle_new_user();
    END IF;
END $$;
