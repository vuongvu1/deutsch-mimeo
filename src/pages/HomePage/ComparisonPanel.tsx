import { Box, Card, Flex, Table, Text } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { useComparisonStats } from '@/hooks/useStats'
import { formatMinutes } from '@/lib/dates'
import { formatChallengeValue } from '@/lib/format'
import type { ChallengeRow } from '@/types/db'

import styles from './ComparisonPanel.module.css'

interface Props {
  listenChallenge: ChallengeRow | undefined
  vocabChallenge: ChallengeRow | undefined
}

interface Category {
  id: string
  label: string
  icon: string
  miValue: number
  meoValue: number
  format: (n: number) => string
}

export function ComparisonPanel({ listenChallenge, vocabChallenge }: Props) {
  const { t } = useTranslation()
  const listen = useComparisonStats(listenChallenge)
  const vocab = useComparisonStats(vocabChallenge)

  if (
    !listenChallenge ||
    !vocabChallenge ||
    listen.isLoading ||
    vocab.isLoading ||
    !listen.data ||
    !vocab.data
  ) {
    return (
      <Card>
        <Text color="gray">{t('common.loadingStats')}</Text>
      </Card>
    )
  }

  const ld = listen.data
  const vd = vocab.data
  const vocabFmt = (n: number) => formatChallengeValue('vocab', n, t)

  const categories: Category[] = [
    {
      id: 'today-listen',
      label: t('comparison.todayListened'),
      icon: '💪',
      miValue: ld.mi.todaySeconds,
      meoValue: ld.meo.todaySeconds,
      format: formatMinutes,
    },
    {
      id: 'today-vocab',
      label: t('comparison.todayVocab'),
      icon: '🧠',
      miValue: vd.mi.todaySeconds,
      meoValue: vd.meo.todaySeconds,
      format: vocabFmt,
    },
    {
      id: 'week-listen',
      label: t('comparison.weekListened'),
      icon: '🔥',
      miValue: ld.mi.weekSeconds,
      meoValue: ld.meo.weekSeconds,
      format: formatMinutes,
    },
    {
      id: 'week-vocab',
      label: t('comparison.weekVocab'),
      icon: '📚',
      miValue: vd.mi.weekSeconds,
      meoValue: vd.meo.weekSeconds,
      format: vocabFmt,
    },
    {
      id: 'days-complete',
      label: t('comparison.daysComplete'),
      icon: '💯',
      miValue: ld.mi.daysCompleteAllChallenges,
      meoValue: ld.meo.daysCompleteAllChallenges,
      format: (n) => `${n}`,
    },
    {
      id: 'total-completed',
      label: t('comparison.totalCompleted'),
      icon: '🎯',
      miValue: ld.mi.totalChallengesCompleted,
      meoValue: ld.meo.totalChallengesCompleted,
      format: (n) => `${n}`,
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
