// Run: node --test worker/notify.test.ts
//
// Covers the decisions that fail *silently* — a DST regression would otherwise
// surface only on the day the clocks change, and a bad completion or overtake
// check would just quietly stop notifying.
//
// The copy builders pick at random, so they're checked for substitution and
// non-empty pools, not for exact text.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  berlinHour,
  berlinLocalDate,
  challengeLine,
  completedChallengeIds,
  dayLine,
  hasOvertaken,
  isNagHour,
  nagMessage,
  otherUserId,
  overtakeLine,
  userStatuses,
  type Goal,
  type TotalRow,
} from './notify.ts'

test('berlinHour tracks DST', () => {
  // CEST (UTC+2)
  assert.equal(berlinHour(new Date('2026-08-09T18:00:00Z')), 20)
  // CET (UTC+1): same wall-clock UTC is an hour earlier in Berlin
  assert.equal(berlinHour(new Date('2026-12-09T18:00:00Z')), 19)
})

test('berlinLocalDate rolls over on Berlin midnight, not UTC midnight', () => {
  assert.equal(berlinLocalDate(new Date('2026-08-09T19:00:00Z')), '2026-08-09')
  assert.equal(berlinLocalDate(new Date('2026-08-09T23:30:00Z')), '2026-08-10')
})

test('isNagHour fires every 2h from 10:00 to 22:00 Berlin', () => {
  // 08:00 UTC = 10:00 CEST -> nag slot
  assert.equal(isNagHour(new Date('2026-08-09T08:00:00Z')), true)
  // 09:00 UTC = 11:00 CEST -> odd hour, silent
  assert.equal(isNagHour(new Date('2026-08-09T09:00:00Z')), false)
  // 20:00 UTC = 22:00 CEST -> last slot
  assert.equal(isNagHour(new Date('2026-08-09T20:00:00Z')), true)
  // 22:00 UTC = 00:00 CEST -> past the last slot
  assert.equal(isNagHour(new Date('2026-08-09T22:00:00Z')), false)
  // 06:00 UTC = 08:00 CEST -> too early
  assert.equal(isNagHour(new Date('2026-08-09T06:00:00Z')), false)
  // Winter: 09:00 UTC = 10:00 CET -> still the first slot, no hardcoded offset
  assert.equal(isNagHour(new Date('2026-12-09T09:00:00Z')), true)
})

const GOALS: Goal[] = [
  { id: 'listen', title: 'Listen 30 min/day', daily_goal_seconds: 1800 },
  { id: 'vocab', title: 'Vokabeln 10 Runden/Tag', daily_goal_seconds: 10 },
  { id: 'listening', title: 'Hörverstehen 1×/Tag', daily_goal_seconds: 1 },
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

  // A tie is not ahead.
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

test('copy builders substitute their arguments and never return empty', () => {
  // Every pool entry must be reachable and well-formed, so sample repeatedly.
  for (let i = 0; i < 200; i++) {
    const c = challengeLine('mi', 'Vokabeln 10 Runden/Tag')
    assert.ok(c.includes('Mi') && c.includes('Vokabeln 10 Runden/Tag'), c)

    const d = dayLine('meo', 42)
    assert.ok(d.includes('Meo') && d.includes('42'), d)

    const o = overtakeLine('mi', 'Abfrage')
    assert.ok(o.includes('Mi') && o.includes('Meo') && o.includes('Abfrage'), o)
    assert.ok(!o.includes('undefined'), o)
  }
})

test('nagMessage shows the clock and both users', () => {
  const statuses = userStatuses(GOALS, [
    { user_id: 'meo', challenge_id: 'listening', total_seconds: 1 },
  ])
  for (let i = 0; i < 100; i++) {
    const msg = nagMessage(14, statuses)
    assert.ok(msg.startsWith('⏰ 14:00'), msg)
    assert.ok(msg.includes('Mi') && msg.includes('Meo'), msg)
    assert.ok(!msg.includes('undefined'), msg)
  }
  // Single-digit hours stay zero-padded.
  assert.ok(nagMessage(8, statuses).startsWith('⏰ 08:00'))
})
