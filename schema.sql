-- Blueprints Manager SQL Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Projects table
create table if not exists public.projects (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    tier text not null default 'free', -- 'free', 'pro', 'enterprise'
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Runtimes table (Where agents are actually running)
create table if not exists public.runtimes (
    id uuid default uuid_generate_v4() primary key,
    name text unique not null,
    eliza_api_url text not null,
    auth_token text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Agents table
create table if not exists public.agents (
    id uuid default uuid_generate_v4() primary key,
    project_id uuid references public.projects(id) on delete cascade not null,
    name text not null,
    version text default 'latest',
    framework text default 'eliza', -- 'eliza', 'openclaw'
    template_id text, -- ID of the functional template used
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Agent Desired State (What the user wants)
create table if not exists public.agent_desired_state (
    agent_id uuid references public.agents(id) on delete cascade primary key,
    enabled boolean default false,
    config jsonb not null default '{}'::jsonb,
    purge_at timestamp with time zone,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Agent Actual State (What is currently running)
create table if not exists public.agent_actual_state (
    agent_id uuid references public.agents(id) on delete cascade primary key,
    status text default 'stopped', -- 'stopped', 'starting', 'running', 'error'
    last_sync timestamp with time zone,
    runtime_id uuid references public.runtimes(id) on delete set null,
    endpoint_url text,
    error_message text
);

-- 6. Row Level Security (RLS)
alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.agent_desired_state enable row level security;
alter table public.agent_actual_state enable row level security;
-- runtimes is admin-only for now

-- Policies
create policy "Users can see their own projects" on public.projects
    for all using (auth.uid() = user_id);

create policy "Users can see agents in their projects" on public.agents
    for all using (
        exists (
            select 1 from public.projects
            where public.projects.id = public.agents.project_id
            and public.projects.user_id = auth.uid()
        )
    );

create policy "Users can see desired state of their agents" on public.agent_desired_state
    for all using (
        exists (
            select 1 from public.agents
            join public.projects on public.projects.id = public.agents.project_id
            where public.agents.id = public.agent_desired_state.agent_id
            and public.projects.user_id = auth.uid()
        )
    );

create policy "Users can see actual state of their agents" on public.agent_actual_state
    for all using (
        exists (
            select 1 from public.agents
            join public.projects on public.projects.id = public.agents.project_id
            where public.agents.id = public.agent_actual_state.agent_id
            and public.projects.user_id = auth.uid()
        )
    );

-- 7. Agent Conversations (Isolated by agent and project)
create table if not exists public.agent_conversations (
    id uuid default uuid_generate_v4() primary key,
    agent_id uuid references public.agents(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    content text not null,
    sender text not null, -- 'user' or 'agent'
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agent_conversations enable row level security;

create policy "Users can see and manage their own agent conversations" on public.agent_conversations
    for all using (
        user_id = auth.uid()
    );
