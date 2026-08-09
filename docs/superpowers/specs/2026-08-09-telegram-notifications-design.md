# Telegram Notifications — Design

**Date:** 2026-08-09
**Status:** Approved, pending implementation plan

## Goal

Push three kinds of nudge to a shared Telegram group:

1. **Challenge completed** — a user hit one challenge's daily goal.
2. **Day complete** — the user's lifetime "Tage komplett" count went up.
3. **21:00 nag** — it's 21:00 Berlin time and a user has completed nothing today.

## Decisions made during brainstorming

| Question | Decision | Consequence |
|---|---|---|
| What does "streak" mean? | The **existing** days-complete counter, not a new consecutive-day streak | Zero new streak SQL. But because any one challenge completes a day, event 1 and event 2 fire simultaneously on the first completion of the day — they must merge into a single message. |
| One chat or per-user chats? | **One shared group chat** | Single `TELEGRAM_CHAT_ID`. Peer visibility matches the Mi-vs-Meo framing the app already uses. |
| Trigger mechanism? | **Client push** for events 1 and 2, **cron** for event 3 | Instant delivery. Costs a doorbell call at each session-write site; a cron poll would have needed none, but delivery would lag up to 2 min. |

The client push is deliberately a *doorbell*, not a decision: it posts `{userId, challengeId}` and the Worker decides whether anything is worth sending. This keeps all goal math, dedup, and message copy in one server-side place, and means no React component needs to track before/after state.

## Architecture

```
React (any session flush)
  └─ pingProgress(userId, challengeId)   fire-and-forget, keepalive
       └─ POST /api/notify
            ├─ read challenges + daily_challenge_totals   (Supabase REST)
            ├─ claim rows in `notifications`              (atomic, dedup)
            └─ sendMessage                                (Telegram Bot API)

Cloudflare Cron "0 19,20 * * *"
  └─ scheduled()  → bail unless Berlin hour == 21
       ├─ read challenges + daily_challenge_totals
       ├─ claim ('nag', null) per incomplete user
       └─ sendMessage
```

### Why a dedup table rather than client-side state

Notifications are edge-triggered ("just crossed the goal"); the database stores level state ("total seconds today"). Something must remember what was already announced. Client memory does not survive a reload, a second device, or a tab close mid-play. A table does — and it doubles as an audit log.

## Component 1 — `supabase/migrations/0013_notifications.sql`

```sql
create table if not exists notifications (
  user_id      text not null references users(id),
  kind         text not null,                    -- 'challenge' | 'day' | 'nag'
  challenge_id uuid references challenges(id),   -- only set for kind='challenge'
  local_date   date not null,
  sent_at      timestamptz not null default now()
);

create unique index if not exists notifications_dedup
  on notifications (user_id, kind, local_date, challenge_id) nulls not distinct;

grant all on notifications to anon;
```

No surrogate primary key: the dedup index *is* the identity. `NULLS NOT DISTINCT`
(Postgres 15+) is what makes `('mi','day',today,null)` collide with itself — without
it, Postgres treats every NULL as unique and the `day`/`nag` kinds would send
repeatedly. The alternative was a `coalesce(challenge_id, '000…'::uuid)` expression
index; `NULLS NOT DISTINCT` says the same thing in fewer characters.

`grant all` (not `grant select`) matches the existing `"anon all"` RLS posture — the
Worker uses the same publishable key as the browser, so no service-role key is
introduced anywhere.

### The claim pattern

Insert via Supabase REST with:

```
POST /rest/v1/notifications?on_conflict=user_id,kind,local_date,challenge_id
Prefer: resolution=ignore-duplicates,return=representation
```

A non-empty response array means *this* request won the race and owns the send.
An empty array means it was already claimed — skip Telegram, return success.
This makes the endpoint idempotent: repeated pings, concurrent devices, a redeploy
mid-flight, or a cron that fires twice all converge on exactly one message.

## Component 2 — `src/lib/notify.ts`

```ts
export function pingProgress(userId: string, challengeId: string) {
  void fetch('/api/notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId, challengeId }),
    keepalive: true,
  }).catch(() => {})
}
```

`keepalive: true` is what lets the ping survive an unmount or tab close — the same
failure window `useSessionTracker`'s final flush already fights. Errors are
swallowed on purpose: a failed notification must never surface in the UI or break a
session write.

### Call sites (four, one line each)

Added inside the existing `flush()` / insert paths:

| File | Challenge | Note |
|---|---|---|
| `src/hooks/useSessionTracker.ts` | `listen` | Flushes every ~10s while playing |
| `src/hooks/useMatchSession.ts` | `vocab` | Once per cleared round |
| `src/hooks/usePartnerSession.ts` | `recall` | Used by `RecallPage` with `RECALL_CHALLENGE_ID` |
| `src/hooks/useListening.ts` (~line 76) | `listening` | The `seconds: 1` submit insert |

**Do not** add a ping to `src/pages/ListeningPage/ListeningPage.tsx` (~line 232). That
write is a liveness/presence ping with `seconds: 0` — it represents no progress, and
pinging there would waste requests on every 20s heartbeat.

Accepted cost, marked in code:

```ts
// ponytail: rings on every flush (~10s while playing); worker dedups.
// Gate on baseline+session >= goal only if request volume ever matters.
```

At two users this is a few hundred requests/day against a 100k/day free tier. The
upgrade path — pass the goal and baseline into the hook and compare client-side —
is real but not yet worth the prop threading.

## Component 3 — `worker/notify.ts` (new file)

`worker/index.ts` is already 455 lines; notification logic lands in its own module
and is wired into the existing route dispatch.

### `POST /api/notify`

1. Parse body. Validate `userId ∈ {'mi','meo'}` and `challengeId` is a UUID. Reject
   anything else with `204` (see security note — the client is never told).
2. Read active `challenges` (id, title, `daily_goal_seconds`) and
   `daily_challenge_totals` for `(userId, today)`. Two REST reads. Both are already
   granted to `anon` (`0001_init.sql:116`).
3. If the pinged challenge's total ≥ its goal → claim `('challenge', challengeId)`.
   On a successful claim, build line 1.
4. If *any* active challenge's total ≥ its goal → claim `('day', null)`. On a
   successful claim, read the lifetime complete-day count from `daily_completion`
   and build line 2.
5. If both claims succeeded in the same request, send **one** message with both
   lines. This is the merge the any-challenge-completes-day rule forces.
6. Always respond `204`. The client has nothing useful to do with a failure.

`today` is computed in the Worker as the Berlin local date (`Europe/Berlin`), so it
agrees with the client's `local_date`. Both users are in one timezone; if that ever
stops being true, the client would need to send its own `local_date`.

### `scheduled()` — the 21:00 nag

`wrangler.jsonc` gains:

```jsonc
"triggers": { "crons": ["0 19,20 * * *"] }
```

Cloudflare crons are UTC-only. 21:00 Berlin is 19:00 UTC in summer and 20:00 UTC in
winter, so the trigger fires at both and the handler bails unless the *actual*
Berlin hour is 21:

```ts
const hour = Number(
  new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: 'numeric',
    hour12: false,
  }).format(now),
)
if (hour !== 21) return
```

That is the entire DST story — no offset table, no second cron to remember to change
twice a year, no drift when the EU eventually moves the changeover dates.

Then: read the same two tables, find users whose completed-challenge count today is
zero, claim `('nag', null)` for each, and send one combined message naming whoever
was successfully claimed. Nothing to claim → no message.

Deriving "incomplete" from `daily_challenge_totals` rather than from the absence of a
`('day', null)` notification row means the nag is correct even if a doorbell ping was
lost.

### Environment

| Name | Type | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Secret | Bot API auth |
| `TELEGRAM_CHAT_ID` | Text | Target group (negative number) |
| `SUPABASE_URL` | Text | REST base |
| `SUPABASE_PUBLISHABLE_KEY` | Text | Same key the browser uses |

Locally these go in `.dev.vars` alongside `GEMINI_API_KEY`. The Gemini precedent
already establishes that Worker-side keys are *not* `VITE_*` vars, so none of these
get inlined into the client bundle. `TELEGRAM_BOT_TOKEN` is the only true secret;
the other three are already public or effectively public.

## Security posture

`/api/notify` is public and unauthenticated, matching the existing
`/api/listening/generate`. This is a deliberate accepted risk, not an oversight:

- The request body **selects a template**; it cannot inject message text. A caller
  cannot make the bot say anything arbitrary.
- The dedup table caps output at 6 messages per user per day (4 challenges + 1 day
  + 1 nag) regardless of how many times the endpoint is hit, so it cannot be turned
  into a Telegram spam cannon. Only 5 of those are reachable via `/api/notify` at
  all; the nag is cron-only.
- The residual cost of abuse is wasted Worker and Supabase requests, bounded by
  Cloudflare's own rate limiting.
- `userId` is validated against a two-value allowlist and `challengeId` against a
  UUID shape before either reaches a query.

If this ever needs hardening, the cheap next step is a shared header token
(`X-Notify-Key`) checked in the Worker — but it would have to be shipped in the
client bundle to be usable, so it deters scanners, not a determined reader. Not
included.

## Message copy

German, matching the existing UI copy. Mi is 🐷, Meo is 🐱.

First completion of the day (both events, one message):

```
🐷 Mi hat "Abfrage 10 Wörter/Tag" geschafft! ✅
🔥 Tag komplett! (43 Tage insgesamt)
```

Any later completion the same day:

```
🐷 Mi hat "Vokabeln 10 Runden/Tag" geschafft! ✅
```

21:00 nag:

```
⏰ 21:00 — heute noch nichts geschafft:
🐱 Meo
Noch 3 Stunden! 💪
```

Both users done by 21:00 → no message at all. There is no congratulatory
end-of-day summary.

## Testing

`worker/notify.test.ts`, run with `node --test worker/notify.test.ts`. Node 24
strips TypeScript natively, so this adds **zero dependencies** — the project has no
test runner today and does not gain one.

Two pure functions get extracted and covered, chosen because both fail *silently*
and would otherwise only be noticed months later:

1. **The Berlin-hour guard** — assert that a `2026-08-09T19:00:00Z` instant reads as
   hour 21 (CEST) and a `2026-12-09T19:00:00Z` instant does not (CET, hour 20). This
   is the test that catches a DST regression in November instead of on the day.
2. **The completion decision** — given challenge goals and a totals map, assert which
   challenges count as complete and which users count as incomplete, including the
   zero-rows case (a user with no activity at all must be nagged, not skipped).

No framework, no fixtures, no per-function suite.

## Files touched

| File | Change |
|---|---|
| `supabase/migrations/0013_notifications.sql` | New — table, dedup index, grant |
| `worker/notify.ts` | New — claim, decisions, Telegram send, cron handler body |
| `worker/notify.test.ts` | New — `node --test` checks |
| `worker/index.ts` | Route `/api/notify`, export `scheduled` |
| `wrangler.jsonc` | `triggers.crons` |
| `src/lib/notify.ts` | New — `pingProgress` |
| `src/hooks/useSessionTracker.ts` | One ping in `flush` |
| `src/hooks/useMatchSession.ts` | One ping in `flush` |
| `src/hooks/usePartnerSession.ts` | One ping in `flush` |
| `src/hooks/useListening.ts` | One ping after the `seconds: 1` insert |
| `src/lib/changelog.ts` | New `0.21.0` block |
| `src/lib/appVersion.ts` | → `0.21.0` |
| `CLAUDE.md` | Notification system section; migration count; env var list |

No i18n files change — Telegram copy is server-side German only.

## Out of scope

- A real consecutive-day streak (explicitly rejected — the existing counter is used).
- Per-user private chats, and any notification preferences or mute switch.
- In-app notifications, web push, or PWA notifications.
- Notifying on partner/watch-together events, saved-word milestones, or listening scores.
- Any auth on `/api/notify`.

## Setup — Claude in Chrome prompt

Run after the code ships. Phase 1 must complete before Phase 2, since Cloudflare has
nothing to store until BotFather has issued the token.

```
Phase 1 — Telegram bot + chat ID.

1. Open https://web.telegram.org and search for @BotFather. Send /newbot.
   Name it "Deutsch MiMeo" and pick any free username ending in "bot".
   Copy the HTTP API token it returns — show it to me, that is TELEGRAM_BOT_TOKEN.
2. Create a Telegram group called "Deutsch MiMeo", add the new bot to it,
   and send any message in the group (the bot cannot see the group until
   there is at least one message).
3. Open this URL in a new tab, replacing <TOKEN>:
   https://api.telegram.org/bot<TOKEN>/getUpdates
   Find "chat":{"id":-100...} in the JSON and report that id, including the
   minus sign. That is TELEGRAM_CHAT_ID.

Phase 2 — Cloudflare Worker config.

4. Go to https://dash.cloudflare.com → Compute (Workers) → the
   "deutsch-mimeo" Worker → Settings → Variables and Secrets.
5. Add these four. Only the first is type "Secret"; the rest are "Text":
   - TELEGRAM_BOT_TOKEN        = <token from step 1>   [Secret]
   - TELEGRAM_CHAT_ID          = <chat id from step 3> [Text]
   - SUPABASE_URL              = <ask me for this>     [Text]
   - SUPABASE_PUBLISHABLE_KEY  = <ask me for this>     [Text]
   Save and deploy.
6. Go to Settings → Trigger Events and confirm a Cron Trigger
   "0 19,20 * * *" is listed. If it is missing, do NOT add it by hand —
   tell me, because it is supposed to come from wrangler.jsonc on deploy.
7. Screenshot the final variables list with the secret value masked, and
   confirm the four names are spelled exactly as above.

Do not paste any of these values into a search box, a public page, or any
site other than the two above. If a step needs a value you do not have,
stop and ask me rather than guessing.
```

The two Supabase values are handed over manually at step 5 rather than letting a
browser agent read the gitignored `.env.local`.

Also required, and not doable from the browser: run
`supabase/migrations/0013_notifications.sql` in Supabase Studio → SQL Editor, and add
the four variables to `.dev.vars` for local development.
