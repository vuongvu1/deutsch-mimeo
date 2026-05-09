import { formatMinutes, formatSeconds } from '@/lib/dates'
import type { ChallengeRow } from '@/types/db'
import { useComparisonStats } from '@/hooks/useStats'

import styles from './ComparisonPanel.module.css'

interface Props {
  challenge: ChallengeRow | undefined
}

interface Category {
  id: string
  label: string
  icon: string
  miValue: number
  meoValue: number
  format: (n: number) => string
}

export function ComparisonPanel({ challenge }: Props) {
  const { data, isLoading } = useComparisonStats(challenge)

  if (!challenge || isLoading || !data) {
    return <div className="card muted">Lade Statistiken…</div>
  }

  const categories: Category[] = [
    {
      id: 'today',
      label: 'Heute gehört',
      icon: '💪',
      miValue: data.mi.todaySeconds,
      meoValue: data.meo.todaySeconds,
      format: formatMinutes,
    },
    {
      id: 'week',
      label: '7-Tage Total',
      icon: '🔥',
      miValue: data.mi.weekSeconds,
      meoValue: data.meo.weekSeconds,
      format: formatMinutes,
    },
    {
      id: 'days-complete',
      label: 'Tage komplett',
      icon: '💯',
      miValue: data.mi.daysCompleteAllChallenges,
      meoValue: data.meo.daysCompleteAllChallenges,
      format: (n) => `${n}`,
    },
    {
      id: 'longest',
      label: 'Längste Session',
      icon: '🚀',
      miValue: data.mi.longestSessionSeconds,
      meoValue: data.meo.longestSessionSeconds,
      format: formatSeconds,
    },
  ]

  return (
    <div className={styles.grid}>
      {categories.map((cat) => (
        <CategoryCard key={cat.id} category={cat} />
      ))}
    </div>
  )
}

function CategoryCard({ category }: { category: Category }) {
  const { miValue, meoValue, format, label, icon } = category
  const miWins = miValue > meoValue
  const meoWins = meoValue > miValue
  const tie = miValue === meoValue && miValue > 0
  return (
    <div className={styles.cat}>
      <div className={styles.catHeader}>
        <span className={styles.catIcon}>{icon}</span>
        <span className={styles.catLabel}>{label}</span>
      </div>
      <div className={styles.row}>
        <UserSide
          name="Mi"
          emoji="🐷"
          value={format(miValue)}
          winning={miWins}
          variant="mi"
          tie={tie}
        />
        <span className={styles.vs}>vs</span>
        <UserSide
          name="Meo"
          emoji="🐱"
          value={format(meoValue)}
          winning={meoWins}
          variant="meo"
          tie={tie}
        />
      </div>
    </div>
  )
}

function UserSide({
  name,
  emoji,
  value,
  winning,
  tie,
  variant,
}: {
  name: string
  emoji: string
  value: string
  winning: boolean
  tie: boolean
  variant: 'mi' | 'meo'
}) {
  return (
    <div className={styles.side} data-winning={winning} data-tie={tie} data-variant={variant}>
      <div className={styles.sideEmoji}>
        {emoji}
        {winning ? <span className={styles.crown}>👑</span> : null}
      </div>
      <div className={styles.sideName}>{name}</div>
      <div className={styles.sideValue}>{value}</div>
    </div>
  )
}
