-- 0006_storage_bucket_and_policies.sql
--
-- Creates the `wardrobe-images` bucket as PRIVATE (public = false) and
-- restricts access per-user by folder prefix: every object must live at
-- `{user_id}/{filename}`, enforced by RLS policies below, not by convention.
--
-- IMPORTANT — this bucket stays private. Do NOT flip it to public as a fix
-- for the auto-tag-item 403 issue (see functions/auto-tag-item/index.ts for
-- the actual fix — signed URLs with a short TTL). Making the bucket public
-- would mean anyone with a storage_key (which are not cryptographically
-- unguessable on their own — they're just uuid.jpg) could fetch any user's
-- wardrobe photos with no auth check at all. Signed URLs solve the Gemini
-- fetch problem without that tradeoff.

insert into storage.buckets (id, name, public, file_size_limit)
values ('wardrobe-images', 'wardrobe-images', false, 5242880) -- 5MB
on conflict (id) do update set public = false, file_size_limit = 5242880;

-- Folder-isolation policies: a user can only read/write objects whose path
-- starts with their own auth.uid(). storage.foldername(name) splits the
-- object path on "/" and returns it as a text[]; index [1] is the top-level
-- folder, which the client is required to set to the user's own id when
-- uploading (enforced here, not just by convention).

create policy "wardrobe_images_select_own_folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "wardrobe_images_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "wardrobe_images_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "wardrobe_images_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'wardrobe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
