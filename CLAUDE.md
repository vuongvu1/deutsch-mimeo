# Deutsch MiMeo — Session Context

Personal German-learning challenge tracker for **two users** (Mi 🐷 and Meo 🐱). Web app, no login. Built and lives at `/Users/vuhoangvuong/WORKSPACE/personal/deutsch-mimeo`.

> Loading this in a fresh Claude session? Read this whole file before making changes — it captures every product decision and the current state of play.

## What it does

- Two hardcoded users pick themselves on the home page (no auth)
- Each user has separate video libraries and stats
- Three active challenges:
  - **Listen 30 min/day** (YouTube playback)
  - **Abfrage 10 Wörter/Tag** (typed active recall of saved words)
  - **Vokabeln 10 Runden/Tag** (match-pairs minigame, one round = 6 pairs cleared — `sessions.seconds` reused as a generic integer counter for rounds)
  - **Hörverstehen 1×/Tag** (AI-generated German listening paragraph + multiple-choice questions; one *passed* round (>50% correct) ticks the day's checkmark)
- Listen-counter ticks **only while the YouTube IFrame Player reports `PLAYING`** — pause = pause counter
- Day boundary = device-local midnight (`local_date` column on `sessions`)
- A "day complete" = **at least one** active challenge met its daily goal (computed by SQL view, so adding new challenges Just Works). There is no required/optional split — it was removed in `0012_any_challenge_completes_day.sql`
- No streak — just a count of days where every challenge was complete
- Home page shows side-by-side comparison of Mi vs Meo with category winners (👑)

## Tech stack

- **Vite 8** + **React 19** + **TypeScript 7** (native `tsc`, the Go-based compiler — `typescript@^7`, no more `@typescript/native-preview`) — `pnpm dev/build/typecheck/preview`
- **Supabase** Postgres for persistence; project URL + publishable key in `.env.local` (gitignored)
- **TanStack React Query v5** for server state — no global state library
- **React Router v7** with createBrowserRouter
- **Plain CSS modules** + CSS variables (tokens in `src/index.css`)
- **YouTube IFrame Player API** for play-state events; **YouTube oEmbed** for single-video title fetch (no key); **YouTube Data API v3** (`VITE_YOUTUBE_API_KEY`) for playlist bulk-import
- **Cloudflare Worker** entry at `worker/index.ts` (wired via `@cloudflare/vite-plugin` in `vite.config.ts`) — single route `POST /api/listening/generate` that calls **Gemini 2.5 Flash** (`generativelanguage.googleapis.com`) using `responseSchema` for structured JSON. Key lives as a Worker secret `GEMINI_API_KEY` (set via `wrangler secret put GEMINI_API_KEY`); locally via `.dev.vars` at the repo root. Anything else falls through to the static-assets binding (`env.ASSETS.fetch`).
- `@/*` path alias → `src/*` (configured in `tsconfig.app.json` and `vite.config.ts` using `fileURLToPath(new URL('./src', import.meta.url))` — ESM idiom, no `__dirname`)
- pnpm pinned via `package.json#packageManager` (currently `10.33.2`)

## Data model (Supabase)

Schema in `supabase/migrations/0001_init.sql`. Run it in Supabase Studio → SQL Editor to (re-)provision.

| Table | Notes |
|---|---|
| `users` | seeded with `mi`/`meo` rows |
| `challenges` | seeded with `slug='listen'`, `slug='vocab'`, `slug='listening'` — extensible |
| `videos` | per-user library (`user_id` FK), `youtube_id`, `title`, optional `note` |
| `sessions` | one row per playback session — `seconds`, `local_date`, refs `user_id`/`challenge_id`/`video_id`. Reused as generic integer counter (rounds for vocab; passed-round flag = `seconds=1` for listening) |
| `listening_rounds` | history of every *submitted* AI-listening exercise — transcript, questions/options (jsonb), user answers, score, `passed` flag. Only **passed** rounds also insert a `sessions` row (with `seconds=1`) so the day's checkmark ticks via the same `daily_completion` view |

Views:
- `daily_challenge_totals` — sum of seconds per (user, challenge, date)
- `daily_completion` — for any (user, date) where there was activity, computes `all_complete = bool_or(total >= goal)` across active challenges where `activated_on <= local_date`, i.e. one finished challenge marks the day complete. The `activated_on` gate stops a newly-added challenge from inflating `active_challenges_count` on historical days. The client-side mirror is `computeTodayStatus` in `useStats.ts` (`dayComplete = completedCount > 0`); the HomePage/ChallengeList "x / y" badge counts every active challenge.

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
│   ├── useVideos, useVideo, useAddVideo, useAddVideosBulk, useDeleteVideo
│   ├── useSessionTracker  ← live counter + flush logic
│   └── useStats           useUserStats, useComparisonStats,
│                          useTodaySecondsForChallenge, useDailyTotalsRange
├── lib/
│   ├── supabase           untyped createClient (kept loose on purpose)
│   ├── youtube            IFrame API loader, URL → ID parser, oEmbed title,
│   │                      playlist URL parser + Data API playlistItems fetcher
│   └── dates              local-date helpers, formatSeconds, formatMinutes
├── pages/              one folder per page, with .module.css colocated
│   ├── HomePage           user picker + ComparisonPanel (live status) + ActivityLog (recent activity)
│   ├── ChallengeListPage  today's challenges with progress bars
│   ├── VideoLibraryPage   add/list videos, oEmbed title fetch
│   ├── PlayerPage         YouTube embed + counter + live "today total"
│   ├── VocabGamePage      match-pairs minigame, packs, saved-words bookmark
│   ├── ListeningPage      AI-generated paragraph + MCQ; setup → listening → answering → results
│   └── StatsPage          per-user stats + 13-week heatmap
worker/                 Cloudflare Worker entry (Gemini proxy for /api/listening/generate)
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
- **Update `src/lib/changelog.ts`** whenever a feature, bug fix, or notable improvement ships — add an entry with the matching `type` (`feature` / `fix` / `improvement` / `chore`) and concise English `text` (1 sentence max, ~60 chars). Bump the version (semver-ish) and set `date` to today; group same-day changes under one version block. This file powers the in-app Changelog dialog.
- **Bump `src/lib/appVersion.ts`** in lockstep when starting a new version block (same-day appends don't need a bump). `AppHeader` reads `APP_VERSION` from this tiny file to render the version badge — keeping it separate from `changelog.ts` is what lets the Changelog dialog lazy-load its content out of the main bundle

## Adding a new challenge (the easy path)

> When you add a new challenge (a "task"), the **HomePage must be updated in the same change** — steps 7 and 8 below are non-optional. A new challenge that's invisible on the landing page isn't shipped.

1. Insert a row in `challenges` (`slug`, `title`, `description`, `daily_goal_seconds`, `sort_order`) — also mirror it in the seeded `CHALLENGES` array in `src/hooks/useChallenges.ts` with a pinned UUID so the frontend has a stable id to write `sessions.challenge_id` against
2. The challenge appears automatically on `ChallengeListPage` with progress bar
3. `daily_completion` view starts gating "day complete" on this new challenge from its `activated_on` date onwards. The column defaults to `current_date`, so inserting a row today means only today-and-later days require the new challenge — historical "complete" days stay intact.
4. To wire a clickable destination, add an entry to `SLUG_TO_PATH` in `ChallengeListPage.tsx` and build the page(s)
5. Add a branch in `formatChallengeValue` (`src/lib/format.ts`) if "1 second = 1 unit" isn't the right display for the new counter
6. Drop `listening.*` / `vocab.*`-style copy into both `src/i18n/locales/de.ts` and `en.ts`
7. **HomePage — live status:** extend `src/pages/HomePage/ComparisonPanel.tsx` to surface the new challenge in the Mi-vs-Meo table. Accept it via props (alongside `listenChallenge` / `vocabChallenge`), feed it through `useComparisonStats`, and push a new entry into the `categories` array (label + icon + Mi/Meo today values + formatter). HomePage (`src/pages/HomePage/HomePage.tsx`) is where the props get wired — pass the new challenge through there too. Without this step the side-by-side panel silently omits the challenge even though `daily_completion` already gates on it.
8. **HomePage — recent activity:** add a branch in `src/pages/HomePage/ActivityLog.tsx` for the new `challenge_id` (mirror the existing `isVocab` / `isListening` switches): pick the right `verb`, `title`, and `value`, add i18n keys under `activityLog.*` in both `de.ts` and `en.ts`, and decide whether the row should link somewhere (video rows link to the player; vocab/listening rows are non-clickable). The feed already pulls from the generic `useRecentSessions` hook, so the work is purely presentational.

## Deployment

Deployed via **Cloudflare Workers + Static Assets** (the path that replaces classic Pages for Vite projects). Config pinned in `wrangler.jsonc`:

- `assets.not_found_handling: "single-page-application"` handles React Router's client-side routing on `/u/:userId/...` paths. Do **not** add a `public/_redirects` file — Workers Assets rejects rules that strip `.html`/`/index` (infinite-loop validation) and the SPA mode already covers fallback.
- `compatibility_date` is pinned to the day deploy was set up; bump it deliberately when opting into newer runtime behavior.

Build command: `pnpm build` (output: `dist/client` for the SPA + `dist/deutsch_mimeo/` for the Worker bundle, both produced by `@cloudflare/vite-plugin`). Env vars to set in the Cloudflare dashboard for both Production and Preview: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_YOUTUBE_API_KEY`, plus `NODE_VERSION=22` (Vite 8 needs Node ≥20.19). The Gemini key is **not** a `VITE_*` var — it goes to the Worker as a secret via `wrangler secret put GEMINI_API_KEY` (and a `.dev.vars` file at the repo root for local dev: `GEMINI_API_KEY="…"`).

Pushes to `main` auto-redeploy via the Cloudflare ↔ GitHub integration; PRs get preview URLs at `*.pages.dev`. Add the production URL (and any custom domain) to Supabase → Authentication → URL Configuration if you ever turn on auth.

## What's done (commit log)

- `764a624` Initial commit: Deutsch Duo scaffold — full MVP (all 5 pages, Supabase wiring, build green)
- `7fbee7c` Rename to Deutsch MiMeo
- `414735e` Add 13-week activity heatmap to stats page
- `e5a2ac8` chore: update deps (bumped `@types/node`, pinned pnpm)
- `0d296fb` Add SPA fallback for Cloudflare Pages (`public/_redirects`)
- `0332923` Add path aliasing for source directory in Vite config (ESM `fileURLToPath` style)
- `088945f` Add CLAUDE.md with session context for future Claude sessions
- (uncommitted) Add "Hörverstehen" listening-comprehension challenge: AI-generated paragraph + MCQ + bilingual explanations, backed by a Cloudflare Worker proxy to Gemini 2.5 Flash (`worker/index.ts`), `listening_rounds` history table (`supabase/migrations/0009_listening.sql`), and a new `ListeningPage` state machine
- (uncommitted) Add "Abfrage" typed vocab-recall challenge: saved words resurface as typed active-recall quiz (10 correct/day, optional), weighted by miss ratio, backed by times_correct/times_wrong columns (supabase/migrations/0011_recall.sql), new RecallPage + HomePage wiring

## Open ideas (not started — pick what's next)

- **Surface listening stats in `ComparisonPanel`, `ComparePage`, `StatsPage`** — currently only `listen` and `vocab` get heatmaps on StatsPage/ComparePage; listening and recall have no heatmap there (recall does have a ComparisonPanel row)
- **Per-video session history** on the player page (last N sessions, aggregated per-video minutes)
- **All-complete calendar** — different lens than the heatmap, gates on multi-challenge logic
- **Gemini TTS** — swap the long-form Web Speech path for `gemini-2.5-flash` TTS bytes once voice quality matters enough to justify the quota cost
- **Code-split** to silence the chunk warning — only worth doing post-deploy if perf matters

## Things explicitly NOT decided as features

- No login, no password gate (chosen by user — "no that's enough")
- No sharing of videos between Mi and Meo (separate libraries)
- No streak (replaced by "days all complete" count)
- IFrame embed accepted (vs cleaner yt-dlp proxy) — "simple version first"

## Setup recap (for fresh clone)

1. Run every file in `supabase/migrations/` in Supabase Studio → SQL Editor (in filename order). `0001_init.sql` is the base; each later migration is idempotent. The latest is `0012_any_challenge_completes_day.sql` (drops `challenges.optional`; a day is complete once any one challenge hits its goal).
2. `pnpm install && pnpm dev`
3. Create `.dev.vars` at the repo root with `GEMINI_API_KEY="…"` to enable the listening challenge locally (the Cloudflare Vite plugin picks it up automatically). For production: `wrangler secret put GEMINI_API_KEY`.
4. Visit http://localhost:5173

`.env.local` is gitignored but already filled with the project's URL + publishable key for the original developer's checkout. The Gemini key is **not** there — it lives in `.dev.vars` so it never gets inlined into the client bundle.
