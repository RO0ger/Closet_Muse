-- 0005_create_feedback_table.sql

create table if not exists public.feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  rec_id uuid not null references public.recommendations(rec_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('worn', 'saved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists feedback_rec_id_idx on public.feedback (rec_id);

alter table public.feedback enable row level security;

create policy "feedback_all_own"
  on public.feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
