-- Deutsch MiMeo: wipe all vocab session rows so the comparison table
-- and stats start fresh on the new "10 rounds/day" metric.
--
-- Run this in Supabase Studio → SQL Editor → New query.
--
-- This deletes only sessions tied to the vocab challenge; listen
-- sessions, saved words, the challenge row itself, and users are untouched.

delete from sessions
 where challenge_id = '00000000-0000-4000-8000-000000000002';
