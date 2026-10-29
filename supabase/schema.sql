

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  topic text not null,
  level text not null check (level in ('debutant', 'intermediaire', 'avance')),
  goal text not null,
  title text not null,
  summary text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists learning_paths_user_created_idx
  on public.learning_paths (user_id, created_at desc);

alter table public.learning_paths enable row level security;

drop policy if exists "learning_paths_select_own" on public.learning_paths;
create policy "learning_paths_select_own"
  on public.learning_paths
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "learning_paths_insert_own" on public.learning_paths;
create policy "learning_paths_insert_own"
  on public.learning_paths
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "learning_paths_delete_own" on public.learning_paths;
create policy "learning_paths_delete_own"
  on public.learning_paths
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "learning_paths_select_admin" on public.learning_paths;
create policy "learning_paths_select_admin"
  on public.learning_paths
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "learning_paths_delete_admin" on public.learning_paths;
create policy "learning_paths_delete_admin"
  on public.learning_paths
  for delete
  to authenticated
  using (public.is_admin());

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_requests_user_created_idx
  on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

drop policy if exists "ai_requests_select_own" on public.ai_requests
create policy "ai_requests_select_own"
  on public.ai_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "ai_requests_insert_own" on public.ai_requests;
create policy "ai_requests_insert_own"
  on public.ai_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "ai_requests_select_admin" on public.ai_requests;
create policy "ai_requests_select_admin"
  on public.ai_requests
  for select
  to authenticated
  using (public.is_admin());

alter table public.ai_requests
  add column if not exists model text,
  add column if not exists prompt_tokens integer,
  add column if not exists completion_tokens integer,
  add column if not exists latency_ms integer,
  add column if not exists attempts integer,
  add column if not exists status text,
  add column if not exists cost_usd numeric(12, 6);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_requests_status_check'
  ) then
    alter table public.ai_requests
      add constraint ai_requests_status_check
      check (status is null or status in ('succes', 'erreur'));
  end if;
end $$;

drop policy if exists "ai_requests_update_own" on public.ai_requests;
create policy "ai_requests_update_own"
  on public.ai_requests
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.ai_usage_stats(p_since timestamptz)
returns table (
  appels bigint,
  erreurs bigint,
  tokens_entree bigint,
  tokens_sortie bigint,
  latence_moyenne_ms integer,
  cout_usd numeric
)
language sql
stable
set search_path = public
as $$
  select
    count(*) as appels,
    count(*) filter (where ar.status = 'erreur') as erreurs,
    coalesce(sum(ar.prompt_tokens), 0)::bigint as tokens_entree,
    coalesce(sum(ar.completion_tokens), 0)::bigint as tokens_sortie,
    coalesce(round(avg(ar.latency_ms))::integer, 0) as latence_moyenne_ms,
    coalesce(round(sum(ar.cost_usd), 6), 0) as cout_usd
  from public.ai_requests ar
  where ar.created_at >= p_since;
$$;

revoke all on function public.ai_usage_stats(timestamptz) from public;
grant execute on function public.ai_usage_stats(timestamptz) to authenticated;

create or replace function public.health_check()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('ok', true);
$$;

revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into public.profiles (user_id, email)
select id, coalesce(email, '')
from auth.users
on conflict (user_id) do nothing;

revoke all on public.profiles from anon;
revoke all on public.learning_paths from anon;
revoke all on public.ai_requests from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.learning_paths to authenticated;
grant select, insert on public.ai_requests to authenticated;

grant update (model, prompt_tokens, completion_tokens, latency_ms, attempts, status, cost_usd)
  on public.ai_requests to authenticated;

