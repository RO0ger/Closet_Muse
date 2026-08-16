-- 0003_create_recommendation_tables.sql

create table if not exists public.outfits (
  outfit_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists outfits_user_id_idx on public.outfits (user_id);

alter table public.outfits enable row level security;

create policy "outfits_all_own"
  on public.outfits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------

create table if not exists public.outfit_items (
  outfit_id uuid not null references public.outfits(outfit_id) on delete cascade,
  item_id uuid not null references public.wardrobe_items(item_id) on delete cascade,
  primary key (outfit_id, item_id)
);

alter table public.outfit_items enable row level security;

create policy "outfit_items_all_via_parent_outfit"
  on public.outfit_items for all
  using (
    exists (
      select 1 from public.outfits o
      where o.outfit_id = outfit_items.outfit_id and o.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.outfits o
      where o.outfit_id = outfit_items.outfit_id and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- weather_cache is NOT per-user — it's a shared cache keyed by location, so
-- RLS here isn't about data isolation between users, it's about preventing
-- clients from writing directly to the cache (only Edge Functions, via the
-- service-role key, should ever write to it).

create table if not exists public.weather_cache (
  cache_id uuid primary key default gen_random_uuid(),
  location_key text not null unique,
  temperature_c numeric(4, 1) not null,
  condition_text text not null,
  precipitation_mm numeric(5, 2) not null default 0,
  wind_kph numeric(5, 1) not null default 0,
  fetched_at timestamptz not null default now()
);

create index if not exists weather_cache_location_key_idx on public.weather_cache (location_key);

alter table public.weather_cache enable row level security;

-- Any authenticated user can read the cache (it's not sensitive data).
create policy "weather_cache_select_authenticated"
  on public.weather_cache for select
  to authenticated
  using (true);

-- No insert/update/delete policy for regular users at all — only the
-- service-role key (which bypasses RLS entirely) can write. This is
-- intentional, not an oversight: it's what stops a client from poisoning
-- the shared weather cache for other users.

-- ---------------------------------------------------------------------------

create table if not exists public.recommendations (
  rec_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_json jsonb not null default '{}'::jsonb,
  weather_snapshot_id uuid references public.weather_cache(cache_id),
  score_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommendations_user_id_idx on public.recommendations (user_id);

alter table public.recommendations enable row level security;

create policy "recommendations_all_own"
  on public.recommendations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
