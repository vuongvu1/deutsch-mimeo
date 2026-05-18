import { Box, Container, Flex, Heading, Table, Text } from '@radix-ui/themes'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'

import { Heatmap } from '@/components/Heatmap'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import {
  useComparisonStats,
  useDailyTotalsRange,
  type ComparisonStats,
} from '@/hooks/useStats'
import { daysAgoLocalDate, formatMinutes, formatSeconds, todayLocalDate } from '@/lib/dates'
import { formatChallengeValue } from '@/lib/format'
import { paths } from '@/routes/paths'

import styles from './ComparePage.module.css'

interface Category {
  id: string
  label: string
  miValue: number
  meoValue: number
  format: (n: number) => string
}

export function ComparePage() {
  const { t } = useTranslation()
  const listenChallenge = useChallengeBySlug('listen')
  const vocabChallenge = useChallengeBySlug('vocab')
  const listenComp = useComparisonStats(listenChallenge.data ?? undefined)
  const vocabComp = useComparisonStats(vocabChallenge.data ?? undefined)
  const miListenTotals = useDailyTotalsRange(
    'mi',
    listenChallenge.data?.id,
    daysAgoLocalDate(95),
    todayLocalDate(),
  )
  const meoListenTotals = useDailyTotalsRange(
    'meo',
    listenChallenge.data?.id,
    daysAgoLocalDate(95),
    todayLocalDate(),
  )
  const miVocabTotals = useDailyTotalsRange(
    'mi',
    vocabChallenge.data?.id,
    daysAgoLocalDate(95),
    todayLocalDate(),
  )
  const meoVocabTotals = useDailyTotalsRange(
    'meo',
    vocabChallenge.data?.id,
    daysAgoLocalDate(95),
    todayLocalDate(),
  )

  const loading = !listenComp.data || !vocabComp.data

  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar back={{ to: paths.home() }} title={t('compare.pageTitle')} />

      {loading ? (
        <Text color="gray">{t('common.loadingStats')}</Text>
      ) : (
        <>
          <Heading size="5" weight="bold" mb="3">
            {t('stats.listening')}
          </Heading>
          <Box mb="6">
            <ComparisonTable categories={listeningCategories(listenComp.data!, t)} />
          </Box>

          <Heading size="5" weight="bold" mb="3">
            {t('stats.vocab')}
          </Heading>
          <Box mb="6">
            <ComparisonTable categories={vocabCategories(vocabComp.data!, t)} />
          </Box>

          <Heading size="5" weight="bold" mb="3">
            {t('stats.daysHeading')}
          </Heading>
          <Box mb="6">
            <ComparisonTable categories={daysCategories(listenComp.data!, t)} />
          </Box>

          <Heading size="5" weight="bold" mb="3">
            {t('stats.activity')}
          </Heading>
          {listenChallenge.data ? (
            <HeatmapPair
              miTotals={miListenTotals.data ?? {}}
              meoTotals={meoListenTotals.data ?? {}}
              goalSeconds={listenChallenge.data.daily_goal_seconds}
            />
          ) : null}

          {vocabChallenge.data ? (
            <>
              <Heading size="5" weight="bold" mt="6" mb="3">
                {t('stats.vocabActivity')}
              </Heading>
              <HeatmapPair
                miTotals={miVocabTotals.data ?? {}}
                meoTotals={meoVocabTotals.data ?? {}}
                goalSeconds={vocabChallenge.data.daily_goal_seconds}
              />
            </>
          ) : null}
        </>
      )}
    </Container>
  )
}

function listeningCategories(data: ComparisonStats, t: TFunction): Category[] {
  return [
    {
      id: 'today',
      label: t('stats.today'),
      miValue: data.mi.todaySeconds,
      meoValue: data.meo.todaySeconds,
      format: formatMinutes,
    },
    {
      id: 'last7',
      label: t('stats.last7'),
      miValue: data.mi.weekSeconds,
      meoValue: data.meo.weekSeconds,
      format: formatMinutes,
    },
    {
      id: 'last30',
      label: t('stats.last30'),
      miValue: data.mi.monthSeconds,
      meoValue: data.meo.monthSeconds,
      format: formatMinutes,
    },
    {
      id: 'allTime',
      label: t('stats.allTime'),
      miValue: data.mi.allTimeSeconds,
      meoValue: data.meo.allTimeSeconds,
      format: formatMinutes,
    },
    {
      id: 'longest',
      label: t('stats.longest'),
      miValue: data.mi.longestSessionSeconds,
      meoValue: data.meo.longestSessionSeconds,
      format: formatSeconds,
    },
    {
      id: 'activeVideos',
      label: t('stats.activeVideos'),
      miValue: data.mi.activeVideoCount,
      meoValue: data.meo.activeVideoCount,
      format: (n) => `${n}`,
    },
    {
      id: 'watchedVideos',
      label: t('stats.watchedVideos'),
      miValue: data.mi.watchedVideoCount,
      meoValue: data.meo.watchedVideoCount,
      format: (n) => `${n}`,
    },
  ]
}

function vocabCategories(data: ComparisonStats, t: TFunction): Category[] {
  const fmt = (n: number) => formatChallengeValue('vocab', n, t)
  return [
    {
      id: 'today',
      label: t('stats.today'),
      miValue: data.mi.todaySeconds,
      meoValue: data.meo.todaySeconds,
      format: fmt,
    },
    {
      id: 'last7',
      label: t('stats.last7'),
      miValue: data.mi.weekSeconds,
      meoValue: data.meo.weekSeconds,
      format: fmt,
    },
    {
      id: 'last30',
      label: t('stats.last30'),
      miValue: data.mi.monthSeconds,
      meoValue: data.meo.monthSeconds,
      format: fmt,
    },
    {
      id: 'allTime',
      label: t('stats.allTime'),
      miValue: data.mi.allTimeSeconds,
      meoValue: data.meo.allTimeSeconds,
      format: fmt,
    },
    {
      id: 'bestRound',
      label: t('stats.bestRound'),
      miValue: data.mi.longestSessionSeconds,
      meoValue: data.meo.longestSessionSeconds,
      format: fmt,
    },
  ]
}

function daysCategories(data: ComparisonStats, t: TFunction): Category[] {
  return [
    {
      id: 'daysComplete',
      label: t('stats.daysComplete'),
      miValue: data.mi.daysCompleteAllChallenges,
      meoValue: data.meo.daysCompleteAllChallenges,
      format: (n) => `${n}`,
    },
    {
      id: 'activeDays',
      label: t('stats.activeDays'),
      miValue: data.mi.totalDistinctActiveDays,
      meoValue: data.meo.totalDistinctActiveDays,
      format: (n) => `${n}`,
    },
  ]
}

function ComparisonTable({ categories }: { categories: Category[] }) {
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
  const { miValue, meoValue, format, label } = category
  const miWins = miValue > meoValue
  const meoWins = meoValue > miValue
  return (
    <Table.Row>
      <Table.RowHeaderCell>
        <Text size="2" color="gray" weight="medium">
          {label}
        </Text>
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

function HeatmapPair({
  miTotals,
  meoTotals,
  goalSeconds,
}: {
  miTotals: Record<string, number>
  meoTotals: Record<string, number>
  goalSeconds: number
}) {
  return (
    <Flex direction="column" gap="4">
      <div className={styles.heatmapBlock}>
        <span className={styles.heatmapLabel} data-variant="mi">
          🐷 Mi
        </span>
        <Heatmap totals={miTotals} goalSeconds={goalSeconds} />
      </div>
      <div className={styles.heatmapBlock}>
        <span className={styles.heatmapLabel} data-variant="meo">
          🐱 Meo
        </span>
        <Heatmap totals={meoTotals} goalSeconds={goalSeconds} />
      </div>
    </Flex>
  )
}

