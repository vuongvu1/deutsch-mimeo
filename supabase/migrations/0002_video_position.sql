-- Adds a per-user ordering field to videos.
-- Run in Supabase Studio → SQL Editor → New query (idempotent).

alter table videos add column if not exists position double precision;

-- Backfill any NULL positions from created_at (newest first → lowest rank).
update videos v
set position = ranked.rn
from (
  select id,
         row_number() over (partition by user_id order by created_at desc)::double precision as rn
  from videos
  where position is null
) ranked
where v.id = ranked.id;

alter table videos alter column position set default 0;
alter table videos alter column position set not null;

create index if not exists videos_user_position_idx on videos(user_id, position);
