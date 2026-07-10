# „Abfrage" — Typed Vocab Recall Challenge

**Date:** 2026-07-10
**Status:** Approved design, pre-implementation

## Summary

A fourth daily challenge that resurfaces each user's bookmarked words (`saved_words`)
as a typed active-recall quiz. Show the English side, the user types the German word,
tolerant string comparison decides correct/wrong. Words the user gets wrong appear
more often on later days (weighted random, no full SRS).

- **Slug:** `recall`
- **Pinned UUID:** `00000000-0000-4000-8000-000000000004`
- **Daily goal:** 10 correct answers (`daily_goal_seconds = 10`, generic-counter convention)
- **Required:** no (`optional = true`) — tracks progress and shows its own checkmark but doesn't gate `all_complete` (changed from required after initial build)
- **Sort order:** 30

## Data model

One migration, `supabase/migrations/0011_recall.sql` (idempotent, same style as 0010):

1. `alter table saved_words add column if not exists times_correct int not null default 0;`
   `alter table saved_words add column if not exists times_wrong int not null default 0;`
2. Insert the `challenges` row (`slug='recall'`, title `Abfrage 10 Wörter/Tag`,
   `daily_goal_seconds=10`, `sort_order=30`, `optional=true`). `activated_on` keeps its
   `current_date` default so historical "complete" days stay intact.
3. Mirror the row in the seeded `CHALLENGES` array in `src/hooks/useChallenges.ts`
   with the pinned UUID above (`RECALL_CHALLENGE_ID`).

No new tables. Daily progress reuses `sessions` rows exactly like the vocab game:
one row per quiz session, `seconds` = number of correct answers, flushed incrementally.
`daily_completion` picks it up automatically.

## Quiz mechanics (`RecallPage`)

State machine: `setup → quiz → done` (mirrors ListeningPage's phase style, much smaller).

- **Sampling:** draw a batch of 10 prompts from the user's `saved_words`, weighted
  random without replacement; weight = `(times_wrong + 1) / (times_correct + 1)`
  (Laplace-smoothed ratio — new words weight 1, frequently-missed words float up).
  If the pool has fewer than 10 words, words repeat across batches; never show the
  same word twice in a row when pool size > 1.
- **Prompt:** show `en` only. The `note` field is never shown in the prompt — it may
  contain the German word and would give the answer away.
- **Answer check:** normalize both sides — trim, collapse inner whitespace, lowercase,
  `ß → ss`, `ä/ö/ü → ae/oe/ue`. A leading article (`der `/`die `/`das `) on the stored
  word is optional in the typed answer. Full stored form is always shown as feedback.
- **Correct:** counter +1, `times_correct + 1` persisted, next word.
- **Wrong:** show the correct answer, `times_wrong + 1` persisted, word re-queued at
  the end of the current batch, does not count toward the goal.
- **Session tracking:** insert a `sessions` row on first answer, flush the running
  correct-count using the established flush pattern (interval + pause/hidden/unload/unmount).
- **Empty notebook:** setup screen explains the challenge needs saved words and links
  to the vocab game.

## Integration checklist (per CLAUDE.md "Adding a new challenge")

1. `SLUG_TO_PATH` entry in `ChallengeListPage.tsx` + route `/u/:userId/recall`
   (path builder in `routes/paths.ts`, router entry).
2. `formatChallengeValue` branch in `src/lib/format.ts` — display as `x Wörter`.
3. **HomePage — ComparisonPanel:** new category row (label + icon + Mi/Meo today
   values + formatter), prop-wired through `HomePage.tsx` and `useComparisonStats`.
4. **HomePage — ActivityLog:** new branch keyed on `RECALL_CHALLENGE_ID`
   (verb/title/value, non-clickable like vocab rows), i18n keys under `activityLog.*`.
5. i18n: `recall.*` keys in both `src/i18n/locales/de.ts` and `en.ts`.
6. `src/lib/changelog.ts` entry + `src/lib/appVersion.ts` bump (new version block).

## Error handling

- Supabase write failures on `times_correct`/`times_wrong` updates are fire-and-forget
  with console warning — a lost stat nudge is acceptable; the correct-count flush uses
  the same retry-on-next-flush semantics as the existing tracker.
- Pool fetched once per page load via React Query; stat updates mutate the cache
  locally so weights stay fresh within a session without refetching.

## Testing

- `pnpm typecheck && pnpm build` green.
- Manual: empty pool screen, pool < 10 repeats, wrong-answer re-queue, article-optional
  and umlaut-normalized answers, day checkmark ticks in `daily_completion` after 10
  correct, ComparisonPanel and ActivityLog rows render for both users.

## Explicitly out of scope

- Real SRS (due dates, intervals) — weighted random is the deliberate ceiling;
  upgrade path is a `word_reviews` table if retention data ever matters.
- Editing/deleting saved words from the quiz UI (library management stays in the
  vocab game / wherever it lives today).
- Audio/TTS of prompts.
