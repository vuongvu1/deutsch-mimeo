import { Card, Container, Grid, Heading, Text } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { Heatmap } from '@/components/Heatmap'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useDailyTotalsRange, useUserStats } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { daysAgoLocalDate, formatMinutes, formatSeconds, todayLocalDate } from '@/lib/dates'
import { formatChallengeValue } from '@/lib/format'
import { paths } from '@/routes/paths'
import type { UserId } from '@/types/db'

export function StatsPage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const listenChallenge = useChallengeBySlug('listen')
  const vocabChallenge = useChallengeBySlug('vocab')
  const listenStatsQuery = useUserStats(
    userId as UserId | undefined,
    listenChallenge.data ?? undefined,
  )
  const vocabStatsQuery = useUserStats(
    userId as UserId | undefined,
    vocabChallenge.data ?? undefined,
  )
  const listenTotalsQuery = useDailyTotalsRange(
    userId as UserId | undefined,
    listenChallenge.data?.id,
    daysAgoLocalDate(95),
    todayLocalDate(),
  )
  const vocabTotalsQuery = useDailyTotalsRange(
    userId as UserId | undefined,
    vocabChallenge.data?.id,
    daysAgoLocalDate(95),
    todayLocalDate(),
  )

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />

  const listenStats = listenStatsQuery.data
  const vocabStats = vocabStatsQuery.data

  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.challenges(user.id) }}
        title={t('stats.pageTitle')}
        emoji={user.emoji}
      />

      {!listenStats ? (
        <Text color="gray">{t('common.loadingStats')}</Text>
      ) : (
        <>
          <Heading size="5" weight="bold" mb="3">
            {t('stats.listening')}
          </Heading>
          <Grid columns={{ initial: '2', sm: '3' }} gap="3" mb="6">
            <Stat label={t('stats.today')} value={formatMinutes(listenStats.todaySeconds)} accent={listenStats.goalCompleteToday} />
            <Stat label={t('stats.last7')} value={formatMinutes(listenStats.weekSeconds)} />
            <Stat label={t('stats.last30')} value={formatMinutes(listenStats.monthSeconds)} />
            <Stat label={t('stats.allTime')} value={formatMinutes(listenStats.allTimeSeconds)} />
            <Stat label={t('stats.longest')} value={formatSeconds(listenStats.longestSessionSeconds)} />
            <Stat label={t('stats.activeVideos')} value={`${listenStats.activeVideoCount}`} />
            <Stat
              label={t('stats.watchedVideos')}
              value={`${listenStats.watchedVideoCount}`}
              accent={listenStats.watchedVideoCount > 0}
            />
          </Grid>

          {vocabStats ? (
            <>
              <Heading size="5" weight="bold" mb="3">
                {t('stats.vocab')}
              </Heading>
              <Grid columns={{ initial: '2', sm: '3' }} gap="3" mb="6">
                <Stat
                  label={t('stats.today')}
                  value={formatChallengeValue('vocab', vocabStats.todaySeconds, t)}
                  accent={vocabStats.goalCompleteToday}
                />
                <Stat
                  label={t('stats.last7')}
                  value={formatChallengeValue('vocab', vocabStats.weekSeconds, t)}
                />
                <Stat
                  label={t('stats.last30')}
                  value={formatChallengeValue('vocab', vocabStats.monthSeconds, t)}
                />
                <Stat
                  label={t('stats.allTime')}
                  value={formatChallengeValue('vocab', vocabStats.allTimeSeconds, t)}
                />
                <Stat
                  label={t('stats.bestRound')}
                  value={formatChallengeValue('vocab', vocabStats.longestSessionSeconds, t)}
                />
              </Grid>
            </>
          ) : null}

          <Heading size="5" weight="bold" mb="3">
            {t('stats.daysHeading')}
          </Heading>
          <Grid columns={{ initial: '2', sm: '3' }} gap="3" mb="6">
            <Stat
              label={t('stats.daysComplete')}
              value={`${listenStats.daysCompleteAllChallenges}`}
              accent={listenStats.daysCompleteAllChallenges > 0}
            />
            <Stat label={t('stats.activeDays')} value={`${listenStats.totalDistinctActiveDays}`} />
          </Grid>

          <Heading size="5" weight="bold" mb="3">
            {t('stats.activity')}
          </Heading>
          {listenChallenge.data ? (
            <Heatmap
              totals={listenTotalsQuery.data ?? {}}
              goalSeconds={listenChallenge.data.daily_goal_seconds}
            />
          ) : null}

          {vocabChallenge.data ? (
            <>
              <Heading size="5" weight="bold" mt="6" mb="3">
                {t('stats.vocabActivity')}
              </Heading>
              <Heatmap
                totals={vocabTotalsQuery.data ?? {}}
                goalSeconds={vocabChallenge.data.daily_goal_seconds}
              />
            </>
          ) : null}
        </>
      )}
    </Container>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card variant={accent ? 'classic' : 'surface'}>
      <Text size="2" color="gray" weight="medium">
        {label}
      </Text>
      <Text
        as="div"
        size="6"
        weight="bold"
        mt="1"
        color={accent ? 'amber' : undefined}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Text>
    </Card>
  )
}
