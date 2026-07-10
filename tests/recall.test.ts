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
  assert.ok(!isAnswerCorrect('Hund', 'der Hund'))
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
