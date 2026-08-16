-- Persist delivery state separately from assistant content so retries cannot
-- create duplicate user bubbles or turn transport failures into chat history.

alter table public.genai_prompts
  add column if not exists client_request_id uuid,
  add column if not exists status text,
  add column if not exists error_code text,
  add column if not exists updated_at timestamptz;

-- Existing completed rows predate delivery state.
update public.genai_prompts
set client_request_id = prompt_id,
    status = 'succeeded',
    updated_at = coalesce(updated_at, created_at)
where client_request_id is null
   or status is null
   or updated_at is null;

alter table public.genai_prompts
  alter column client_request_id set not null,
  alter column status set not null,
  alter column status set default 'pending',
  alter column updated_at set not null,
  alter column updated_at set default now();

alter table public.genai_prompts
  drop constraint if exists genai_prompts_status_check;
alter table public.genai_prompts
  add constraint genai_prompts_status_check
  check (status in ('pending', 'succeeded', 'failed'));

-- Request ids are supplied by the authenticated client and only need to be
-- unique in that user's namespace; this is the retry/idempotency guarantee.
create unique index if not exists genai_prompts_user_request_id_key
  on public.genai_prompts (user_id, client_request_id);

create index if not exists genai_prompts_session_order_idx
  on public.genai_prompts (session_id, created_at, prompt_id);

drop trigger if exists genai_prompts_set_updated_at on public.genai_prompts;
create trigger genai_prompts_set_updated_at
  before update on public.genai_prompts
  for each row execute function public.set_updated_at();

-- Replace the older policy with an equivalent cached auth lookup. Both the
-- select/update predicates remain owner-scoped under RLS.
drop policy if exists "genai_prompts_all_own" on public.genai_prompts;
create policy "genai_prompts_all_own"
  on public.genai_prompts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
