// Run: node --test worker/notify.test.ts
//
// Covers the two decisions that fail *silently* — a DST regression would
// otherwise surface only on the day the clocks change, and a bad completion
// check would just quietly stop nagging.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  berlinHour,
  berlinLocalDate,
  completedChallengeIds,
  incompleteUserIds,
  type Goal,
  type TotalRow,
} from './notify.ts'

test('berlinHour tracks DST', () => {
  // CEST (UTC+2): 19:00 UTC is the 21:00 nag slot.
  assert.equal(berlinHour(new Date('2026-08-09T19:00:00Z')), 21)
  assert.equal(berlinHour(new Date('2026-08-09T20:00:00Z')), 22)
  // CET (UTC+1): 20:00 UTC is the nag slot, 19:00 UTC must stay silent.
  assert.equal(berlinHour(new Date('2026-12-09T20:00:00Z')), 21)
  assert.equal(berlinHour(new Date('2026-12-09T19:00:00Z')), 20)
})

test('berlinLocalDate rolls over on Berlin midnight, not UTC midnight', () => {
  assert.equal(berlinLocalDate(new Date('2026-08-09T19:00:00Z')), '2026-08-09')
  // 23:30 UTC is already the next day in Berlin.
  assert.equal(berlinLocalDate(new Date('2026-08-09T23:30:00Z')), '2026-08-10')
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

test('incompleteUserIds nags a user with no rows at all', () => {
  const rows: TotalRow[] = [{ user_id: 'mi', challenge_id: 'listening', total_seconds: 1 }]
  assert.deepEqual(incompleteUserIds(GOALS, rows), ['meo'])
  assert.deepEqual(incompleteUserIds(GOALS, []), ['mi', 'meo'])
})

test('incompleteUserIds is empty when both are done', () => {
  const rows: TotalRow[] = [
    { user_id: 'mi', challenge_id: 'listening', total_seconds: 1 },
    { user_id: 'meo', challenge_id: 'vocab', total_seconds: 10 },
  ]
  assert.deepEqual(incompleteUserIds(GOALS, rows), [])
})
