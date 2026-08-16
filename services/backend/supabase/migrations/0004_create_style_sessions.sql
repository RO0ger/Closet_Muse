-- 0004_create_style_sessions.sql

create table if not exists public.style_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create index if not exists style_sessions_user_id_idx on public.style_sessions (user_id);

alter table public.style_sessions enable row level security;

create policy "style_sessions_all_own"
  on public.style_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------

create table if not exists public.genai_prompts (
  prompt_id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.style_sessions(session_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_text text not null,
  ai_response_json jsonb,
  parsed_intent_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists genai_prompts_session_id_idx on public.genai_prompts (session_id);
create index if not exists genai_prompts_user_id_idx on public.genai_prompts (user_id);

-- Full-text search index backing the chat-search Edge Function (UC-04
-- "search past chats" alternate flow).
create index if not exists genai_prompts_fulltext_idx
  on public.genai_prompts
  using gin (to_tsvector('english', prompt_text));

alter table public.genai_prompts enable row level security;

create policy "genai_prompts_all_own"
  on public.genai_prompts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
