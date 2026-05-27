-- Deutsch MiMeo: gate "days complete" on which challenges existed on that day.
--
-- Run this in Supabase Studio → SQL Editor → New query.
--
-- Problem: the previous daily_completion view cross-joined every active
-- challenge against every (user, date) pair, so adding a new challenge
-- retroactively turned all prior "complete days" into incomplete ones.
--
-- Fix: every challenge gets an activated_on date. A day expects a
-- challenge only when activated_on <= that day. Existing rows are
-- back-filled to their created_at date so listen-only days before vocab
-- arrived still count as complete.

alter table challenges
  add column if not exists activated_on date;

update challenges
   set activated_on = created_at::date
 where activated_on is null;

alter table challenges
  alter column activated_on set not null,
  alter column activated_on set default current_date;

create or replace view daily_completion as
with user_dates as (
  select distinct user_id, local_date from sessions
),
expected as (
  select ud.user_id, ud.local_date, c.id as challenge_id, c.daily_goal_seconds
  from user_dates ud
  cross join challenges c
  where c.active = true
    and c.activated_on <= ud.local_date
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

grant select on daily_completion to anon;
