import { Card, Container, Grid, Heading, Text } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { Heatmap } from '@/components/Heatmap'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useDailyTotalsRange, useUserStats } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { daysAgoLocalDate, formatMinutes, formatSeconds, todayLocalDate } from '@/lib/dates'
import { paths } from '@/routes/paths'
import type { UserId } from '@/types/db'

export function StatsPage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const challengeQuery = useChallengeBySlug('listen')
  const statsQuery = useUserStats(userId as UserId | undefined, challengeQuery.data ?? undefined)
  const dailyTotalsQuery = useDailyTotalsRange(
    userId as UserId | undefined,
    challengeQuery.data?.id,
    daysAgoLocalDate(95),
    todayLocalDate(),
  )

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />

  const stats = statsQuery.data

  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.challenges(user.id) }}
        title={t('stats.pageTitle')}
        emoji={user.emoji}
      />

      {!stats ? (
        <Text color="gray">{t('common.loadingStats')}</Text>
      ) : (
        <>
          <Heading size="5" weight="bold" mb="3">
            {t('stats.listening')}
          </Heading>
          <Grid columns={{ initial: '2', sm: '3' }} gap="3" mb="6">
            <Stat label={t('stats.today')} value={formatMinutes(stats.todaySeconds)} accent={stats.goalCompleteToday} />
            <Stat label={t('stats.last7')} value={formatMinutes(stats.weekSeconds)} />
            <Stat label={t('stats.last30')} value={formatMinutes(stats.monthSeconds)} />
            <Stat label={t('stats.allTime')} value={formatMinutes(stats.allTimeSeconds)} />
            <Stat label={t('stats.longest')} value={formatSeconds(stats.longestSessionSeconds)} />
            <Stat label={t('stats.activeVideos')} value={`${stats.activeVideoCount}`} />
            <Stat
              label={t('stats.watchedVideos')}
              value={`${stats.watchedVideoCount}`}
              accent={stats.watchedVideoCount > 0}
            />
          </Grid>

          <Heading size="5" weight="bold" mb="3">
            {t('stats.daysHeading')}
          </Heading>
          <Grid columns={{ initial: '2', sm: '3' }} gap="3" mb="6">
            <Stat
              label={t('stats.daysComplete')}
              value={`${stats.daysCompleteAllChallenges}`}
              accent={stats.daysCompleteAllChallenges > 0}
            />
            <Stat label={t('stats.activeDays')} value={`${stats.totalDistinctActiveDays}`} />
          </Grid>

          <Heading size="5" weight="bold" mb="3">
            {t('stats.activity')}
          </Heading>
          {challengeQuery.data ? (
            <Heatmap
              totals={dailyTotalsQuery.data ?? {}}
              goalSeconds={challengeQuery.data.daily_goal_seconds}
            />
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
