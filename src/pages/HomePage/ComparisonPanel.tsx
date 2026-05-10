import { Box, Card, Flex, Text, Tooltip } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { useComparisonStats } from '@/hooks/useStats'
import { formatMinutes, formatSeconds } from '@/lib/dates'
import type { ChallengeRow } from '@/types/db'

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
  const { t } = useTranslation()
  const { data, isLoading } = useComparisonStats(challenge)

  if (!challenge || isLoading || !data) {
    return (
      <Card>
        <Text color="gray">{t('common.loadingStats')}</Text>
      </Card>
    )
  }

  const categories: Category[] = [
    {
      id: 'today',
      label: t('comparison.todayListened'),
      icon: '💪',
      miValue: data.mi.todaySeconds,
      meoValue: data.meo.todaySeconds,
      format: formatMinutes,
    },
    {
      id: 'week',
      label: t('comparison.weekTotal'),
      icon: '🔥',
      miValue: data.mi.weekSeconds,
      meoValue: data.meo.weekSeconds,
      format: formatMinutes,
    },
    {
      id: 'days-complete',
      label: t('comparison.daysComplete'),
      icon: '💯',
      miValue: data.mi.daysCompleteAllChallenges,
      meoValue: data.meo.daysCompleteAllChallenges,
      format: (n) => `${n}`,
    },
    {
      id: 'longest',
      label: t('comparison.longest'),
      icon: '🚀',
      miValue: data.mi.longestSessionSeconds,
      meoValue: data.meo.longestSessionSeconds,
      format: formatSeconds,
    },
  ]

  return (
    <Card>
      <Flex direction="column">
        {categories.map((cat, idx) => (
          <CategoryRow key={cat.id} category={cat} isLast={idx === categories.length - 1} />
        ))}
      </Flex>
    </Card>
  )
}

function CategoryRow({ category, isLast }: { category: Category; isLast: boolean }) {
  const { miValue, meoValue, format, icon, label } = category
  const miWins = miValue > meoValue
  const meoWins = meoValue > miValue
  return (
    <Flex
      align="center"
      gap="3"
      py="3"
      className={styles.row}
      data-last={isLast}
    >
      <Tooltip content={label}>
        <Box className={styles.icon} aria-label={label}>
          {icon}
        </Box>
      </Tooltip>
      <Flex flexGrow="1" align="center" justify="between" gap="3">
        <UserSide emoji="🐷" value={format(miValue)} winning={miWins} />
        <UserSide emoji="🐱" value={format(meoValue)} winning={meoWins} align="right" />
      </Flex>
    </Flex>
  )
}

function UserSide({
  emoji,
  value,
  winning,
  align = 'left',
}: {
  emoji: string
  value: string
  winning: boolean
  align?: 'left' | 'right'
}) {
  return (
    <Flex
      align="center"
      gap="2"
      justify={align === 'right' ? 'end' : 'start'}
      flexGrow="1"
      className={styles.side}
      data-winning={winning}
    >
      {align === 'left' ? (
        <>
          <Text size="4" aria-hidden>
            {emoji}
          </Text>
          <Text size="3" weight="bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Text>
          {winning ? <span aria-hidden>👑</span> : null}
        </>
      ) : (
        <>
          {winning ? <span aria-hidden>👑</span> : null}
          <Text size="3" weight="bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Text>
          <Text size="4" aria-hidden>
            {emoji}
          </Text>
        </>
      )}
    </Flex>
  )
}
