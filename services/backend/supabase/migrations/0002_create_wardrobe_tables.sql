-- 0002_create_wardrobe_tables.sql

create table if not exists public.wardrobe_items (
  item_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  category text check (category in ('TOP', 'BOTTOM', 'FOOTWEAR', 'OUTERWEAR', 'ACCESSORY')),
  primary_colour text,
  secondary_colour text,
  pattern text,
  formality smallint check (formality between 1 and 5),
  season text[] not null default '{}',
  status text not null default 'PROCESSING'
    check (status in ('PROCESSING', 'READY', 'REVIEW_REQUIRED')),
  last_worn_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wardrobe_items_user_id_idx on public.wardrobe_items (user_id);
create index if not exists wardrobe_items_status_idx on public.wardrobe_items (status);

alter table public.wardrobe_items enable row level security;

create policy "wardrobe_items_all_own"
  on public.wardrobe_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists wardrobe_items_set_updated_at on public.wardrobe_items;
create trigger wardrobe_items_set_updated_at
  before update on public.wardrobe_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------

create table if not exists public.item_images (
  image_id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.wardrobe_items(item_id) on delete cascade,
  storage_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists item_images_item_id_idx on public.item_images (item_id);

alter table public.item_images enable row level security;

-- item_images has no user_id of its own — isolation is enforced by joining
-- through wardrobe_items, which does carry user_id.
create policy "item_images_all_via_parent_item"
  on public.item_images for all
  using (
    exists (
      select 1 from public.wardrobe_items w
      where w.item_id = item_images.item_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.wardrobe_items w
      where w.item_id = item_images.item_id and w.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------

create table if not exists public.item_tags (
  tag_id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.wardrobe_items(item_id) on delete cascade,
  tag text not null,
  source text not null check (source in ('CV_MODEL', 'USER')),
  confidence numeric(3, 2) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create index if not exists item_tags_item_id_idx on public.item_tags (item_id);

alter table public.item_tags enable row level security;

create policy "item_tags_all_via_parent_item"
  on public.item_tags for all
  using (
    exists (
      select 1 from public.wardrobe_items w
      where w.item_id = item_tags.item_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.wardrobe_items w
      where w.item_id = item_tags.item_id and w.user_id = auth.uid()
    )
  );
