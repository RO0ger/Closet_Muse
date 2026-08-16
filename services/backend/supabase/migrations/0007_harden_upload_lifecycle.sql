-- Upload reservations make the storage upload and its database representation
-- one idempotent lifecycle.  The client never creates wardrobe rows directly.

create table if not exists public.upload_operations (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null unique references public.wardrobe_items(item_id) on delete cascade,
  storage_key text not null unique,
  expected_file_size integer not null check (expected_file_size between 1 and 5242880),
  expected_mime_type text not null check (expected_mime_type = 'image/jpeg'),
  stage text not null default 'RESERVED'
    check (stage in ('RESERVED', 'FINALIZING', 'COMPLETE', 'FAILED', 'CANCELLED')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz
);

create index if not exists upload_operations_abandoned_idx
  on public.upload_operations (updated_at)
  where stage in ('RESERVED', 'FINALIZING', 'FAILED');

alter table public.upload_operations enable row level security;

create policy "upload_operations_select_own"
  on public.upload_operations for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.upload_operations to authenticated;

-- Only the narrowly scoped RPC below creates operations.  Keeping write
-- policies absent prevents a caller from reassigning an operation or stage.

drop trigger if exists upload_operations_set_updated_at on public.upload_operations;
create trigger upload_operations_set_updated_at
  before update on public.upload_operations
  for each row execute function public.set_updated_at();

-- A wardrobe item has exactly one source image and at most one CV result.
create unique index if not exists item_images_one_per_item_idx
  on public.item_images (item_id);
create unique index if not exists item_tags_one_cv_model_per_item_idx
  on public.item_tags (item_id)
  where source = 'CV_MODEL';

-- The RPC is intentionally SECURITY DEFINER solely to make reservation
-- creation atomic.  It still requires a caller JWT and pins search_path.
create or replace function public.reserve_upload_operation(
  p_operation_id uuid,
  p_file_size integer,
  p_mime_type text
)
returns table (
  operation_id uuid,
  item_id uuid,
  storage_key text,
  stage text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_storage_key text;
begin
  if v_user_id is null then
    raise exception 'Unauthorized' using errcode = '28000';
  end if;
  if p_file_size < 1 or p_file_size > 5242880 or p_mime_type <> 'image/jpeg' then
    raise exception 'Invalid upload metadata' using errcode = '22023';
  end if;

  select u.item_id, u.storage_key into v_item_id, v_storage_key
  from public.upload_operations u
  where u.operation_id = p_operation_id and u.user_id = v_user_id;

  if found then
    return query select u.operation_id, u.item_id, u.storage_key, u.stage
      from public.upload_operations u
      where u.operation_id = p_operation_id and u.user_id = v_user_id;
    return;
  end if;

  insert into public.wardrobe_items (user_id, status)
  values (v_user_id, 'PROCESSING')
  returning wardrobe_items.item_id into v_item_id;

  v_storage_key := v_user_id::text || '/' || gen_random_uuid()::text || '.jpg';
  begin
    insert into public.upload_operations (
      operation_id, user_id, item_id, storage_key, expected_file_size, expected_mime_type
    ) values (
      p_operation_id, v_user_id, v_item_id, v_storage_key, p_file_size, p_mime_type
    );
  exception when unique_violation then
    -- A concurrent identical request won.  Remove our unreferenced item and
    -- return the winning reservation rather than creating a duplicate.
    delete from public.wardrobe_items where item_id = v_item_id;
  end;

  return query select u.operation_id, u.item_id, u.storage_key, u.stage
    from public.upload_operations u
    where u.operation_id = p_operation_id and u.user_id = v_user_id;
end;
$$;

revoke all on function public.reserve_upload_operation(uuid, integer, text) from public;
grant execute on function public.reserve_upload_operation(uuid, integer, text) to authenticated;
