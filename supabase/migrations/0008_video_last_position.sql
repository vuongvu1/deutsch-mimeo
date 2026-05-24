-- Remember per-video playback position so the player can resume where the user left off.
-- Run in Supabase Studio → SQL Editor → New query (idempotent).

alter table videos
  add column if not exists last_position_seconds integer not null default 0;
