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
