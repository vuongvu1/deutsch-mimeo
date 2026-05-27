-- Deutsch MiMeo: add the "listening" challenge + listening_rounds history table.
-- Run this in Supabase Studio → SQL Editor → New query.
--
-- The listening challenge stores 1 *passed* round as 1 unit in sessions.seconds.
-- daily_goal_seconds = 1 means one submitted round with >50% correct ticks the
-- day's checkmark. Failed rounds are saved in listening_rounds for history but
-- never insert into sessions.
--
-- The challenge id is pinned so it matches LISTENING_CHALLENGE_ID in the
-- frontend (src/hooks/useChallenges.ts).

-- Upsert by *id* so this is safe even if the pinned id already holds an
-- older challenge row (e.g. the historical hidden "tagebuch" challenge that
-- migration 0007 deactivated but didn't remove). We refresh slug + every
-- other column from EXCLUDED so a stale row at this id gets repurposed
-- in-place. The slug uniqueness constraint still protects against a second
-- row claiming 'listening' separately.
--
-- `activated_on = current_date` is critical: when repurposing a stale row,
-- without this line the listening challenge would inherit the old row's
-- activated_on (from when 'tagebuch' was first created), which would make
-- `daily_completion` expect a listening session on every historical day
-- and silently reset every "day complete" count. Setting it to today
-- means only today-onwards days require listening — exactly the
-- semantics migration 0007 introduced.
insert into challenges (id, slug, title, description, daily_goal_seconds, sort_order, active, activated_on) values
  ('00000000-0000-4000-8000-000000000003', 'listening', 'Hörverstehen 1×/Tag',
   'Höre einen KI-generierten Text und beantworte die Fragen mit mehr als 50% richtig.',
   1, 20, true, current_date)
on conflict (id) do update
  set slug               = excluded.slug,
      title              = excluded.title,
      description        = excluded.description,
      daily_goal_seconds = excluded.daily_goal_seconds,
      sort_order         = excluded.sort_order,
      active             = excluded.active,
      activated_on       = excluded.activated_on;

create table if not exists listening_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  challenge_id uuid not null references challenges(id) on delete cascade,
  local_date date not null,
  level text not null check (level in ('A1','A2','B1','B2','mix')),
  target_minutes smallint not null check (target_minutes in (1, 2, 3, 5)),
  num_questions smallint not null check (num_questions in (5, 10, 15)),
  transcript text not null,
  questions jsonb not null,
  answers jsonb not null,
  score smallint not null,
  max_score smallint not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists listening_rounds_user_date_idx
  on listening_rounds(user_id, local_date desc);

alter table listening_rounds enable row level security;
drop policy if exists "anon all" on listening_rounds;
create policy "anon all" on listening_rounds for all to anon using (true) with check (true);
