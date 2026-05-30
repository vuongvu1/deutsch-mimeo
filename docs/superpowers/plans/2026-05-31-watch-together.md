# Watch Together Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Listen player, add a "Watch together" toggle that credits the partner (the other of Mi/Meo) the same play-seconds toward their daily Listen total while the toggle is on and the video is playing, showing both users' live today-totals side by side.

**Architecture:** A focused new hook `usePartnerSession` mirrors watched-together seconds onto a partner `sessions` row (pointing at the same `video_id`), driven by a single `active` boolean (`watchTogether && isPlaying`). `PlayerScreen` owns a `sessionStorage`-backed `watchTogether` toggle, instantiates the hook, snapshots the partner's today baseline, and renders both progress bars. No DB migration — the `sessions` table and `listen` challenge already exist; `sessions.video_id`'s FK is not owner-scoped.

**Tech Stack:** React 19 + TS, TanStack Query v5, Supabase JS, Radix Themes, react-i18next.

---

## Conventions for this plan

- **No unit-test runner exists** in this repo (`package.json` scripts: dev/build/typecheck/lint/format/preview/deploy). Each task's verification is therefore: `pnpm typecheck`, `pnpm lint`, and (final task) `pnpm build` + a manual browser checklist. There are no failing-unit-test steps.
- **Commits:** this repo's convention is "commit only when the user asks." Treat each `git commit` step as a checkpoint — stage and verify cleanly, but **defer the actual commit until the user approves**. If the user has said to commit, run it as written.
- **Changelog:** today (2026-05-31) already has a `0.11.0` block in `src/lib/changelog.ts`. Per the same-day convention, **append** a new entry to that existing block and do **not** bump `src/lib/appVersion.ts`.

## File structure

- **Create** `src/hooks/usePartnerSession.ts` — partner-session mirror hook (counting + flush safety, no video-position logic). Returns `{ sessionSeconds }`.
- **Modify** `src/pages/PlayerPage/PlayerPage.tsx` — toggle state + persistence, hook wiring, partner baseline, the Switch, dual today-total bars, dual movie-mode overlay, two small presentational sub-components (`TodayProgress`, `MovieStatRow`).
- **Modify** `src/i18n/locales/de.ts` and `src/i18n/locales/en.ts` — add `player.watchTogether`.
- **Modify** `src/lib/changelog.ts` — append a `feature` entry to the existing `0.11.0` block.

---

## Task 1: `usePartnerSession` hook

**Files:**
- Create: `src/hooks/usePartnerSession.ts`

- [ ] **Step 1: Create the hook file**

Create `src/hooks/usePartnerSession.ts` with exactly this content:

```ts
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { todayLocalDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import type { UserId } from '@/types/db'

interface Args {
  userId: UserId
  challengeId: string
  videoId: string
  // True only while watch-together is on AND the source video is playing.
  active: boolean
  // Seconds credited per real second of playback. >1 = cheat mode. Mirrors the
  // active user's tracker so both timers tick identically.
  secondsPerTick?: number
}

const FLUSH_EVERY_TICKS = 10 // flush to DB every 10s of play

/**
 * Mirrors watched-together seconds onto a partner's `sessions` row (same
 * video_id as the active user's video). Counts only while `active`. Shares the
 * same flush-safety as useSessionTracker, minus the video-position logic.
 */
export function usePartnerSession({
  userId,
  challengeId,
  videoId,
  active,
  secondsPerTick = 1,
}: Args) {
  const qc = useQueryClient()
  const secondsPerTickRef = useRef(secondsPerTick)
  secondsPerTickRef.current = secondsPerTick

  const [sessionSeconds, setSessionSeconds] = useState(0)
  const secondsRef = useRef(0)
  secondsRef.current = sessionSeconds
  const sessionIdRef = useRef<string | null>(null)
  const creatingRef = useRef(false)
  const flushingRef = useRef(false)
  const ticksSinceFlushRef = useRef(0)

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current
    if (creatingRef.current) return null
    creatingRef.current = true
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          challenge_id: challengeId,
          video_id: videoId,
          seconds: 0,
          local_date: todayLocalDate(),
        })
        .select('id')
        .single()
      if (error) {
        console.error('Failed to create partner session', error)
        return null
      }
      sessionIdRef.current = data.id
      return data.id
    } finally {
      creatingRef.current = false
    }
  }, [userId, challengeId, videoId])

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    const id = sessionIdRef.current
    const seconds = secondsRef.current
    if (!id || seconds <= 0) return
    flushingRef.current = true
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ seconds, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) console.error('Failed to flush partner session', error)
      qc.invalidateQueries({ queryKey: ['today-seconds', userId, challengeId] })
      qc.invalidateQueries({ queryKey: ['stats', userId] })
      qc.invalidateQueries({ queryKey: ['comparison-stats'] })
      qc.invalidateQueries({ queryKey: ['recent-sessions'] })
    } finally {
      flushingRef.current = false
      ticksSinceFlushRef.current = 0
    }
  }, [qc, userId, challengeId])

  // Create the partner session the first time it goes active.
  useEffect(() => {
    if (active) void ensureSession()
  }, [active, ensureSession])

  // 1-second tick while active.
  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(() => {
      setSessionSeconds((s) => s + secondsPerTickRef.current)
      ticksSinceFlushRef.current += 1
      if (ticksSinceFlushRef.current >= FLUSH_EVERY_TICKS) {
        void flush()
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [active, flush])

  // Flush whenever it deactivates (toggle off / pause). No-op before first tick.
  useEffect(() => {
    if (active) return
    void flush()
  }, [active, flush])

  // Flush when tab is hidden or page is unloaded.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onBeforeUnload = () => {
      void flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [flush])

  // biome-ignore lint/correctness/useExhaustiveDependencies: final flush on unmount only
  useEffect(() => {
    return () => {
      void flush()
    }
  }, [])

  return { sessionSeconds }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. (The hook is exported but not yet consumed — that is fine; TS/biome do not flag exported-but-unused module members.)

- [ ] **Step 3: Commit (defer until user approves — see Conventions)**

```bash
git add src/hooks/usePartnerSession.ts
git commit -m "feat: add usePartnerSession hook for watch-together"
```

---

## Task 2: i18n — `player.watchTogether`

**Files:**
- Modify: `src/i18n/locales/de.ts` (player block, after `movieMode`)
- Modify: `src/i18n/locales/en.ts` (player block, after `movieMode`)

- [ ] **Step 1: Add the German key**

In `src/i18n/locales/de.ts`, in the `player:` object, add the line after `movieMode: 'Kinomodus',`:

```ts
    movieMode: 'Kinomodus',
    watchTogether: 'Zusammen schauen',
    exitMovieMode: 'Kinomodus beenden',
```

- [ ] **Step 2: Add the English key**

In `src/i18n/locales/en.ts`, in the `player:` object, add the line after `movieMode: 'Movie mode',`:

```ts
    movieMode: 'Movie mode',
    watchTogether: 'Watch together',
    exitMovieMode: 'Exit movie mode',
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit (defer until user approves)**

```bash
git add src/i18n/locales/de.ts src/i18n/locales/en.ts
git commit -m "feat: add watch-together i18n copy"
```

---

## Task 3: Wire Watch Together into `PlayerScreen`

**Files:**
- Modify: `src/pages/PlayerPage/PlayerPage.tsx`

- [ ] **Step 1: Import the hook**

In the import group, add (after the `useSessionTracker` import line `import { useSessionTracker } from '@/hooks/useSessionTracker'`):

```ts
import { usePartnerSession } from '@/hooks/usePartnerSession'
```

- [ ] **Step 2: Add the sessionStorage key + initializer**

Next to the other storage-key consts near the top of the file (after `const TAB_SECONDS_STORAGE_KEY = 'mimeo:tabSessionSeconds'`):

```ts
const WATCH_TOGETHER_STORAGE_KEY = 'mimeo:watchTogether'
```

And add this initializer next to the other `getInitial*` helpers (after `getInitialTabBaseline`):

```ts
function getInitialWatchTogether(): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(WATCH_TOGETHER_STORAGE_KEY) === 'true'
}
```

- [ ] **Step 3: Add toggle state, partner identity, baseline, and the hook call**

In `PlayerScreen`, immediately after the existing `const tabSessionSeconds = tabBaseline + tracker.sessionSeconds` line, add:

```ts
  const partnerId: UserId = user.id === 'mi' ? 'meo' : 'mi'
  const partner = useUser(partnerId).data
  const [watchTogether, setWatchTogether] = useState<boolean>(getInitialWatchTogether)
  const partnerTodayQuery = useTodaySecondsForChallenge(partnerId, challenge.id)
  const partnerBaselineRef = useRef<number | null>(null)
  const partnerSession = usePartnerSession({
    userId: partnerId,
    challengeId: challenge.id,
    videoId: video.id,
    active: watchTogether && tracker.isPlaying,
    secondsPerTick: cheat ? CHEAT_MULTIPLIER : 1,
  })
```

- [ ] **Step 4: Persist the toggle + snapshot the partner baseline**

Add these two effects alongside the other `useEffect`s in `PlayerScreen` (e.g. right after the `TAB_SECONDS_STORAGE_KEY` effect):

```ts
  useEffect(() => {
    window.sessionStorage.setItem(WATCH_TOGETHER_STORAGE_KEY, watchTogether ? 'true' : 'false')
  }, [watchTogether])
  useEffect(() => {
    if (partnerBaselineRef.current === null && partnerTodayQuery.data !== undefined) {
      partnerBaselineRef.current = partnerTodayQuery.data
    }
  }, [partnerTodayQuery.data])
```

- [ ] **Step 5: Derive partner live-today values**

Right after the existing `const complete = liveToday >= goal` line, add:

```ts
  const partnerBaseline = partnerBaselineRef.current ?? 0
  const partnerLiveToday = partnerBaseline + partnerSession.sessionSeconds
  const partnerComplete = partnerLiveToday >= goal
```

- [ ] **Step 6: Add the two presentational sub-components**

At the bottom of the file (after the `PlaylistItem` function), add:

```tsx
function TodayProgress({
  emoji,
  today,
  goal,
  complete,
}: {
  emoji?: string
  today: number
  goal: number
  complete: boolean
}) {
  return (
    <Box>
      <Flex align="baseline" gap="2">
        <Text size="3" aria-hidden>
          {emoji}
        </Text>
        <Text size="6" weight="bold">
          {formatMinutes(today)}
        </Text>
        <Text size="2" color="gray">
          / {formatMinutes(goal)}
        </Text>
      </Flex>
      <Box mt="2">
        <ProgressBar value={today} max={goal} complete={complete} />
      </Box>
    </Box>
  )
}

function MovieStatRow({
  emoji,
  today,
  goal,
  complete,
}: {
  emoji?: string
  today: number
  goal: number
  complete: boolean
}) {
  return (
    <Flex align="center" gap="2" style={{ width: '100%' }}>
      <Text size="2" aria-hidden style={{ flexShrink: 0 }}>
        {emoji}
      </Text>
      <Box className={styles.movieStatsBar}>
        <ProgressBar value={today} max={goal} complete={complete} />
      </Box>
      <Flex align="baseline" gap="1" style={{ flexShrink: 0 }}>
        <Text size="2" weight="bold" style={{ color: 'white' }}>
          {formatMinutes(today)}
        </Text>
        <Text size="1" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          / {formatMinutes(goal)}
        </Text>
      </Flex>
    </Flex>
  )
}
```

- [ ] **Step 7: Make the today-total card show both users when on**

Replace the entire second `<Card>` in the stats `<Grid>` (the today-total card, currently lines ~303–318: `<Card>` … `</Card>` containing `t('player.todayTotal')`) with:

```tsx
        <Card>
          <Text size="2" color="gray">
            {t('player.todayTotal')}
          </Text>
          {watchTogether ? (
            <Flex direction="column" gap="3" mt="2">
              <TodayProgress
                emoji={user.emoji}
                today={liveToday}
                goal={goal}
                complete={complete}
              />
              <TodayProgress
                emoji={partner?.emoji}
                today={partnerLiveToday}
                goal={goal}
                complete={partnerComplete}
              />
            </Flex>
          ) : (
            <>
              <Flex align="baseline" gap="2" mt="1">
                <Text size="7" weight="bold">
                  {formatMinutes(liveToday)}
                </Text>
                <Text size="3" color="gray">
                  / {formatMinutes(goal)}
                </Text>
              </Flex>
              <Box mt="3">
                <ProgressBar value={liveToday} max={goal} complete={complete} />
              </Box>
            </>
          )}
        </Card>
```

- [ ] **Step 8: Make the movie-mode overlay show both users when on**

Replace the movie-mode stats overlay block (the `{movieMode ? ( <Box className={styles.movieStats}> … </Box> ) : null}` block, currently lines ~258–275) with:

```tsx
      {movieMode ? (
        <Box
          className={styles.movieStats}
          style={
            watchTogether
              ? { flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }
              : undefined
          }
        >
          {watchTogether ? (
            <>
              <MovieStatRow
                emoji={user.emoji}
                today={liveToday}
                goal={goal}
                complete={complete}
              />
              <MovieStatRow
                emoji={partner?.emoji}
                today={partnerLiveToday}
                goal={goal}
                complete={partnerComplete}
              />
            </>
          ) : (
            <>
              <Text size="2" style={{ flexShrink: 0, color: 'rgba(255, 255, 255, 0.7)' }}>
                {t('player.todayTotal')}
              </Text>
              <Box className={styles.movieStatsBar}>
                <ProgressBar value={liveToday} max={goal} complete={complete} />
              </Box>
              <Flex align="baseline" gap="1" style={{ flexShrink: 0 }}>
                <Text size="3" weight="bold" style={{ color: 'white' }}>
                  {formatMinutes(liveToday)}
                </Text>
                <Text size="1" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  / {formatMinutes(goal)}
                </Text>
              </Flex>
            </>
          )}
        </Box>
      ) : null}
```

- [ ] **Step 9: Add the Watch Together switch**

In the controls `<Flex align="center" gap="4">` (the one holding the Autoplay and Movie-mode switches), add `wrap="wrap"` to that Flex so three switches don't overflow on mobile, and add a third switch after the Movie-mode `<Text as="label">…</Text>` block:

```tsx
          <Text as="label" size="2" color="gray" style={{ cursor: 'var(--cursor-switch)' }}>
            <Flex align="center" gap="2">
              <Switch
                color="amber"
                checked={watchTogether}
                onCheckedChange={setWatchTogether}
                aria-label={t('player.watchTogether')}
              />
              {t('player.watchTogether')}
            </Flex>
          </Text>
```

So the controls Flex opening tag becomes:

```tsx
        <Flex align="center" gap="4" wrap="wrap">
```

- [ ] **Step 10: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. If lint reports import ordering, run `pnpm format` and re-run `pnpm lint`.

- [ ] **Step 11: Commit (defer until user approves)**

```bash
git add src/pages/PlayerPage/PlayerPage.tsx
git commit -m "feat: watch-together toggle with dual timers on player"
```

---

## Task 4: Changelog entry

**Files:**
- Modify: `src/lib/changelog.ts`

- [ ] **Step 1: Append to the existing 0.11.0 block**

In `src/lib/changelog.ts`, inside the `0.11.0` version block's `entries` array (which already contains the cheat-mode entry), append a second entry so it reads:

```ts
  {
    version: '0.11.0',
    date: '2026-05-31',
    entries: [
      {
        type: 'feature',
        text: 'Cheat mode (?cheat=true) counts listen time 2× for busy days.',
      },
      {
        type: 'feature',
        text: 'Watch Together counts listen time for both users on one screen.',
      },
    ],
  },
```

Do **not** edit `src/lib/appVersion.ts` (same-day append needs no version bump).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit (defer until user approves)**

```bash
git add src/lib/changelog.ts
git commit -m "docs: changelog entry for watch-together"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: PASS (tsgo build + vite build, no type errors).

- [ ] **Step 2: Manual browser checklist** (`pnpm dev`, then verify)

1. Open `/u/mi/play/<id>`, press play → only Mi's timer ticks; today-total card shows a single bar.
2. Toggle **Watch together** on → card switches to two labeled bars (🐷 Mi, 🐱 Meo); both tick up together while playing.
3. Pause the video → both stop. Resume → both resume.
4. Toggle Watch together off → Meo's bar disappears, Mi keeps ticking.
5. Toggle on again → Meo resumes from where it left off (no jump, no retroactive grab).
6. Reload the page → toggle is still on (sessionStorage); Meo resumes on play. New video via "Up next" → toggle stays on, Meo accrues against the new video.
7. Open a brand-new browser tab on the player → toggle is OFF by default.
8. Enter Movie mode with Watch together on → overlay pill shows two stacked bars.
9. In Supabase, confirm a `meo` row in `sessions` with the same `video_id` as Mi's video and `seconds` matching the watched-together time.
10. HomePage compare panel and Meo's Stats page reflect the added Listen minutes; recent-activity shows "🐱 Meo … <Video Title>".
11. (Optional) With `?cheat=true`, both Mi and Meo tick at 2×.

---

## Self-review

**Spec coverage:**
- Crediting from toggle-on → `active = watchTogether && tracker.isPlaying`; partner seconds start at 0 and resume on re-toggle (Task 1 + Task 3 Step 3). ✓
- sessionStorage persistence (off on manual toggle or tab close) → `WATCH_TOGETHER_STORAGE_KEY`, `getInitialWatchTogether`, persist effect (Task 3 Steps 2, 4). ✓
- Both today-totals side by side → `TodayProgress` dual bars (Task 3 Steps 6–7). ✓
- Partner session uses the same `video_id` → `videoId: video.id` in the hook call (Task 3 Step 3) and insert (Task 1). ✓
- Switch beside Auto-play / Movie Mode → Task 3 Step 9. ✓
- Movie-mode overlay mirrors → Task 3 Step 8. ✓
- i18n `player.watchTogether` (de + en) → Task 2. ✓
- Changelog feature entry, no appVersion bump → Task 4. ✓
- No DB migration → confirmed; nothing added. ✓
- Cheat-mode consistency → `secondsPerTick: cheat ? CHEAT_MULTIPLIER : 1` passed to the partner hook (Task 3 Step 3). ✓

**Placeholder scan:** none — every code step shows full content.

**Type consistency:** `usePartnerSession` arg names (`userId`, `challengeId`, `videoId`, `active`, `secondsPerTick`) match the call site; it returns `{ sessionSeconds }`, consumed as `partnerSession.sessionSeconds`. `CHEAT_MULTIPLIER`/`cheat` already exist in `PlayerPage.tsx`. `partner?.emoji` guards the always-defined `useUser` result. Sub-component prop names (`emoji`, `today`, `goal`, `complete`) match both call sites.
