-- Deutsch MiMeo: dedup ledger for Telegram notifications.
--
-- Run this in Supabase Studio → SQL Editor → New query.
--
-- Notifications are edge-triggered ("just crossed the goal") but the data is
-- level state ("total seconds today"), so something has to remember what was
-- already announced. Client memory doesn't survive a reload, a second device
-- or a tab close mid-play; this table does, and doubles as an audit log.

create table if not exists notifications (
  user_id      text not null references users(id),
  kind         text not null,                    -- 'challenge' | 'day' | 'nag'
  challenge_id uuid references challenges(id),   -- only set for kind='challenge'
  local_date   date not null,
  sent_at      timestamptz not null default now()
);

-- No surrogate key: this index *is* the row identity. NULLS NOT DISTINCT (PG15+)
-- is what makes ('mi','day',today,null) collide with itself — without it Postgres
-- treats every NULL as unique and the day/nag kinds would resend on every ping.
create unique index if not exists notifications_dedup
  on notifications (user_id, kind, local_date, challenge_id) nulls not distinct;

alter table notifications enable row level security;
drop policy if exists "anon all" on notifications;
create policy "anon all" on notifications for all to anon using (true) with check (true);

grant all on notifications to anon;
