-- Deutsch MiMeo: add the "vocab" challenge.
-- Run this in Supabase Studio → SQL Editor → New query.
--
-- The vocab challenge stores 1 correct match as 1 unit in sessions.seconds.
-- The "seconds" column name is reused as a generic integer counter — the
-- per-challenge UI formats the value (minutes for listen, "Treffer" for vocab).
-- daily_goal_seconds = 50 here means 50 correct matches/day.
--
-- The id is pinned so it matches the VOCAB_CHALLENGE_ID constant in the
-- frontend (src/hooks/useChallenges.ts).

insert into challenges (id, slug, title, description, daily_goal_seconds, sort_order) values
  ('00000000-0000-4000-8000-000000000002', 'vocab', 'Vokabeln 50 Treffer/Tag',
   'Spiele das Match-Pairs-Spiel und triff jeden Tag 50 deutsch–englische Vokabelpaare.',
   50, 10)
on conflict (slug) do update
  set title              = excluded.title,
      description        = excluded.description,
      daily_goal_seconds = excluded.daily_goal_seconds,
      sort_order         = excluded.sort_order;
