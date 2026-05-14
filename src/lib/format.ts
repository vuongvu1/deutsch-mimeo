import type { TFunction } from 'i18next'

import { formatMinutes } from './dates'

export function formatChallengeValue(slug: string, value: number, t: TFunction): string {
  switch (slug) {
    case 'listen':
      return formatMinutes(value)
    case 'vocab':
      return t('vocab.matches', { count: Math.max(0, value) })
    default:
      return `${value}`
  }
}
