-- Deutsch MiMeo: optional challenges don't gate "day complete".
--
-- Run this in Supabase Studio → SQL Editor → New query.
--
-- The listen (30 min YouTube) challenge becomes optional: it still tracks
-- progress and counts toward completed_count, but a day is "all complete"
-- once every *required* challenge hits its goal.

alter table challenges
  add column if not exists optional boolean not null default false;

update challenges
   set optional = (slug = 'listen');

create or replace view daily_completion as
with user_dates as (
  select distinct user_id, local_date from sessions
),
expected as (
  select ud.user_id, ud.local_date, c.id as challenge_id, c.daily_goal_seconds, c.optional
  from user_dates ud
  cross join challenges c
  where c.active = true
    and c.activated_on <= ud.local_date
)
select
  e.user_id,
  e.local_date,
  coalesce(
    bool_and(coalesce(d.total_seconds, 0) >= e.daily_goal_seconds)
      filter (where not e.optional),
    true
  ) as all_complete,
  count(*)::integer as active_challenges_count,
  count(*) filter (where coalesce(d.total_seconds, 0) >= e.daily_goal_seconds)::integer as completed_count
from expected e
left join daily_challenge_totals d
  on d.user_id = e.user_id
 and d.local_date = e.local_date
 and d.challenge_id = e.challenge_id
group by e.user_id, e.local_date;

grant select on daily_completion to anon;
