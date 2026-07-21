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

export interface ExampleMatch {
  start: number
  length: number
}

// 1:1 char folding only (no ß→ss) so match offsets stay valid on the original.
function foldUmlauts(s: string): string {
  return s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
}

// Example sentences inflect words (gehen → gehe), so an exact substring match
// misses ~11% of the packs — all verbs. Fall back to the sentence token sharing
// the longest prefix with the term (≥ max(3, len-2) chars): regular conjugations
// still highlight, irregular forms (sein → bin) return null so the caller
// renders the sentence plain instead of underlining a wrong word.
export function findExampleMatch(de: string, example: string): ExampleMatch | null {
  const term = de.replace(LEADING_ARTICLE, '')
  const lowerTerm = term.toLowerCase()
  const exact = example.toLowerCase().indexOf(lowerTerm)
  if (exact !== -1) return { start: exact, length: term.length }
  if (lowerTerm.includes(' ')) return null
  const foldedTerm = foldUmlauts(lowerTerm)
  const needed = Math.max(3, lowerTerm.length - 2)
  let best: ExampleMatch | null = null
  let bestLcp = 0
  for (const m of example.matchAll(/\p{L}+/gu)) {
    const token = foldUmlauts(m[0].toLowerCase())
    let lcp = 0
    while (lcp < token.length && lcp < foldedTerm.length && token[lcp] === foldedTerm[lcp]) lcp++
    if (lcp >= needed && lcp > bestLcp) {
      best = { start: m.index, length: m[0].length }
      bestLcp = lcp
    }
  }
  return best
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
