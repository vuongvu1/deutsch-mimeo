-- Deutsch MiMeo: add the "recall" challenge (typed active recall of saved words).
-- Run this in Supabase Studio → SQL Editor → New query (idempotent).
--
-- Goal: 10 correctly typed words per day. Progress reuses sessions.seconds as a
-- generic counter (1 unit = 1 correct answer), same as the vocab challenge.
--
-- times_correct / times_wrong back the weighted sampling: words answered wrong
-- more often are drawn more often (weight = (wrong+1)/(correct+1)).

alter table saved_words
  add column if not exists times_correct integer not null default 0;
alter table saved_words
  add column if not exists times_wrong integer not null default 0;

-- Do NOT re-run this file on a later day: the upsert rewrites activated_on,
-- which would retroactively excuse recall on days between then and now.
-- Pinned id matches RECALL_CHALLENGE_ID in src/hooks/useChallenges.ts.
-- activated_on = current_date so historical "day complete" counts stay intact
-- (days before today never require the new challenge).
insert into challenges (id, slug, title, description, daily_goal_seconds, sort_order, active, optional, activated_on) values
  ('00000000-0000-4000-8000-000000000004', 'recall', 'Abfrage 10 Wörter/Tag',
   'Tippe die deutsche Übersetzung deiner gemerkten Wörter — 10 richtige pro Tag.',
   10, 30, true, true, current_date)
on conflict (id) do update
  set slug               = excluded.slug,
      title              = excluded.title,
      description        = excluded.description,
      daily_goal_seconds = excluded.daily_goal_seconds,
      sort_order         = excluded.sort_order,
      active             = excluded.active,
      optional           = excluded.optional,
      activated_on       = excluded.activated_on;
