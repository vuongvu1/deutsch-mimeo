# Deutsch Duo

Personal German-learning challenge tracker for two users (Mi 🐷 and Meo 🐱). Web app, no login.

## First time setup

### 1. Run the schema in Supabase

1. Open the [Supabase project](https://fzvzmuhagvcbftmgpmff.supabase.co) → **SQL Editor** → **New query**
2. Paste the contents of [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
3. Click **Run**

This creates the tables, views, RLS policies, and seeds the two users + the listening challenge.

### 2. Local dev

```bash
pnpm install
pnpm dev
```

Visit http://localhost:5173.

`.env.local` already has the project URL and publishable key checked in (gitignored).

### 3. Deploy

Recommended: Vercel.

1. Push the repo to GitHub
2. Import on Vercel — framework preset: Vite
3. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Deploy

## How it works

### Users

Two hardcoded users — `mi` and `meo`. No auth: anyone with the URL picks who they are. The publishable key allows reading and writing all tables (RLS policies grant `anon` full access).

### Challenges

Listed in the `challenges` table. Currently:

- `listen` — watch German YouTube videos for at least 30 min/day

Add new challenges by inserting into the `challenges` table. The "day complete" view (`daily_completion`) automatically requires every active challenge's daily goal to be met.

To wire a new challenge to a UI, add an entry to `SLUG_TO_PATH` in [`src/pages/ChallengeListPage/ChallengeListPage.tsx`](./src/pages/ChallengeListPage/ChallengeListPage.tsx).

### Listening counter

- Each user has their own video library (`videos` table).
- Adding a video = paste any YouTube URL; the title is auto-fetched via YouTube oEmbed.
- Click a video to open the player. The counter ticks **only while the YouTube player reports `PLAYING`** state.
- Sessions persist to the `sessions` table every 10 seconds, on pause/end, on tab hidden, and on page unload — so closing the tab keeps your progress (minus up to ~10s).
- Day boundary = the device's local midnight (`local_date` is captured client-side at session start).
- Once the daily goal is reached, the user can keep watching; the counter still runs.

### Stats

- Per-user: today / 7d / 30d / all-time minutes, longest single session, video count, days where all active challenges were complete, distinct active days.
- Comparison: home page highlights who leads in each category (today, 7-day, days complete, longest session) with 👑.

## Project layout

```
src/
├── components/        Shared UI (TopBar, ProgressBar)
├── hooks/             React Query hooks per domain
├── lib/               supabase client, YouTube helpers, date helpers
├── pages/             One folder per page
│   ├── HomePage/             User picker + comparison
│   ├── ChallengeListPage/    Today's challenges with progress
│   ├── VideoLibraryPage/     Add + list videos for the listening challenge
│   ├── PlayerPage/           YouTube embed + live counter
│   └── StatsPage/            Personal stats
├── routes/            Router + path helpers
├── types/             DB row types
└── index.css          Global tokens + reset
supabase/
└── migrations/0001_init.sql
```

## Scripts

- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm typecheck` — tsc without emit
- `pnpm preview` — preview the production build locally
