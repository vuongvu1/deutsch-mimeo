// Run: node --test worker/notify.test.ts
//
// Covers the decisions that fail *silently* — a DST regression would otherwise
// surface only on the day the clocks change, a bad completion or overtake check
// would quietly stop notifying, and a mistyped placeholder would ship raw
// "{who}" text to the group.
//
// Copy is picked at random, so the assertions are structural (English only,
// fully substituted) rather than exact strings.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  almostLine,
  berlinHour,
  berlinLocalDate,
  message,
  challengeLine,
  completedChallengeIds,
  dayLine,
  dayWinner,
  hasOvertaken,
  isAlmostThere,
  isNagHour,
  isRecapHour,
  nagMessage,
  otherUserId,
  overtakeLine,
  perfectLine,
  progressRatio,
  recapMessage,
  rivalDoneLine,
  titleFor,
  userStatuses,
  type Goal,
  type TotalRow,
} from './notify.ts'

test('berlinHour tracks DST', () => {
  // CEST (UTC+2)
  assert.equal(berlinHour(new Date('2026-08-09T18:00:00Z')), 20)
  // CET (UTC+1): same UTC instant is an hour earlier in Berlin
  assert.equal(berlinHour(new Date('2026-12-09T18:00:00Z')), 19)
})

test('berlinLocalDate rolls over on Berlin midnight, not UTC midnight', () => {
  assert.equal(berlinLocalDate(new Date('2026-08-09T19:00:00Z')), '2026-08-09')
  assert.equal(berlinLocalDate(new Date('2026-08-09T23:30:00Z')), '2026-08-10')
})

test('isNagHour fires only at 12:00 and 18:00 Berlin', () => {
  assert.equal(isNagHour(new Date('2026-08-09T10:00:00Z')), true) // 12:00 CEST
  assert.equal(isNagHour(new Date('2026-08-09T16:00:00Z')), true) // 18:00 CEST
  assert.equal(isNagHour(new Date('2026-08-09T08:00:00Z')), false) // 10:00 CEST, dropped slot
  assert.equal(isNagHour(new Date('2026-08-09T18:00:00Z')), false) // 20:00 CEST, dropped slot
  assert.equal(isNagHour(new Date('2026-08-09T22:00:00Z')), false) // 00:00 CEST
  // Winter: same wall-clock hours, one UTC hour later. No offset is hardcoded.
  assert.equal(isNagHour(new Date('2026-12-09T11:00:00Z')), true) // 12:00 CET
  assert.equal(isNagHour(new Date('2026-12-09T17:00:00Z')), true) // 18:00 CET
  assert.equal(isNagHour(new Date('2026-12-09T10:00:00Z')), false) // 11:00 CET
})

test('22:00 Berlin is the recap slot, not a nag slot', () => {
  const tenPmSummer = new Date('2026-08-09T20:00:00Z')
  assert.equal(isRecapHour(tenPmSummer), true)
  assert.equal(isNagHour(tenPmSummer), false)
  // Winter: 21:00 UTC is 22:00 CET
  assert.equal(isRecapHour(new Date('2026-12-09T21:00:00Z')), true)
  assert.equal(isRecapHour(new Date('2026-12-09T20:00:00Z')), false)
})

test('progressRatio and isAlmostThere gate on 70%', () => {
  const rows: TotalRow[] = [{ user_id: 'mi', challenge_id: 'vocab', total_seconds: 7 }]
  assert.equal(progressRatio(GOALS, rows, 'vocab', 'mi'), 0.7)
  assert.equal(isAlmostThere(GOALS, rows, 'vocab', 'mi'), true)

  const under: TotalRow[] = [{ user_id: 'mi', challenge_id: 'vocab', total_seconds: 6 }]
  assert.equal(isAlmostThere(GOALS, under, 'vocab', 'mi'), false)

  // Complete is not "almost" — that's the challenge event's job.
  const doneRows: TotalRow[] = [{ user_id: 'mi', challenge_id: 'vocab', total_seconds: 10 }]
  assert.equal(isAlmostThere(GOALS, doneRows, 'vocab', 'mi'), false)

  // Unknown challenge must not divide by zero or throw.
  assert.equal(progressRatio(GOALS, rows, 'nope', 'mi'), 0)
  assert.equal(isAlmostThere(GOALS, [], 'vocab', 'mi'), false)
})

test('dayWinner compares cleared counts and reports draws', () => {
  const mk = (miDone: number, meoDone: number) => [
    { userId: 'mi', done: miDone, total: 3, complete: miDone > 0 },
    { userId: 'meo', done: meoDone, total: 3, complete: meoDone > 0 },
  ]
  assert.equal(dayWinner(mk(2, 1)), 'mi')
  assert.equal(dayWinner(mk(1, 2)), 'meo')
  assert.equal(dayWinner(mk(2, 2)), null)
  // 0-0 is a draw, not a win for whoever is listed first.
  assert.equal(dayWinner(mk(0, 0)), null)
})

const GOALS: Goal[] = [
  { id: 'listen', slug: 'listen', title: 'Listen 30 min/day', daily_goal_seconds: 1800 },
  { id: 'vocab', slug: 'vocab', title: 'Vokabeln 10 Runden/Tag', daily_goal_seconds: 10 },
  { id: 'listening', slug: 'listening', title: 'Hörverstehen 1×/Tag', daily_goal_seconds: 1 },
]

test('completedChallengeIds compares totals against goals per user', () => {
  const rows: TotalRow[] = [
    { user_id: 'mi', challenge_id: 'listen', total_seconds: 1800 },
    { user_id: 'mi', challenge_id: 'vocab', total_seconds: 9 },
    { user_id: 'meo', challenge_id: 'listen', total_seconds: 60 },
  ]
  assert.deepEqual([...completedChallengeIds(GOALS, rows, 'mi')], ['listen'])
  assert.deepEqual([...completedChallengeIds(GOALS, rows, 'meo')], [])
})

test('completedChallengeIds sums multiple sessions for the same challenge', () => {
  const rows: TotalRow[] = [
    { user_id: 'mi', challenge_id: 'vocab', total_seconds: 6 },
    { user_id: 'mi', challenge_id: 'vocab', total_seconds: 4 },
  ]
  assert.ok(completedChallengeIds(GOALS, rows, 'mi').has('vocab'))
})

test('userStatuses reports both users, including one with no rows', () => {
  const rows: TotalRow[] = [{ user_id: 'meo', challenge_id: 'listening', total_seconds: 1 }]
  assert.deepEqual(userStatuses(GOALS, rows), [
    { userId: 'mi', done: 0, total: 3, complete: false },
    { userId: 'meo', done: 1, total: 3, complete: true },
  ])
})

test('userStatuses marks nobody complete on an empty day', () => {
  assert.deepEqual(
    userStatuses(GOALS, []).map((s) => s.complete),
    [false, false],
  )
})

test('otherUserId flips', () => {
  assert.equal(otherUserId('mi'), 'meo')
  assert.equal(otherUserId('meo'), 'mi')
})

test('hasOvertaken needs a rival with a nonzero total', () => {
  // 1-0 at the start of the day is not an overtake worth announcing.
  const oneNil: TotalRow[] = [{ user_id: 'mi', challenge_id: 'vocab', total_seconds: 1 }]
  assert.equal(hasOvertaken(oneNil, 'vocab', 'mi'), false)

  const ahead: TotalRow[] = [
    { user_id: 'mi', challenge_id: 'vocab', total_seconds: 5 },
    { user_id: 'meo', challenge_id: 'vocab', total_seconds: 4 },
  ]
  assert.equal(hasOvertaken(ahead, 'vocab', 'mi'), true)
  assert.equal(hasOvertaken(ahead, 'vocab', 'meo'), false)

  const tied: TotalRow[] = [
    { user_id: 'mi', challenge_id: 'vocab', total_seconds: 4 },
    { user_id: 'meo', challenge_id: 'vocab', total_seconds: 4 },
  ]
  assert.equal(hasOvertaken(tied, 'vocab', 'mi'), false)

  // Other challenges must not leak into the comparison.
  const otherChallenge: TotalRow[] = [
    { user_id: 'mi', challenge_id: 'vocab', total_seconds: 1 },
    { user_id: 'meo', challenge_id: 'listen', total_seconds: 900 },
  ]
  assert.equal(hasOvertaken(otherChallenge, 'vocab', 'mi'), false)
})

test('titleFor keeps the German title and adds an English one', () => {
  assert.deepEqual(titleFor(GOALS[1]), {
    de: 'Vokabeln 10 Runden/Tag',
    en: 'Vocab 10 rounds',
  })
  assert.deepEqual(titleFor(undefined), { de: 'eine Challenge', en: 'a challenge' })
  // An unknown slug falls back to the German title rather than going blank.
  const future: Goal = {
    id: 'x',
    slug: 'schreiben',
    title: 'Schreiben 5 Sätze',
    daily_goal_seconds: 5,
  }
  assert.deepEqual(titleFor(future), { de: 'Schreiben 5 Sätze', en: 'Schreiben 5 Sätze' })
})

test('message sends the English half only', () => {
  const out = message([
    { de: 'eins', en: 'one' },
    { de: 'zwei', en: 'two' },
  ])
  assert.equal(out, 'one\ntwo')
})

/** Every line of a rendered message. */
function lines(rendered: string): string[] {
  return rendered.split('\n')
}

test('every message is English, fully substituted, and free of German', () => {
  const statuses = userStatuses(GOALS, [
    { user_id: 'meo', challenge_id: 'listening', total_seconds: 1 },
  ])
  const vocab = titleFor(GOALS[1])

  const drawStatuses = userStatuses(GOALS, [])

  for (let i = 0; i < 300; i++) {
    const messages = [
      message([challengeLine('mi', vocab), dayLine('mi', 7)]),
      message([overtakeLine('meo', vocab)]),
      message([almostLine('mi', vocab, 0.8)]),
      message([perfectLine('meo')]),
      message([rivalDoneLine('mi')]),
      nagMessage(18, statuses),
      recapMessage(statuses),
      recapMessage(drawStatuses),
    ]
    for (const msg of messages) {
      assert.ok(!msg.includes('{'), `unsubstituted placeholder in:\n${msg}`)
      assert.ok(!msg.includes('undefined'), msg)
      // A German title leaking through means titleFor lost its translation.
      assert.ok(!msg.includes('Vokabeln'), msg)
      for (const line of lines(msg)) assert.ok(line.trim().length > 0, msg)
    }
  }
})

test('the challenge title is the English one', () => {
  const vocab = titleFor(GOALS[1])
  for (let i = 0; i < 200; i++) {
    const msg = message([challengeLine('mi', vocab)])
    assert.ok(msg.includes('Vocab 10 rounds'), msg)
    assert.ok(!msg.includes('Vokabeln 10 Runden/Tag'), msg)
  }
})

test('almostLine reports a whole-number percentage', () => {
  const vocab = titleFor(GOALS[1])
  for (let i = 0; i < 100; i++) {
    const msg = message([almostLine('mi', vocab, 0.7)])
    assert.ok(msg.includes('70'), msg)
    // No 69.99999% artefacts — digits must never be followed by a decimal point.
    assert.ok(!/\d\.\d/.test(msg), msg)
  }
  const odd = message([almostLine('mi', vocab, 0.8333)])
  assert.ok(odd.includes('83'), odd)
})

test('recapMessage names a winner or calls a draw', () => {
  const miAhead = [
    { userId: 'mi', done: 2, total: 3, complete: true },
    { userId: 'meo', done: 1, total: 3, complete: true },
  ]
  for (let i = 0; i < 100; i++) {
    const won = recapMessage(miAhead)
    assert.ok(won.includes('Mi'), won)
    const drawn = recapMessage(userStatuses(GOALS, []))
    // A draw must not accidentally crown anyone via a leftover {who}.
    assert.ok(!drawn.includes('{'), drawn)
  }
})

test('nagMessage shows the clock and both users', () => {
  const statuses = userStatuses(GOALS, [
    { user_id: 'meo', challenge_id: 'listening', total_seconds: 1 },
  ])
  for (let i = 0; i < 100; i++) {
    const msg = nagMessage(14, statuses)
    assert.ok(lines(msg)[0].startsWith('⏰ 14:00'), msg)
    assert.ok(msg.includes('Mi') && msg.includes('Meo'), msg)
  }
  // Single-digit hours stay zero-padded.
  assert.ok(nagMessage(8, statuses).startsWith('⏰ 08:00'))
})
