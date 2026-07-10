# „Abfrage" Typed Vocab Recall Challenge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th daily challenge (`recall`, required): the user types the German for their bookmarked `saved_words`, 10 correct answers per day, wrong-heavy words drawn more often.

**Architecture:** One idempotent SQL migration (two int columns on `saved_words` + pinned-UUID challenge row). A new `RecallPage` reuses the existing `useMatchSession` generic counter hook (1 correct answer = 1 unit in `sessions.seconds`), so `daily_completion`, ChallengeListPage, and stats pick it up automatically. Pure quiz logic (answer normalization, weighted sampling) lives in `src/lib/recall.ts`, tested with node's built-in test runner (zero new deps).

**Tech Stack:** Vite 8 + React 19 + TS 7 (native tsc), Supabase JS, TanStack Query v5, React Router v7, Radix Themes, i18next, node:test via `--experimental-strip-types` (node 22).

## Global Constraints

- Named exports only — no default exports anywhere.
- Import order: external packages first, blank line, then `@/...` alphabetical. `pnpm lint` (biome) enforces it.
- German UI copy is intentional; every user-visible string goes through i18n with keys in BOTH `src/i18n/locales/de.ts` AND `src/i18n/locales/en.ts`.
- No new dependencies. Package manager is pnpm.
- No code comments except a non-obvious *why*.
- `verbatimModuleSyntax` is on: type-only imports must use `import type`.
- Migration must be idempotent and is applied manually: Supabase Studio → SQL Editor.
- Changelog rule: today is 2026-07-10 and `changelog.ts` already has a `0.18.0` block dated 2026-07-10 — same-day changes append to that block, `src/lib/appVersion.ts` is NOT bumped.
- `tests/` lives outside `src/` on purpose: it is not part of `tsconfig.app.json` or biome's `./src` scope; it is executed by `node --experimental-strip-types --test`, not tsc.
- Verification commands: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `node --experimental-strip-types --test tests/recall.test.ts`.

---

### Task 1: Migration + challenge seed + row types

**Files:**
- Create: `supabase/migrations/0011_recall.sql`
- Modify: `src/hooks/useChallenges.ts` (add `RECALL_CHALLENGE_ID` + 4th row)
- Modify: `src/types/db.ts:59-66` (`SavedWordRow`)

**Interfaces:**
- Consumes: nothing.
- Produces: `RECALL_CHALLENGE_ID = '00000000-0000-4000-8000-000000000004'` exported from `@/hooks/useChallenges`; `SavedWordRow` gains `times_correct: number` and `times_wrong: number`; challenge slug `'recall'` resolvable via `useChallengeBySlug('recall')` with `daily_goal_seconds: 10`.

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/0011_recall.sql`:

```sql
-- Deutsch MiMeo: add the "recall" challenge (typed active recall of saved words).
-- Run this in Supabase Studio → SQL Editor → New query (idempotent).
--
-- Goal: 10 correctly typed words per day. Progress reuses sessions.seconds as a
-- generic counter (1 unit = 1 correct answer), same as the vocab challenge.
--
-- times_correct / times_wrong back the weighted sampling: words answered wrong
-- more often are drawn more often (weight = (wrong+1)/(correct+1)).

alter table saved_words
  add column if not exists times_correct integer not null default 0;
alter table saved_words
  add column if not exists times_wrong integer not null default 0;

-- Pinned id matches RECALL_CHALLENGE_ID in src/hooks/useChallenges.ts.
-- activated_on = current_date so historical "day complete" counts stay intact
-- (days before today never require the new challenge).
insert into challenges (id, slug, title, description, daily_goal_seconds, sort_order, active, optional, activated_on) values
  ('00000000-0000-4000-8000-000000000004', 'recall', 'Abfrage 10 Wörter/Tag',
   'Tippe die deutsche Übersetzung deiner gemerkten Wörter — 10 richtige pro Tag.',
   10, 30, true, false, current_date)
on conflict (id) do update
  set slug               = excluded.slug,
      title              = excluded.title,
      description        = excluded.description,
      daily_goal_seconds = excluded.daily_goal_seconds,
      sort_order         = excluded.sort_order,
      active             = excluded.active,
      optional           = excluded.optional,
      activated_on       = excluded.activated_on;
```

- [ ] **Step 2: Apply the migration**

Run the full contents of `supabase/migrations/0011_recall.sql` in Supabase Studio → SQL Editor (ask the user to do this if you have no Supabase access — the `sessions.challenge_id` FK means the app cannot record recall progress until this row exists).

- [ ] **Step 3: Mirror the challenge in the frontend seed**

In `src/hooks/useChallenges.ts`, add below `LISTENING_CHALLENGE_ID` (line 5):

```ts
export const RECALL_CHALLENGE_ID = '00000000-0000-4000-8000-000000000004'
```

and append a 4th entry to the `CHALLENGES` array (after the `listening` entry):

```ts
  {
    id: RECALL_CHALLENGE_ID,
    slug: 'recall',
    title: 'Abfrage 10 Wörter/Tag',
    description: 'Tippe die deutsche Übersetzung deiner gemerkten Wörter — 10 richtige pro Tag.',
    daily_goal_seconds: 10,
    active: true,
    optional: false,
    sort_order: 30,
    created_at: '1970-01-01T00:00:00.000Z',
  },
```

- [ ] **Step 4: Extend SavedWordRow**

In `src/types/db.ts`, add two fields to `SavedWordRow` (after `note`):

```ts
export interface SavedWordRow {
  id: string
  user_id: UserId
  de: string
  en: string
  note: string | null
  times_correct: number
  times_wrong: number
  created_at: string
}
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0011_recall.sql src/hooks/useChallenges.ts src/types/db.ts
git commit -m "feat(recall): add recall challenge migration, seed, and row types"
```

---

### Task 2: Extract shuffle helpers to `src/lib/shuffle.ts`

**Files:**
- Create: `src/lib/shuffle.ts`
- Modify: `src/pages/VocabGamePage/VocabGamePage.tsx:60-76` (delete local `shuffle` + `weightedShuffle`, import instead)

**Interfaces:**
- Consumes: nothing.
- Produces: `shuffle<T>(arr: readonly T[]): T[]` and `weightedShuffle<T>(arr: readonly T[], weight: (item: T) => number): T[]` exported from `@/lib/shuffle` — Task 3's `recall.ts` imports `weightedShuffle` from here.

- [ ] **Step 1: Create `src/lib/shuffle.ts`**

Move the two functions verbatim from `VocabGamePage.tsx` (keep the existing comment):

```ts
export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Efraimidis-Spirakis weighted shuffle: key = -ln(U) / weight, sort ascending.
// Higher weight => smaller expected key => earlier position.
export function weightedShuffle<T>(arr: readonly T[], weight: (item: T) => number): T[] {
  return arr
    .map((item) => ({ item, key: -Math.log(Math.random()) / Math.max(weight(item), 1e-9) }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item)
}
```

- [ ] **Step 2: Update VocabGamePage**

In `src/pages/VocabGamePage/VocabGamePage.tsx`: delete the local `shuffle` (lines 60-67) and `weightedShuffle` (lines 69-76, including its comment) definitions, and add to the `@/` import block (alphabetical — after `@/lib/sounds`... note: `@/lib/shuffle` sorts BEFORE `@/lib/sounds`):

```ts
import { shuffle, weightedShuffle } from '@/lib/shuffle'
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shuffle.ts src/pages/VocabGamePage/VocabGamePage.tsx
git commit -m "refactor: extract shuffle helpers to src/lib/shuffle"
```

---

### Task 3: Recall quiz logic (TDD)

**Files:**
- Create: `tests/recall.test.ts`
- Create: `src/lib/recall.ts`

**Interfaces:**
- Consumes: `weightedShuffle` from `@/lib/shuffle` (Task 2) — imported as `./shuffle.ts` WITH extension (see Step 3 comment).
- Produces (all from `@/lib/recall`), used by Task 5's `RecallPage`:
  - `normalizeAnswer(s: string): string`
  - `isAnswerCorrect(stored: string, typed: string): boolean`
  - `recallWeight(w: RecallWordStats): number` where `RecallWordStats = { times_correct: number; times_wrong: number }`
  - `drawRecallBatch<T extends RecallWordStats & { id: string }>(pool: readonly T[], lastShownId: string | null): T[]`
  - `RECALL_BATCH_SIZE = 10`

- [ ] **Step 1: Write the failing tests**

Create `tests/recall.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { drawRecallBatch, isAnswerCorrect, normalizeAnswer, recallWeight } from '../src/lib/recall.ts'

test('normalizeAnswer folds case, whitespace, ß and umlauts', () => {
  assert.equal(normalizeAnswer('  Straße  '), 'strasse')
  assert.equal(normalizeAnswer('Bär'), 'baer')
  assert.equal(normalizeAnswer('nach   Hause'), 'nach hause')
  assert.equal(normalizeAnswer('ÜBUNG'), 'uebung')
})

test('isAnswerCorrect accepts exact and normalized matches', () => {
  assert.ok(isAnswerCorrect('Hund', 'Hund'))
  assert.ok(isAnswerCorrect('Hund', '  hund '))
  assert.ok(isAnswerCorrect('Straße', 'strasse'))
  assert.ok(isAnswerCorrect('Bär', 'baer'))
  assert.ok(isAnswerCorrect('nach Hause', 'nach  hause'))
})

test('isAnswerCorrect treats a leading article as optional', () => {
  assert.ok(isAnswerCorrect('der Hund', 'der Hund'))
  assert.ok(isAnswerCorrect('der Hund', 'hund'))
  assert.ok(!isAnswerCorrect('der Hund', 'die Hund'))
})

test('isAnswerCorrect rejects empty and wrong answers', () => {
  assert.ok(!isAnswerCorrect('Hund', ''))
  assert.ok(!isAnswerCorrect('Hund', '   '))
  assert.ok(!isAnswerCorrect('Hund', 'Katze'))
})

test('recallWeight floats wrong-heavy words up', () => {
  assert.equal(recallWeight({ times_correct: 0, times_wrong: 0 }), 1)
  assert.equal(recallWeight({ times_correct: 0, times_wrong: 3 }), 4)
  assert.ok(recallWeight({ times_correct: 9, times_wrong: 0 }) < 1)
})

function makeWord(id: string) {
  return { id, times_correct: 0, times_wrong: 0 }
}

test('drawRecallBatch caps at 10 and keeps items distinct', () => {
  const pool = Array.from({ length: 25 }, (_, i) => makeWord(`w${i}`))
  const batch = drawRecallBatch(pool, null)
  assert.equal(batch.length, 10)
  assert.equal(new Set(batch.map((w) => w.id)).size, 10)
})

test('drawRecallBatch returns the whole pool when smaller than 10', () => {
  const pool = [makeWord('a'), makeWord('b'), makeWord('c')]
  assert.equal(drawRecallBatch(pool, null).length, 3)
})

test('drawRecallBatch never leads with the last shown word (pool > 1)', () => {
  const pool = [makeWord('a'), makeWord('b')]
  for (let i = 0; i < 50; i++) {
    assert.notEqual(drawRecallBatch(pool, 'a')[0].id, 'a')
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-strip-types --test tests/recall.test.ts`
Expected: FAIL — `Cannot find module '.../src/lib/recall.ts'`.

- [ ] **Step 3: Implement `src/lib/recall.ts`**

```ts
// .ts extension so node --test (tests/recall.test.ts) can resolve it without a bundler.
import { weightedShuffle } from './shuffle.ts'

export const RECALL_BATCH_SIZE = 10

export interface RecallWordStats {
  times_correct: number
  times_wrong: number
}

// Laplace-smoothed wrong/correct ratio: new words start at 1, missed words float up.
export function recallWeight(w: RecallWordStats): number {
  return (w.times_wrong + 1) / (w.times_correct + 1)
}

export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replaceAll('ß', 'ss')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
}

const LEADING_ARTICLE = /^(?:der|die|das) /

export function isAnswerCorrect(stored: string, typed: string): boolean {
  const t = normalizeAnswer(typed)
  if (t.length === 0) return false
  const s = normalizeAnswer(stored)
  return t === s || (LEADING_ARTICLE.test(s) && t === s.replace(LEADING_ARTICLE, ''))
}

export function drawRecallBatch<T extends RecallWordStats & { id: string }>(
  pool: readonly T[],
  lastShownId: string | null,
): T[] {
  const shuffled = weightedShuffle(pool, recallWeight)
  if (shuffled.length > 1 && lastShownId !== null && shuffled[0].id === lastShownId) {
    ;[shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
  }
  return shuffled.slice(0, RECALL_BATCH_SIZE)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-strip-types --test tests/recall.test.ts`
Expected: all tests pass, `# fail 0`.

- [ ] **Step 5: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0 (`allowImportingTsExtensions` is already on in `tsconfig.app.json`; `tests/` is outside biome's `./src` scope).

- [ ] **Step 6: Commit**

```bash
git add tests/recall.test.ts src/lib/recall.ts
git commit -m "feat(recall): answer normalization and weighted batch sampling"
```

---

### Task 4: Word-stat bump mutation

**Files:**
- Modify: `src/hooks/useSavedWords.ts` (append new hook)

**Interfaces:**
- Consumes: `SavedWordRow` with `times_correct`/`times_wrong` (Task 1).
- Produces: `useBumpWordStat()` from `@/hooks/useSavedWords` — mutation taking `{ word: SavedWordRow; field: 'times_correct' | 'times_wrong' }`; optimistically bumps the `['saved-words', userId]` cache; failures only `console.error` (a lost stat nudge is acceptable, per spec).

- [ ] **Step 1: Add the hook**

Append to `src/hooks/useSavedWords.ts`:

```ts
export function useBumpWordStat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { word: SavedWordRow; field: 'times_correct' | 'times_wrong' }) => {
      const { word, field } = input
      const { error } = await supabase
        .from('saved_words')
        .update({ [field]: word[field] + 1 })
        .eq('id', word.id)
      if (error) throw error
      return input
    },
    onMutate: ({ word, field }) => {
      qc.setQueryData<SavedWordRow[]>(['saved-words', word.user_id], (rows) =>
        rows?.map((r) => (r.id === word.id ? { ...r, [field]: r[field] + 1 } : r)),
      )
    },
    onError: (error) => {
      console.error('Failed to update saved word stats', error)
    },
  })
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSavedWords.ts
git commit -m "feat(recall): word-stat bump mutation with optimistic cache update"
```

---

### Task 5: RecallPage + routing + page i18n + value formatting

**Files:**
- Modify: `src/routes/paths.ts` (add `recall` to `paths` and `routePatterns`)
- Modify: `src/routes/router.tsx` (lazy import + route)
- Modify: `src/pages/ChallengeListPage/ChallengeListPage.tsx:15-19` (`SLUG_TO_PATH`)
- Modify: `src/lib/format.ts` (recall branch)
- Modify: `src/i18n/locales/de.ts`, `src/i18n/locales/en.ts` (`challenges.recall`, top-level `recall` block)
- Create: `src/pages/RecallPage/RecallPage.tsx`
- Create: `src/pages/RecallPage/index.ts`

**Interfaces:**
- Consumes: `RECALL_CHALLENGE_ID`, `useChallengeBySlug('recall')` (Task 1); `drawRecallBatch`, `isAnswerCorrect` (Task 3); `useBumpWordStat` (Task 4); existing `useMatchSession({ userId, challengeId, enabled })` → `{ roundsInSession, incrementRound }`; existing `useSavedWords`, `useTodaySecondsForChallenge`, `ProgressBar`, `TopBar`, `MuteToggle`, `playGoalReached`, `playMatch`, `playWrong`, `speakGerman`.
- Produces: route `/u/:userId/recall` via `paths.recall(userId)`; `formatChallengeValue('recall', n, t)` → "n Wörter"; i18n namespaces `recall.*` and `challenges.recall.*`.

- [ ] **Step 1: Route plumbing**

`src/routes/paths.ts` — add to `paths` (after `listening`):

```ts
  recall: (userId: UserId) => `/u/${userId}/recall`,
```

and to `routePatterns` (after `listening`):

```ts
  recall: '/u/:userId/recall',
```

`src/routes/router.tsx` — add after the `ListeningPage` lazy import:

```ts
const RecallPage = lazy(() =>
  import('@/pages/RecallPage').then((m) => ({ default: m.RecallPage })),
)
```

and a route entry after the `listening` one:

```ts
      { path: routePatterns.recall, element: <RecallPage /> },
```

`src/pages/ChallengeListPage/ChallengeListPage.tsx` — extend `SLUG_TO_PATH`:

```ts
const SLUG_TO_PATH: Record<string, ((u: UserId) => string) | undefined> = {
  listen: (u) => paths.videoLibrary(u),
  vocab: (u) => paths.vocabGame(u),
  listening: (u) => paths.listening(u),
  recall: (u) => paths.recall(u),
}
```

- [ ] **Step 2: Value formatting**

`src/lib/format.ts` — add a case before `default`:

```ts
    case 'recall':
      return t('recall.words', { count: Math.max(0, value) })
```

- [ ] **Step 3: i18n — German**

In `src/i18n/locales/de.ts`:

Inside `challenges` (after the `listening` block):

```ts
    recall: {
      title: 'Abfrage 10 Wörter/Tag',
      description: 'Tippe die deutsche Übersetzung deiner gemerkten Wörter — 10 richtige pro Tag.',
    },
```

New top-level `recall` block (after the `listening` block at the end of the file):

```ts
  recall: {
    pageTitle: 'Abfrage',
    pageTitleEmoji: '✍️',
    today: 'Heute',
    sessionLabel: 'Diese Session',
    words_one: '{{count}} Wort',
    words_other: '{{count}} Wörter',
    promptLabel: 'Wie heißt das auf Deutsch?',
    inputPlaceholder: 'Deutsches Wort…',
    check: 'Prüfen',
    continue: 'Weiter',
    correct: 'Richtig!',
    wrongTitle: 'Nicht ganz.',
    solutionLabel: 'Richtige Antwort',
    goalReached: '🎉 Tagesziel erreicht! Mach ruhig weiter — alles zählt.',
    empty: {
      title: 'Noch keine gemerkten Wörter',
      hint: 'Merke dir zuerst Wörter im Vokabel-Spiel — tippe dort das Lesezeichen an deutschen Karten.',
      cta: 'Zum Vokabel-Spiel',
    },
  },
```

- [ ] **Step 4: i18n — English**

In `src/i18n/locales/en.ts`, mirror the same key structure at the same positions:

Inside `challenges`:

```ts
    recall: {
      title: 'Recall 10 words/day',
      description: 'Type the German translation of your saved words — 10 correct per day.',
    },
```

Top-level:

```ts
  recall: {
    pageTitle: 'Recall',
    pageTitleEmoji: '✍️',
    today: 'Today',
    sessionLabel: 'This session',
    words_one: '{{count}} word',
    words_other: '{{count}} words',
    promptLabel: 'What is it in German?',
    inputPlaceholder: 'German word…',
    check: 'Check',
    continue: 'Next',
    correct: 'Correct!',
    wrongTitle: 'Not quite.',
    solutionLabel: 'Correct answer',
    goalReached: '🎉 Daily goal reached! Keep going — everything counts.',
    empty: {
      title: 'No saved words yet',
      hint: 'Save words in the vocab game first — tap the bookmark on German tiles.',
      cta: 'To the vocab game',
    },
  },
```

- [ ] **Step 5: Create the page**

Create `src/pages/RecallPage/index.ts`:

```ts
export { RecallPage } from './RecallPage'
```

Create `src/pages/RecallPage/RecallPage.tsx` (no module.css — Radix components cover the layout):

```tsx
import { Badge, Box, Button, Card, Container, Flex, Text, TextField } from '@radix-ui/themes'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'

import { MuteToggle } from '@/components/MuteToggle'
import { ProgressBar } from '@/components/ProgressBar'
import { TopBar } from '@/components/TopBar'
import { RECALL_CHALLENGE_ID, useChallengeBySlug } from '@/hooks/useChallenges'
import { useMatchSession } from '@/hooks/useMatchSession'
import { useBumpWordStat, useSavedWords } from '@/hooks/useSavedWords'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { drawRecallBatch, isAnswerCorrect } from '@/lib/recall'
import { playGoalReached, playMatch, playWrong, speakGerman } from '@/lib/sounds'
import { paths } from '@/routes/paths'
import type { SavedWordRow, UserId } from '@/types/db'

const CORRECT_ADVANCE_MS = 900

export function RecallPage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const challenge = useChallengeBySlug('recall').data
  const todayQuery = useTodaySecondsForChallenge(userId as UserId | undefined, challenge?.id)
  // Snapshot the baseline once so flush()'s invalidate-then-refetch
  // doesn't compound with roundsInSession.
  const baselineRef = useRef<number | null>(null)
  useEffect(() => {
    if (baselineRef.current === null && todayQuery.data !== undefined) {
      baselineRef.current = todayQuery.data
    }
  }, [todayQuery.data])

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />
  if (!challenge) return <Navigate to={paths.challenges(user.id)} replace />

  return (
    <Container size="2" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.challenges(user.id) }}
        title={t('recall.pageTitle')}
        emoji={t('recall.pageTitleEmoji')}
        rightSlot={<MuteToggle />}
      />
      <Quiz
        userId={user.id}
        goal={challenge.daily_goal_seconds}
        baselineToday={baselineRef.current ?? 0}
      />
    </Container>
  )
}

interface QuizProps {
  userId: UserId
  goal: number
  baselineToday: number
}

function Quiz({ userId, goal, baselineToday }: QuizProps) {
  const { t } = useTranslation()
  const { roundsInSession, incrementRound } = useMatchSession({
    userId,
    challengeId: RECALL_CHALLENGE_ID,
    enabled: true,
  })
  const savedWordsQuery = useSavedWords(userId)
  const pool = savedWordsQuery.data ?? []
  const bumpStat = useBumpWordStat()

  const [queue, setQueue] = useState<SavedWordRow[]>([])
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<{ word: SavedWordRow; correct: boolean } | null>(null)
  const lastShownIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const todayTotal = baselineToday + roundsInSession
  const complete = todayTotal >= goal
  const current: SavedWordRow | undefined = queue[0]

  useEffect(() => {
    if (queue.length > 0 || feedback !== null || pool.length === 0) return
    setQueue(drawRecallBatch(pool, lastShownIdRef.current))
  }, [queue, feedback, pool])

  const advance = useCallback(() => {
    if (!feedback) return
    setQueue((q) => {
      const rest = q.slice(1)
      return feedback.correct ? rest : [...rest, feedback.word]
    })
    setFeedback(null)
    setInput('')
  }, [feedback])

  useEffect(() => {
    if (!feedback?.correct) return
    const timer = window.setTimeout(advance, CORRECT_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [feedback, advance])

  useEffect(() => {
    if (current && feedback === null) inputRef.current?.focus()
  }, [current, feedback])

  // Celebrate the daily goal exactly once, and only when this session caused
  // the crossing (not when the page loads with baselineToday already ≥ goal).
  const goalCelebratedRef = useRef(false)
  useEffect(() => {
    if (goalCelebratedRef.current) return
    if (roundsInSession === 0) return
    if (baselineToday >= goal) {
      goalCelebratedRef.current = true
      return
    }
    if (todayTotal < goal) return
    goalCelebratedRef.current = true
    playGoalReached()
  }, [roundsInSession, todayTotal, baselineToday, goal])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!current || feedback) return
    const correct = isAnswerCorrect(current.de, input)
    lastShownIdRef.current = current.id
    bumpStat.mutate({ word: current, field: correct ? 'times_correct' : 'times_wrong' })
    if (correct) {
      playMatch()
      void incrementRound()
    } else {
      playWrong()
    }
    speakGerman(current.de)
    setFeedback({ word: current, correct })
  }

  if (savedWordsQuery.isLoading) {
    return (
      <Card>
        <Text color="gray">{t('common.loading')}</Text>
      </Card>
    )
  }

  if (pool.length === 0) {
    return (
      <Card size="3" variant="surface">
        <Flex direction="column" gap="2" align="center" p="4">
          <Text size="3" weight="medium">
            {t('recall.empty.title')}
          </Text>
          <Text size="2" color="gray" align="center">
            {t('recall.empty.hint')}
          </Text>
          <Button asChild variant="soft" mt="2">
            <Link to={paths.vocabGame(userId)}>{t('recall.empty.cta')}</Link>
          </Button>
        </Flex>
      </Card>
    )
  }

  return (
    <Flex direction="column" gap="4">
      <Card size="2" variant="surface">
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center" gap="3">
            <Text size="2" color="gray">
              {t('recall.sessionLabel')}
            </Text>
            <Badge size="2" variant="soft" radius="full">
              {t('recall.words', { count: roundsInSession })}
            </Badge>
          </Flex>
          <Box>
            <Flex justify="between" align="baseline" mb="1">
              <Text size="2" weight="medium">
                {t('recall.today')}
              </Text>
              <Text size="2" color="gray" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t('recall.words', { count: todayTotal })} / {t('recall.words', { count: goal })}
              </Text>
            </Flex>
            <ProgressBar value={todayTotal} max={goal} complete={complete} />
            {complete ? (
              <Text size="2" color="green" mt="2" as="div">
                {t('recall.goalReached')}
              </Text>
            ) : null}
          </Box>
        </Flex>
      </Card>

      {current ? (
        <Card size="3" variant="surface">
          <Flex direction="column" gap="4">
            <Box>
              <Text size="2" color="gray" as="div" mb="1">
                {t('recall.promptLabel')}
              </Text>
              <Text size="6" weight="bold">
                {current.en}
              </Text>
            </Box>

            {feedback ? (
              feedback.correct ? (
                <Flex align="center" gap="2">
                  <Text size="3" color="green" weight="bold">
                    ✓ {t('recall.correct')}
                  </Text>
                  <Text size="3" weight="medium">
                    {feedback.word.de}
                  </Text>
                </Flex>
              ) : (
                <Flex direction="column" gap="2" align="start">
                  <Text size="3" color="red" weight="bold">
                    {t('recall.wrongTitle')}
                  </Text>
                  <Text size="2" color="gray">
                    {t('recall.solutionLabel')}
                  </Text>
                  <Text size="5" weight="bold">
                    {feedback.word.de}
                  </Text>
                  <Button onClick={advance} mt="1">
                    {t('recall.continue')}
                  </Button>
                </Flex>
              )
            ) : (
              <form onSubmit={onSubmit}>
                <Flex gap="2">
                  <Box flexGrow="1">
                    <TextField.Root
                      ref={inputRef}
                      size="3"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={t('recall.inputPlaceholder')}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </Box>
                  <Button size="3" type="submit" disabled={input.trim().length === 0}>
                    {t('recall.check')}
                  </Button>
                </Flex>
              </form>
            )}
          </Flex>
        </Card>
      ) : null}
    </Flex>
  )
}
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 7: Manual smoke test**

Run: `pnpm dev`, open `http://localhost:5173/u/mi/recall` and check:
- With saved words: prompt shows EN, typing correct German → green flash + counter +1 + auto-advance; wrong answer → solution shown + „Weiter" button → word reappears at end of batch.
- Umlaut tolerance: type `baer` for a stored `Bär`-type word (if present).
- Empty pool (use a user with no saved words, or check via the other user): empty-state card links to vocab game.
- ChallengeListPage `/u/mi` shows the 4th card with progress bar and links to the recall page.

- [ ] **Step 8: Commit**

```bash
git add src/routes/paths.ts src/routes/router.tsx src/pages/ChallengeListPage/ChallengeListPage.tsx src/lib/format.ts src/i18n/locales/de.ts src/i18n/locales/en.ts src/pages/RecallPage
git commit -m "feat(recall): typed recall quiz page with weighted word sampling"
```

---

### Task 6: HomePage integration (ComparisonPanel, ActivityLog, UserCard)

**Files:**
- Modify: `src/pages/HomePage/HomePage.tsx` (recall challenge prop + `CHALLENGE_EMOJI`)
- Modify: `src/pages/HomePage/ComparisonPanel.tsx` (new prop + category row)
- Modify: `src/pages/HomePage/ActivityLog.tsx` (recall branch)
- Modify: `src/i18n/locales/de.ts`, `src/i18n/locales/en.ts` (`comparison.todayRecall`, `activityLog.verbRecall`/`recallTitle`, `userCard.doing.recall`)

**Interfaces:**
- Consumes: `RECALL_CHALLENGE_ID`, `useChallengeBySlug('recall')` (Task 1); `formatChallengeValue('recall', …)` (Task 5); existing `useComparisonStats`.
- Produces: nothing consumed later — this is the last feature-visible wiring.

- [ ] **Step 1: i18n keys (both locales)**

`de.ts`:
- `userCard.doing` — add: `recall: 'Übt Abfrage',`
- `activityLog` — add: `verbRecall: 'tippte',` and `recallTitle: 'Abfrage',`
- `comparison` — add: `todayRecall: 'Heute getippt',`

`en.ts` (same positions):
- `userCard.doing` — add: `recall: 'Practicing recall',`
- `activityLog` — add: `verbRecall: 'typed',` and `recallTitle: 'Recall',`
- `comparison` — add: `todayRecall: 'Typed today',`

- [ ] **Step 2: HomePage wiring**

`src/pages/HomePage/HomePage.tsx`:
- Extend the emoji map: `const CHALLENGE_EMOJI: Record<string, string> = { listen: '🎧', vocab: '🧠', listening: '📻', recall: '✍️' }`
- Add next to the other challenge lookups: `const recallChallenge = useChallengeBySlug('recall')`
- Pass it through: `<ComparisonPanel listenChallenge={…} vocabChallenge={…} recallChallenge={recallChallenge.data ?? undefined} />`

- [ ] **Step 3: ComparisonPanel row**

`src/pages/HomePage/ComparisonPanel.tsx`:
- Add `recallChallenge: ChallengeRow | undefined` to `Props` and destructure it.
- Add `const recall = useComparisonStats(recallChallenge)` next to the others.
- Extend the loading/guard condition with `!recallChallenge || recall.isLoading || !recall.data`.
- Add `const rd = recall.data` and `const recallFmt = (n: number) => formatChallengeValue('recall', n, t)`.
- Insert into `categories` after the `today-listening-correct` entry:

```ts
    {
      id: 'today-recall',
      label: t('comparison.todayRecall'),
      icon: '✍️',
      miValue: rd.mi.todaySeconds,
      meoValue: rd.meo.todaySeconds,
      format: recallFmt,
    },
```

- [ ] **Step 4: ActivityLog branch**

`src/pages/HomePage/ActivityLog.tsx`:
- Import `RECALL_CHALLENGE_ID` alongside the other ids.
- Add `const isRecall = e.challenge_id === RECALL_CHALLENGE_ID` next to `isVocab`/`isListening`.
- Extend the three chains (mirror the existing nesting style):

```ts
          const verb = isVocab
            ? t('activityLog.verbVocab')
            : isListening
              ? t('activityLog.verbListening')
              : isRecall
                ? t('activityLog.verbRecall')
                : t('activityLog.verb')
          const title = isVocab
            ? t('activityLog.vocabTitle')
            : isListening
              ? t('activityLog.listeningTitle')
              : isRecall
                ? t('activityLog.recallTitle')
                : (e.video_title ?? t('activityLog.deletedVideo'))
          const value = isVocab
            ? formatChallengeValue('vocab', e.seconds, t)
            : isListening
              ? formatChallengeValue('listening', e.seconds, t)
              : isRecall
                ? formatChallengeValue('recall', e.seconds, t)
                : formatChallengeValue('listen', e.seconds, t)
```

- Update the link guard so recall rows are non-clickable:

```ts
          const linkTo =
            !isVocab && !isListening && !isRecall && e.video_id
              ? paths.player(e.user_id, e.video_id)
              : null
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 6: Manual smoke test**

`pnpm dev`, open `http://localhost:5173/`:
- Comparison table shows the ✍️ „Heute getippt" row with today's counts for Mi and Meo.
- After answering a few words on the recall page, the activity feed shows „Mi tippte Abfrage · n Wörter" (non-clickable).
- The user card „doing" badge shows „Übt Abfrage" while actively answering (within ~45 s of a flush).

- [ ] **Step 7: Commit**

```bash
git add src/pages/HomePage/HomePage.tsx src/pages/HomePage/ComparisonPanel.tsx src/pages/HomePage/ActivityLog.tsx src/i18n/locales/de.ts src/i18n/locales/en.ts
git commit -m "feat(recall): surface recall challenge on home page"
```

---

### Task 7: Changelog + final verification

**Files:**
- Modify: `src/lib/changelog.ts:14-24` (append entry to the existing `0.18.0` block)

**Interfaces:**
- Consumes: nothing. `src/lib/appVersion.ts` stays at `0.18.0` — same-day appends don't bump.

- [ ] **Step 1: Changelog entry**

In `src/lib/changelog.ts`, add to the `0.18.0` block's `entries` array (before the existing improvement entry):

```ts
      {
        type: 'feature',
        text: 'New Abfrage challenge: type your saved words from memory.',
      },
```

- [ ] **Step 2: Full verification**

Run:

```bash
node --experimental-strip-types --test tests/recall.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

Expected: tests `# fail 0`; typecheck, lint, and build all exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/changelog.ts
git commit -m "docs: changelog entry for recall challenge"
```
