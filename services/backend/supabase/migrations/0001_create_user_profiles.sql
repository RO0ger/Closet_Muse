-- 0001_create_user_profiles.sql
--
-- ARCHITECTURAL FIX (found while writing real DDL, not just the storage bug):
-- The original schema (Technical Reference §2) specified a custom `users`
-- table with its own `password_hash` column, separate from Supabase Auth's
-- built-in `auth.users`. That's a real security liability if implemented
-- as written — it means passwords could exist in two places, and gives no
-- benefit since Supabase Auth already owns credential storage/hashing.
--
-- Fix: no custom `users` table. `user_profiles.user_id` references
-- `auth.users(id)` directly. One source of truth for identity.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  profile_id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  preferred_style text,
  size_top text,
  size_bottom text,
  climate_sensitivity text not null default 'medium'
    check (climate_sensitivity in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "user_profiles_select_own"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "user_profiles_insert_own"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "user_profiles_update_own"
  on public.user_profiles for update
  using (auth.uid() = user_id);

create policy "user_profiles_delete_own"
  on public.user_profiles for delete
  using (auth.uid() = user_id);

-- Auto-create a default profile row the instant a new auth user is created.
-- This removes the race condition in the original design (client calling
-- create-profile *after* signUp — if that call failed, you'd get a user
-- with no profile row and nothing to join against). The client now only
-- ever needs to UPDATE an existing row, never INSERT.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at honest on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();
