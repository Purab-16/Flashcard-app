-- DRAFT for human review. Not applied. Postgres (Supabase).
-- Rules: user_id on every user table, soft delete via deleted_at, RLS on,
-- no hard-delete policy for any table.

create extension if not exists "pgcrypto";

create type question_type as enum ('mcq', 'short', 'long');
create type difficulty_level as enum ('easy', 'medium', 'hard');
create type document_status as enum ('uploaded', 'parsed', 'chunked', 'failed');
create type question_status as enum ('active', 'flagged');
create type session_mode as enum ('practice', 'mock');
create type video_trigger as enum ('wrong', 'correct_click');

create table subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  subject_id uuid references subjects(id),
  title text not null,
  storage_path text not null unique,
  mime_type text not null,
  status document_status not null default 'uploaded',
  page_count int,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  document_id uuid not null references documents(id),
  idx int not null,
  topic text,
  content text not null,
  word_count int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (document_id, idx)
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  document_id uuid not null references documents(id),
  chunk_id uuid not null references chunks(id),
  type question_type not null,
  difficulty difficulty_level not null default 'medium',
  topic text,
  prompt text not null,
  options jsonb,                 -- mcq only: [{"key":"A","text":"..."}]
  correct_answer text not null,
  explanation text not null,
  source_quote text not null,    -- exact text from the chunk
  rubric jsonb,                  -- short/long: marking points
  max_score numeric not null default 1,
  hint text,
  status question_status not null default 'active',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  document_id uuid not null references documents(id),
  chunk_id uuid references chunks(id),
  front text not null,
  back text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  mode session_mode not null default 'practice',
  subject_id uuid references subjects(id),
  time_limit_sec int,
  negative_marking numeric not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_score numeric,
  max_score numeric,
  deleted_at timestamptz
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id uuid not null references questions(id),
  session_id uuid references test_sessions(id),
  answer_text text,
  selected_option text,
  is_correct boolean,
  score numeric,
  max_score numeric,
  feedback jsonb,                -- reasoning, missed points, weak topic
  hint_used boolean not null default false,
  time_taken_ms int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Spaced repetition. Exactly one of question_id / flashcard_id is set.
create table review_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id uuid references questions(id),
  flashcard_id uuid references flashcards(id),
  ease numeric not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  deleted_at timestamptz,
  check ((question_id is not null)::int + (flashcard_id is not null)::int = 1),
  unique (user_id, question_id),
  unique (user_id, flashcard_id)
);

create table question_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id uuid not null references questions(id),
  reason text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Shared cache of YouTube results by topic (no personal data).
create table video_cache (
  id uuid primary key default gen_random_uuid(),
  topic_key text not null unique,
  query text not null,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

create table video_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id uuid references questions(id),
  video_id text not null,
  trigger video_trigger not null,
  useful boolean,
  clicked_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  provider text not null,
  model text not null,
  kind text not null,            -- generate | check | vision | other
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);

-- One live subject name per user. Soft-deleted subjects do not block reuse.
create unique index subjects_user_name_live on subjects (user_id, lower(name)) where deleted_at is null;
create index on documents (user_id, subject_id);
create index on chunks (document_id);
create index on questions (user_id, document_id, type);
create index on attempts (user_id, question_id, created_at);
create index on review_state (user_id, due_at);
create index on usage_log (user_id, created_at);

-- Keep updated_at fresh automatically.
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger subjects_set_updated_at before update on subjects
  for each row execute function set_updated_at();
create trigger documents_set_updated_at before update on documents
  for each row execute function set_updated_at();

-- RLS: select, insert, update for own rows. No delete policy on purpose.
do $$
declare t text;
begin
  foreach t in array array[
    'subjects','documents','chunks','questions','flashcards','test_sessions',
    'attempts','review_state','question_reports','video_clicks','usage_log'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (user_id = auth.uid())', t || '_select', t);
    execute format('create policy %I on %I for insert with check (user_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on %I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update', t);
  end loop;
end $$;

-- video_cache: any signed-in user can read; writes only via the server (service role).
alter table video_cache enable row level security;
create policy video_cache_select on video_cache for select using (auth.role() = 'authenticated');
