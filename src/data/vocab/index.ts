import { a1Basics } from './a1-basics'
import { a1Family } from './a1-family'
import { a1Food } from './a1-food'
import { a1Travel } from './a1-travel'
import { a2Work } from './a2-work'

export interface VocabWord {
  de: string
  en: string
}

export interface VocabPack {
  id: string
  words: VocabWord[]
}

const THEMED_PACKS: readonly VocabPack[] = [a1Basics, a1Food, a1Travel, a1Family, a2Work]

function buildAllPack(): VocabPack {
  const seen = new Set<string>()
  const words: VocabWord[] = []
  for (const pack of THEMED_PACKS) {
    for (const w of pack.words) {
      if (seen.has(w.de)) continue
      seen.add(w.de)
      words.push(w)
    }
  }
  return { id: 'all', words }
}

const allPack = buildAllPack()

export const VOCAB_PACKS: readonly VocabPack[] = [allPack, ...THEMED_PACKS]

export const VOCAB_PACKS_BY_ID: Record<string, VocabPack | undefined> = Object.fromEntries(
  VOCAB_PACKS.map((p) => [p.id, p]),
)

export const DEFAULT_PACK_ID = 'all'
