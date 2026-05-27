-- Deutsch MiMeo: per-user "saved words" notebook.
-- Backs the bookmark button on German tiles in the vocab game.
-- Run in Supabase Studio → SQL Editor → New query (idempotent).

create table if not exists saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  de text not null,
  en text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table saved_words drop constraint if exists saved_words_user_de_unique;
alter table saved_words add constraint saved_words_user_de_unique unique (user_id, de);

create index if not exists saved_words_user_created_idx
  on saved_words(user_id, created_at desc);

alter table saved_words enable row level security;
drop policy if exists "anon all" on saved_words;
create policy "anon all" on saved_words for all to anon using (true) with check (true);
