-- Team and subscription foundation for Ledge.
-- Apply after the OAuth work is merged so Google sign-in users can be matched
-- to pending team_members rows by email.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null check (role in ('site_supervisor', 'project_manager', 'admin')),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, email)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free', 'pro')),
  status text not null default 'free' check (status in ('free', 'active', 'past_due', 'cancelled')),
  provider text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id)
);

alter table public.projects
  add column if not exists team_id uuid references public.teams(id) on delete set null;

alter table public.project_members
  add column if not exists role text not null default 'project_manager'
  check (role in ('site_supervisor', 'project_manager', 'admin'));

create index if not exists team_members_user_id_idx on public.team_members(user_id);
create index if not exists team_members_email_idx on public.team_members(lower(email));
create index if not exists projects_team_id_idx on public.projects(team_id);

create or replace function public.team_project_limit(p_team_id uuid)
returns integer
language sql
stable
as $$
  select case
    when coalesce(s.plan_id, 'free') = 'pro' and s.status in ('active', 'free') then 10
    else 1
  end
  from public.teams t
  left join public.subscriptions s on s.team_id = t.id
  where t.id = p_team_id
$$;

create or replace function public.can_create_team_project(p_team_id uuid)
returns boolean
language sql
stable
as $$
  select count(p.id) < public.team_project_limit(p_team_id)
  from public.projects p
  where p.team_id = p_team_id
$$;

create or replace function public.claim_team_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.team_members tm
  set
    user_id = auth.uid(),
    status = 'active',
    joined_at = coalesce(tm.joined_at, now()),
    updated_at = now()
  where tm.user_id is null
    and lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
end;
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "team members can read teams" on public.teams;
create policy "team members can read teams"
on public.teams for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = teams.id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  )
);

drop policy if exists "owners can create teams" on public.teams;
create policy "owners can create teams"
on public.teams for insert
with check (owner_id = auth.uid());

drop policy if exists "team admins can update teams" on public.teams;
create policy "team admins can update teams"
on public.teams for update
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = teams.id
      and tm.user_id = auth.uid()
      and tm.role = 'admin'
      and tm.status = 'active'
  )
);

drop policy if exists "team members can read member list" on public.team_members;
create policy "team members can read member list"
on public.team_members for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.team_members tm
    where tm.team_id = team_members.team_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  )
);

drop policy if exists "team admins manage members" on public.team_members;
create policy "team admins manage members"
on public.team_members for all
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = team_members.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'admin'
      and tm.status = 'active'
  )
)
with check (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = team_members.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'admin'
      and tm.status = 'active'
  )
);

drop policy if exists "team admins read subscriptions" on public.subscriptions;
create policy "team admins read subscriptions"
on public.subscriptions for select
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = subscriptions.team_id
      and tm.user_id = auth.uid()
      and tm.role = 'admin'
      and tm.status = 'active'
  )
);

