# Deutsch MiMeo — Session Context

Personal German-learning challenge tracker for **two users** (Mi 🐷 and Meo 🐱). Web app, no login. Built and lives at `/Users/vuhoangvuong/WORKSPACE/personal/deutsch-mimeo`.

> Loading this in a fresh Claude session? Read this whole file before making changes — it captures every product decision and the current state of play.

## What it does

- Two hardcoded users pick themselves on the home page (no auth)
- Each user has separate video libraries and stats
- One challenge so far: **Listen 30 min/day** to German YouTube videos
- Counter ticks **only while the YouTube IFrame Player reports `PLAYING`** — pause = pause counter
- Day boundary = device-local midnight (`local_date` column on `sessions`)
- A "day complete" = ALL active challenges met their daily goal (computed by SQL view, so adding new challenges Just Works)
- No streak — just a count of days where every challenge was complete
- Home page shows side-by-side comparison of Mi vs Meo with category winners (👑)

## Tech stack

- **Vite 8** + **React 19** + **TypeScript** (tsgo / tsc 6) — `pnpm dev/build/typecheck/preview`
- **Supabase** Postgres for persistence; project URL + publishable key in `.env.local` (gitignored)
- **TanStack React Query v5** for server state — no global state library
- **React Router v7** with createBrowserRouter
- **Plain CSS modules** + CSS variables (tokens in `src/index.css`)
- **YouTube IFrame Player API** for play-state events; **YouTube oEmbed** for auto-fetching titles (no API key needed)
- `@/*` path alias → `src/*` (configured in `tsconfig.app.json` and `vite.config.ts`)

## Data model (Supabase)

Schema in `supabase/migrations/0001_init.sql`. Run it in Supabase Studio → SQL Editor to (re-)provision.

| Table | Notes |
|---|---|
| `users` | seeded with `mi`/`meo` rows |
| `challenges` | seeded with `slug='listen', daily_goal_seconds=1800` — extensible |
| `videos` | per-user library (`user_id` FK), `youtube_id`, `title`, optional `note` |
| `sessions` | one row per playback session — `seconds`, `local_date`, refs `user_id`/`challenge_id`/`video_id` |

Views:
- `daily_challenge_totals` — sum of seconds per (user, challenge, date)
- `daily_completion` — for any (user, date) where there was activity, computes `all_complete = bool_and(total >= goal)` across active challenges via `cross join` so missing-challenge days don't false-positive

RLS: enabled on all tables, single policy `"anon all"` granting full access to the `anon` role. This is intentional for a personal app with no auth.

## Project layout

```
src/
├── components/         Shared UI
│   ├── TopBar           back arrow + emoji + title
│   ├── ProgressBar
│   └── Heatmap          GitHub-style 13-week activity grid
├── hooks/              React Query hooks per domain
│   ├── useUsers, useUser
│   ├── useChallenges, useChallengeBySlug
│   ├── useVideos, useVideo, useAddVideo, useDeleteVideo
│   ├── useSessionTracker  ← live counter + flush logic
│   └── useStats           useUserStats, useComparisonStats,
│                          useTodaySecondsForChallenge, useDailyTotalsRange
├── lib/
│   ├── supabase           untyped createClient (kept loose on purpose)
│   ├── youtube            IFrame API loader, URL → ID parser, oEmbed title
│   └── dates              local-date helpers, formatSeconds, formatMinutes
├── pages/              one folder per page, with .module.css colocated
│   ├── HomePage           user picker + ComparisonPanel
│   ├── ChallengeListPage  today's challenges with progress bars
│   ├── VideoLibraryPage   add/list videos, oEmbed title fetch
│   ├── PlayerPage         YouTube embed + counter + live "today total"
│   └── StatsPage          per-user stats + 13-week heatmap
├── routes/
│   ├── paths.ts           path builders + routePatterns
│   └── router.tsx         createBrowserRouter
├── types/db.ts         Row types only (UserRow, ChallengeRow, etc.) — Database generic was removed
└── index.css           tokens, reset, .container/.card/.btn classes
supabase/migrations/0001_init.sql
```

## Counter mechanics — why it works

`useSessionTracker` (in `src/hooks/useSessionTracker.ts`):

1. On first `handlePlay()`, inserts a new `sessions` row with `seconds=0` and today's `local_date`
2. While `isPlaying`, a 1-second `setInterval` increments `sessionSeconds` in state
3. Every 10 ticks, **flushes** the running total to that session row (UPDATE)
4. Also flushes on: pause, end, `visibilitychange → hidden`, `beforeunload`, unmount
5. Worst case data loss = ~10s if user closes the tab mid-play

PlayerPage shows two stats: "this session" (= `sessionSeconds`) and "today total" (= `baseline + sessionSeconds`, where `baseline` is the persisted today total snapshotted on first load — avoids double-counting flushes).

## Key conventions

- **Named exports** for components and hooks, **default exports** are not used
- **Imports**: external first, then `@/...`, alphabetical within groups, blank line between groups
- **CSS modules** colocated as `Foo.module.css` next to `Foo.tsx`; design tokens only (no fallback values)
- **German UI copy** is intentional (Lade…, Heute, Tage komplett, etc.)
- **No comments** unless explaining a non-obvious *why*
- **No `TodoWrite` from Claude** in user-facing work — this file is the source of truth for follow-ups

## Adding a new challenge (the easy path)

1. Insert a row in `challenges` (`slug`, `title`, `description`, `daily_goal_seconds`, `sort_order`)
2. The challenge appears automatically on `ChallengeListPage` with progress bar
3. `daily_completion` view starts gating "day complete" on this new challenge for any day that has activity
4. To wire a clickable destination, add an entry to `SLUG_TO_PATH` in `ChallengeListPage.tsx` and build the page(s)

## What's done (commit log)

- `764a624` Initial commit: Deutsch Duo scaffold — full MVP (all 5 pages, Supabase wiring, build green)
- `7fbee7c` Rename to Deutsch MiMeo
- `414735e` Add 13-week activity heatmap to stats page

## Open ideas (not started — pick what's next)

- **Push to GitHub + deploy on Vercel** — needs the user to create the repo
- **Per-video session history** on the player page (last N sessions, aggregated per-video minutes)
- **All-complete calendar** — different lens than the heatmap, gates on multi-challenge logic
- **Add a 2nd challenge end-to-end** (e.g. `lesen` reading) to exercise multi-challenge "day complete" in the UI
- **Code-split** to silence the 540 KB chunk warning — only worth doing post-deploy if perf matters

## Things explicitly NOT decided as features

- No login, no password gate (chosen by user — "no that's enough")
- No sharing of videos between Mi and Meo (separate libraries)
- No streak (replaced by "days all complete" count)
- IFrame embed accepted (vs cleaner yt-dlp proxy) — "simple version first"

## Setup recap (for fresh clone)

1. Run `supabase/migrations/0001_init.sql` in Supabase Studio
2. `pnpm install && pnpm dev`
3. Visit http://localhost:5173

`.env.local` is gitignored but already filled with the project's URL + publishable key for the original developer's checkout.
