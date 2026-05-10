-- Deutsch Duo: initial schema
-- Run this in Supabase Studio → SQL Editor → New query

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists users (
  id text primary key,
  display_name text not null,
  emoji text not null
);

create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  daily_goal_seconds integer not null default 1800,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  youtube_id text not null,
  title text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists videos_user_id_idx on videos(user_id, created_at desc);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  challenge_id uuid not null references challenges(id) on delete cascade,
  video_id uuid references videos(id) on delete set null,
  seconds integer not null default 0,
  local_date date not null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sessions_user_date_idx on sessions(user_id, local_date);
create index if not exists sessions_user_challenge_date_idx on sessions(user_id, challenge_id, local_date);

-- ============================================================
-- VIEWS
-- ============================================================

create or replace view daily_challenge_totals as
select
  s.user_id,
  s.challenge_id,
  s.local_date,
  sum(s.seconds)::integer as total_seconds
from sessions s
group by s.user_id, s.challenge_id, s.local_date;

-- A day is "complete" only when EVERY active challenge meets its goal.
-- Implemented as: for each (user, date that has any session), cross-join active challenges,
-- left join the totals, then aggregate.
create or replace view daily_completion as
with user_dates as (
  select distinct user_id, local_date from sessions
),
expected as (
  select ud.user_id, ud.local_date, c.id as challenge_id, c.daily_goal_seconds
  from user_dates ud
  cross join challenges c
  where c.active = true
)
select
  e.user_id,
  e.local_date,
  bool_and(coalesce(d.total_seconds, 0) >= e.daily_goal_seconds) as all_complete,
  count(*)::integer as active_challenges_count,
  count(*) filter (where coalesce(d.total_seconds, 0) >= e.daily_goal_seconds)::integer as completed_count
from expected e
left join daily_challenge_totals d
  on d.user_id = e.user_id
 and d.local_date = e.local_date
 and d.challenge_id = e.challenge_id
group by e.user_id, e.local_date;

-- ============================================================
-- RLS — permissive for personal app (no auth, anon key in browser)
-- ============================================================

alter table users      enable row level security;
alter table challenges enable row level security;
alter table videos     enable row level security;
alter table sessions   enable row level security;

-- Drop any pre-existing policies (idempotent re-run)
drop policy if exists "anon all" on users;
drop policy if exists "anon all" on challenges;
drop policy if exists "anon all" on videos;
drop policy if exists "anon all" on sessions;

create policy "anon all" on users      for all to anon using (true) with check (true);
create policy "anon all" on challenges for all to anon using (true) with check (true);
create policy "anon all" on videos     for all to anon using (true) with check (true);
create policy "anon all" on sessions   for all to anon using (true) with check (true);

-- Views inherit base-table RLS, but explicit grants for the view names:
grant select on daily_challenge_totals to anon;
grant select on daily_completion to anon;

-- ============================================================
-- SEED
-- ============================================================

insert into users (id, display_name, emoji) values
  ('mi',  'Mi',  '🐷'),
  ('meo', 'Meo', '🐱')
on conflict (id) do update
  set display_name = excluded.display_name,
      emoji        = excluded.emoji;

-- The id is pinned so it matches the LISTEN_CHALLENGE_ID constant in the frontend
-- (src/hooks/useChallenges.ts) — sessions.challenge_id FK relies on this value.
insert into challenges (id, slug, title, description, daily_goal_seconds, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'listen', 'Listen 30 min/day',
   'Watch German YouTube videos for at least 30 minutes total each day.',
   1800, 0)
on conflict (slug) do update
  set title              = excluded.title,
      description        = excluded.description,
      daily_goal_seconds = excluded.daily_goal_seconds,
      sort_order         = excluded.sort_order;
