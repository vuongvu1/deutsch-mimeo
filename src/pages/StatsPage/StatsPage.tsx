import { Navigate, useParams } from 'react-router-dom'

import { Heatmap } from '@/components/Heatmap'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useDailyTotalsRange, useUserStats } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { daysAgoLocalDate, formatMinutes, formatSeconds, todayLocalDate } from '@/lib/dates'
import { paths } from '@/routes/paths'
import type { UserId } from '@/types/db'

import styles from './StatsPage.module.css'

export function StatsPage() {
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

  if (userQuery.isLoading || challengeQuery.isLoading) {
    return (
      <div className="container">
        <p className="muted">Lade…</p>
      </div>
    )
  }
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />

  const stats = statsQuery.data

  return (
    <div className="container">
      <TopBar back={{ to: paths.challenges(user.id) }} title="Stats" emoji={user.emoji} />

      {!stats ? (
        <p className="muted">Lade Statistiken…</p>
      ) : (
        <>
          <h2 className={styles.h2}>🎧 Listening</h2>
          <div className={styles.grid}>
            <Stat label="Heute" value={formatMinutes(stats.todaySeconds)} accent={stats.goalCompleteToday} />
            <Stat label="Letzte 7 Tage" value={formatMinutes(stats.weekSeconds)} />
            <Stat label="Letzte 30 Tage" value={formatMinutes(stats.monthSeconds)} />
            <Stat label="All-time" value={formatMinutes(stats.allTimeSeconds)} />
            <Stat label="Längste Session" value={formatSeconds(stats.longestSessionSeconds)} />
            <Stat label="Videos" value={`${stats.videoCount}`} />
          </div>

          <h2 className={styles.h2}>📅 Tage</h2>
          <div className={styles.grid}>
            <Stat
              label="Tage komplett"
              value={`${stats.daysCompleteAllChallenges}`}
              accent={stats.daysCompleteAllChallenges > 0}
            />
            <Stat label="Aktive Tage" value={`${stats.totalDistinctActiveDays}`} />
          </div>

          <h2 className={styles.h2}>🔥 Aktivität (13 Wochen)</h2>
          {challengeQuery.data ? (
            <Heatmap
              totals={dailyTotalsQuery.data ?? {}}
              goalSeconds={challengeQuery.data.daily_goal_seconds}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={styles.stat} data-accent={accent ? 'true' : 'false'}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  )
}
