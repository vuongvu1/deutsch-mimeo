-- Prevent duplicate videos per user (same youtube_id added twice).
-- Run in Supabase Studio → SQL Editor → New query (idempotent).

-- Drop any existing duplicates first, keeping the oldest row per (user_id, youtube_id).
-- Sessions referencing dropped video rows get video_id = null (FK is "on delete set null").
delete from videos v
using videos v2
where v.user_id = v2.user_id
  and v.youtube_id = v2.youtube_id
  and v.created_at > v2.created_at;

alter table videos drop constraint if exists videos_user_youtube_unique;
alter table videos add constraint videos_user_youtube_unique unique (user_id, youtube_id);
