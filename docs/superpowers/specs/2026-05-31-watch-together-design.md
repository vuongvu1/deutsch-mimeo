# "Watch Together" — Design

**Date:** 2026-05-31
**Status:** Approved
**Scope:** Listen challenge (`slug='listen'`, the YouTube `PlayerPage`)

## Summary

On the Listen player, add a **"Zusammen schauen / Watch together"** switch beside Auto-play
and Movie Mode. When ON, the partner (the other of Mi/Meo) is credited the same play-seconds
toward their daily Listen total — counting only while the toggle is on **and** the video is
playing — and both users' live today-totals are displayed side by side.

This is the case where Mi and Meo physically watch one video together on one device and both
want credit for the watch time.

## Decisions (locked)

1. **Crediting start:** from toggle-on. The partner accrues only for play-time that happens
   while the toggle is ON. It never retroactively grabs seconds watched before the toggle flipped.
2. **Persistence:** toggle state lives in `sessionStorage` (new key `mimeo:watchTogether`).
   It survives video changes (auto-next) and reloads within the same tab; it resets to OFF when
   the user manually toggles it off **or** closes the browser tab.
3. **Display:** keep the active user's "session" card; when ON, the "today total" card expands
   into two labeled progress bars — `🐷 Mi` and `🐱 Meo` — each with its own live today-total
   `/ goal` + `ProgressBar`. Both tick up together. When OFF, unchanged (single user).
4. **Partner attribution:** the partner's mirrored session points at the **same `video_id`** as
   the active user's video. `sessions.video_id`'s FK only requires the video to exist (not to be
   owned by the session's user), so this is allowed and keeps the recent-activity feed accurate.
5. **Accrual mechanic:** a dedicated `usePartnerSession` hook driven by a single `active` boolean.

No DB migration: uses the existing `sessions` table; the `listen` challenge already exists.

## Behavior

- **Accrual:** partner accrues only while `watchTogether && isPlaying`. Toggle off (or pause) →
  partner pauses. Toggle back on → partner resumes the same session (no double-count, no
  retroactive grab).
- **Persistence:** `sessionStorage` key `mimeo:watchTogether`. Seeded on mount, persisted on change.
- **Attribution:** partner's `sessions` row mirrors the watched-together seconds against the
  shared `video_id`.

## Components / changes

### 1. `src/hooks/usePartnerSession.ts` (new)

A focused sibling to `useSessionTracker`, without video-position logic.

- **Args:** `{ userId (partner), challengeId, videoId, active: boolean }`.
- On first `active === true`: insert a `sessions` row (`seconds: 0`, today's `local_date`, the
  shared `video_id`).
- Tick `+1s` each second while `active`.
- **Flush** (UPDATE `seconds` + invalidate partner's `['today-seconds', partnerId, challengeId]`,
  `['stats', partnerId]`, `['comparison-stats']`, `['recent-sessions']`) every 10 ticks, on
  `visibilitychange → hidden`, `beforeunload`, unmount, and whenever `active` flips to false.
- No `videos.last_position_seconds` update, no `getCurrentVideoTime`.
- **Returns:** `{ sessionSeconds }`.

### 2. `PlayerScreen` (`src/pages/PlayerPage/PlayerPage.tsx`)

- `partnerId = user.id === 'mi' ? 'meo' : 'mi'`; `useUser(partnerId)` for emoji/name.
- `watchTogether` state seeded from `sessionStorage` (`getInitialWatchTogether()`), persisted via effect.
- `usePartnerSession({ userId: partnerId, challengeId: challenge.id, videoId: video.id,
  active: watchTogether && tracker.isPlaying })`.
- Partner baseline: `useTodaySecondsForChallenge(partnerId, challenge.id)`, snapshotted to a ref
  on first defined value (same pattern as the active user's `baselineRef`).
  `partnerLiveToday = partnerBaseline + partnerSessionSeconds`.
- **Display:** the active user's "session" card stays single. The "today total" card renders two
  labeled rows (`🐷 Mi`, `🐱 Meo`) with live today-total `/ goal` + `ProgressBar` when
  `watchTogether` is on; single user when off. The Movie-Mode stats overlay mirrors this (shows
  the partner's bar too when on).
- Add the third `Switch` (color `amber`, like the others) in the controls row, labeled via
  `t('player.watchTogether')`.

### 3. i18n

`player.watchTogether` in `src/i18n/locales/de.ts` ("Zusammen schauen") and `en.ts` ("Watch together").

### 4. Changelog + version

- Add a `feature` entry to `src/lib/changelog.ts` (~60 chars, English, active voice).
- Bump `src/lib/appVersion.ts` in lockstep (new version block).

## Edge cases

- **Toggle off → on again:** resumes the same partner session (no double-count, no retroactive grab).
- **Auto-next within tab:** toggle stays on (sessionStorage); a fresh partner session starts on
  the new video, attributed to that new `video_id`.
- **HomePage "active now" dot:** partner's session `updated_at` ticks, so the partner correctly
  shows as active — desired, they are watching together.
- **Recent-activity feed:** partner row reads `🐱 Meo watched <Video Title>` via the shared
  `video_id` — accurate, avoids the "deleted video" fallback, requires no ActivityLog change.
- **Video deleted later:** `on delete set null` would null the partner's historical session
  `video_id`, degrading that old feed row to the "deleted video" label. Accepted edge.

## Testing (manual — no test infra in repo)

1. Open `/u/mi/play/<id>`, play → only Mi ticks.
2. Toggle Watch Together on → both Mi and Meo tick together.
3. Pause → both pause. Toggle off → Meo stops, Mi continues.
4. Reload → toggle persists (sessionStorage), Meo resumes on play.
5. New tab → toggle OFF by default.
6. Verify Supabase has a Meo `sessions` row with the shared `video_id`, and HomePage compare +
   Meo's stats reflect the added minutes.
7. `pnpm typecheck` + `pnpm build` green.
