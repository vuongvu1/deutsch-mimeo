import { Box, Card, Flex, Grid, Text } from '@radix-ui/themes'
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
    <Grid columns={{ initial: '1', sm: '2' }} gap={{ initial: '3', sm: '4' }}>
      {categories.map((cat) => (
        <CategoryCard key={cat.id} category={cat} />
      ))}
    </Grid>
  )
}

function CategoryCard({ category }: { category: Category }) {
  const { miValue, meoValue, format, label, icon } = category
  const miWins = miValue > meoValue
  const meoWins = meoValue > miValue
  const tie = miValue === meoValue && miValue > 0
  return (
    <Card>
      <Flex align="center" gap="2" mb="3">
        <Text size="5" aria-hidden>
          {icon}
        </Text>
        <Text size="2" weight="medium" color="gray">
          {label}
        </Text>
      </Flex>
      <Flex align="center" justify="between" gap="2">
        <UserSide
          name="Mi"
          emoji="🐷"
          value={format(miValue)}
          winning={miWins}
          variant="mi"
          tie={tie}
        />
        <Text size="1" color="gray" weight="bold" style={{ textTransform: 'uppercase' }}>
          vs
        </Text>
        <UserSide
          name="Meo"
          emoji="🐱"
          value={format(meoValue)}
          winning={meoWins}
          variant="meo"
          tie={tie}
        />
      </Flex>
    </Card>
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
    <Box
      flexGrow="1"
      className={styles.side}
      data-winning={winning}
      data-tie={tie}
      data-variant={variant}
    >
      <Flex direction="column" align="center" gap="1" py="2">
        <Box position="relative" style={{ fontSize: 32, lineHeight: 1 }} aria-hidden>
          {emoji}
          {winning ? (
            <Box
              position="absolute"
              style={{ top: -10, right: '50%', transform: 'translateX(28px)', fontSize: 18 }}
            >
              👑
            </Box>
          ) : null}
        </Box>
        <Text size="1" color="gray" className={styles.sideName}>
          {name}
        </Text>
        <Text size="3" weight="bold">
          {value}
        </Text>
      </Flex>
    </Box>
  )
}
