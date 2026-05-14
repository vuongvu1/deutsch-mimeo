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

export const VOCAB_PACKS: readonly VocabPack[] = [a1Basics, a1Food, a1Travel, a1Family, a2Work]

export const VOCAB_PACKS_BY_ID: Record<string, VocabPack | undefined> = Object.fromEntries(
  VOCAB_PACKS.map((p) => [p.id, p]),
)

export const DEFAULT_PACK_ID = a1Basics.id
