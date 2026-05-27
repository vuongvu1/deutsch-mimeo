-- Deutsch MiMeo: switch the vocab challenge from "50 matches/day" to
-- "10 rounds completed/day".
--
-- Run this in Supabase Studio → SQL Editor → New query.
--
-- A "round" = clearing one full board of ROUND_SIZE (6) pairs in the
-- match-pairs game. The frontend now bumps sessions.seconds by 1 each
-- time a round is cleared (instead of 1 per matched pair), so the
-- column meaning shifts from "matches" to "rounds completed".
--
-- Existing rows still store match counts, so we convert them by integer
-- division: rounds = matches DIV 6 (any unfinished partial round at the
-- end of a session is dropped, which matches the new semantics).

update sessions
   set seconds = seconds / 6
 where challenge_id = '00000000-0000-4000-8000-000000000002';

update challenges
   set title              = 'Vokabeln 10 Runden/Tag',
       description        = 'Spiele das Match-Pairs-Spiel und schließe jeden Tag 10 volle Runden ab.',
       daily_goal_seconds = 10
 where id = '00000000-0000-4000-8000-000000000002';
