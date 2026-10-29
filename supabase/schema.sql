-- =============================================================================
-- SylvaLearn — schéma Supabase (versionné)
-- À exécuter dans le SQL Editor de Supabase, puis dans chaque environnement.
--
-- Tables :
--   public.profiles       : profil applicatif lié à auth.users (rôle user/admin)
--   public.learning_paths : parcours générés par l'IA (FK -> profiles.user_id)
--   public.ai_requests    : journal des appels IA pour la limitation de débit
--
-- La RLS est activée sur TOUTES les tables. Chaque table possède une colonne
-- user_id. Les administrateurs accèdent aux données via public.is_admin().
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Profils (un par utilisateur Supabase Auth)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Vérifie le rôle admin sans provoquer de récursion RLS sur profiles.
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

-- Le profil est créé automatiquement par le trigger ci-dessous. Un utilisateur
-- ne peut donc ni s'attribuer un rôle ni modifier son propre rôle via l'API.

-- -----------------------------------------------------------------------------
-- 2. Parcours d'apprentissage générés
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. Journal des appels au modèle (limitation de débit par utilisateur)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_requests_user_created_idx
  on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

drop policy if exists "ai_requests_select_own" on public.ai_requests;
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

-- -----------------------------------------------------------------------------
-- 4. Création automatique du profil à l'inscription
-- -----------------------------------------------------------------------------
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

-- Crée les profils manquants pour les utilisateurs déjà inscrits.
insert into public.profiles (user_id, email)
select id, coalesce(email, '')
from auth.users
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------
-- 5. Privilèges (la RLS filtre ensuite ligne par ligne)
-- -----------------------------------------------------------------------------
revoke all on public.profiles from anon;
revoke all on public.learning_paths from anon;
revoke all on public.ai_requests from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.learning_paths to authenticated;
grant select, insert on public.ai_requests to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Passer un utilisateur en administrateur (à exécuter une fois, avec son email)
-- -----------------------------------------------------------------------------
-- update public.profiles
-- set role = 'admin'
-- where email = 'admin@exemple.com';

-- -----------------------------------------------------------------------------
-- 7. Vérification : la RLS doit être active sur les trois tables
-- -----------------------------------------------------------------------------
-- select tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
--   and tablename in ('profiles', 'learning_paths', 'ai_requests');
