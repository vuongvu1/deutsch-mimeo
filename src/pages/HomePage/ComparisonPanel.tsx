import { Box, Card, Flex, Table, Text } from '@radix-ui/themes'
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
    <Table.Root variant="surface" size="2" className={styles.table}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell />
          <Table.ColumnHeaderCell align="center" className={styles.userCol} data-variant="mi">
            <Flex align="center" gap="1" justify="center">
              <Text size="4" aria-hidden>
                🐷
              </Text>
              <Text size="2" weight="bold">
                Mi
              </Text>
            </Flex>
          </Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell align="center" className={styles.userCol} data-variant="meo">
            <Flex align="center" gap="1" justify="center">
              <Text size="4" aria-hidden>
                🐱
              </Text>
              <Text size="2" weight="bold">
                Meo
              </Text>
            </Flex>
          </Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {categories.map((cat) => (
          <CategoryRow key={cat.id} category={cat} />
        ))}
      </Table.Body>
    </Table.Root>
  )
}

function CategoryRow({ category }: { category: Category }) {
  const { miValue, meoValue, format, icon, label } = category
  const miWins = miValue > meoValue
  const meoWins = meoValue > miValue
  return (
    <Table.Row>
      <Table.RowHeaderCell>
        <Flex align="center" gap="2">
          <Text size="4" aria-hidden style={{ lineHeight: 1 }}>
            {icon}
          </Text>
          <Text size="2" color="gray" weight="medium">
            {label}
          </Text>
        </Flex>
      </Table.RowHeaderCell>
      <Table.Cell align="center" className={styles.valueCell} data-winning={miWins}>
        <ValueWithCrown value={format(miValue)} winning={miWins} />
      </Table.Cell>
      <Table.Cell align="center" className={styles.valueCell} data-winning={meoWins}>
        <ValueWithCrown value={format(meoValue)} winning={meoWins} />
      </Table.Cell>
    </Table.Row>
  )
}

function ValueWithCrown({ value, winning }: { value: string; winning: boolean }) {
  return (
    <Flex align="center" justify="center" gap="1">
      <Text
        size="3"
        weight={winning ? 'bold' : 'regular'}
        color={winning ? 'amber' : undefined}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Text>
      {winning ? (
        <Box aria-hidden style={{ fontSize: 14 }}>
          👑
        </Box>
      ) : null}
    </Flex>
  )
}
