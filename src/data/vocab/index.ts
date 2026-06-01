import { a1Animals } from './a1-animals'
import { a1Basics } from './a1-basics'
import { a1Clothing } from './a1-clothing'
import { a1Family } from './a1-family'
import { a1Food } from './a1-food'
import { a1House } from './a1-house'
import { a1Travel } from './a1-travel'
import { a2Freetime } from './a2-freetime'
import { a2Work } from './a2-work'
import { b1Environment } from './b1-environment'
import { b1Feelings } from './b1-feelings'
import { b1Health } from './b1-health'
import { b1Media } from './b1-media'
import { b1Society } from './b1-society'

export type VocabLevel = 'A1' | 'A2' | 'B1'

export interface VocabWord {
  de: string
  en: string
  level?: VocabLevel
}

export interface VocabPack {
  id: string
  level: VocabLevel
  words: VocabWord[]
}

export const LEVEL_TARGETS: Record<VocabLevel, number> = {
  A1: 0.1,
  A2: 0.25,
  B1: 0.65,
}

const THEMED_PACKS: readonly VocabPack[] = [
  a1Basics,
  a1Food,
  a1Travel,
  a1Family,
  a1Clothing,
  a1Animals,
  a1House,
  a2Work,
  a2Freetime,
  b1Society,
  b1Health,
  b1Environment,
  b1Feelings,
  b1Media,
]

function buildAllPack(): VocabPack {
  const seen = new Set<string>()
  const words: VocabWord[] = []
  for (const pack of THEMED_PACKS) {
    for (const w of pack.words) {
      if (seen.has(w.de)) continue
      seen.add(w.de)
      words.push({ ...w, level: pack.level })
    }
  }
  return { id: 'all', level: 'B1', words }
}

const allPack = buildAllPack()

export const SAVED_PACK_ID = 'saved'

// Stub: actual words are sourced from the user's saved-words query at render time.
const savedPackStub: VocabPack = { id: SAVED_PACK_ID, level: 'A1', words: [] }

export const VOCAB_PACKS: readonly VocabPack[] = [allPack, savedPackStub, ...THEMED_PACKS]

export const VOCAB_PACKS_BY_ID: Record<string, VocabPack | undefined> = Object.fromEntries(
  VOCAB_PACKS.map((p) => [p.id, p]),
)

export const DEFAULT_PACK_ID = 'all'
