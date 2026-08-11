import { ArrowRightIcon } from '@radix-ui/react-icons'
import { Box, Button, Card, Flex, Table, Text } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useComparisonStats } from '@/hooks/useStats'
import { paths } from '@/routes/paths'
import type { ChallengeRow } from '@/types/db'

import styles from './ComparisonPanel.module.css'

interface Props {
  listenChallenge: ChallengeRow | undefined
}

interface Category {
  id: string
  label: string
  icon: string
  miValue: number
  meoValue: number
  format: (n: number) => string
}

export function ComparisonPanel({ listenChallenge }: Props) {
  const { t } = useTranslation()
  const listen = useComparisonStats(listenChallenge)

  if (!listenChallenge || listen.isLoading || !listen.data) {
    return (
      <Card>
        <Text color="gray">{t('common.loadingStats')}</Text>
      </Card>
    )
  }

  const ld = listen.data

  const categories: Category[] = [
    {
      id: 'days-complete',
      label: t('comparison.daysDone'),
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
    <Flex direction="column" gap="3">
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
      <Flex justify="end">
        <Button asChild variant="soft" size="2">
          <Link to={paths.compare()}>
            {t('comparison.fullStatsCta')}
            <ArrowRightIcon />
          </Link>
        </Button>
      </Flex>
    </Flex>
  )
}

function CategoryRow({ category }: { category: Category }) {
  const { miValue, meoValue, format, icon, label } = category
  const tied = miValue === meoValue && miValue > 0
  const miWins = miValue > meoValue || tied
  const meoWins = meoValue > miValue || tied
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
