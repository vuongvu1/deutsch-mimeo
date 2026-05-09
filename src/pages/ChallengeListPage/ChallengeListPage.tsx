import { Link, Navigate, useParams } from 'react-router-dom'

import { TopBar } from '@/components/TopBar'
import { ProgressBar } from '@/components/ProgressBar'
import { useChallenges } from '@/hooks/useChallenges'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { formatMinutes } from '@/lib/dates'
import { paths } from '@/routes/paths'
import type { ChallengeRow, UserId, UserRow } from '@/types/db'

import styles from './ChallengeListPage.module.css'

const SLUG_TO_PATH: Record<string, ((u: UserId) => string) | undefined> = {
  listen: (u) => paths.videoLibrary(u),
}

export function ChallengeListPage() {
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const challengesQuery = useChallenges()

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  if (userQuery.isLoading || challengesQuery.isLoading) {
    return (
      <div className="container">
        <p className="muted">Lade…</p>
      </div>
    )
  }
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />

  const challenges = challengesQuery.data ?? []

  return (
    <div className="container">
      <TopBar
        back={{ to: paths.home() }}
        title={user.display_name}
        emoji={user.emoji}
        rightSlot={
          <Link to={paths.stats(user.id)} className="btn">
            Stats
          </Link>
        }
      />

      <h2 className={styles.h2}>Heutige Challenges</h2>

      <div className={styles.list}>
        {challenges.map((c) => (
          <ChallengeCard key={c.id} challenge={c} user={user} />
        ))}
      </div>
    </div>
  )
}

function ChallengeCard({ challenge, user }: { challenge: ChallengeRow; user: UserRow }) {
  const todayQuery = useTodaySecondsForChallenge(user.id, challenge.id)
  const seconds = todayQuery.data ?? 0
  const goal = challenge.daily_goal_seconds
  const complete = seconds >= goal
  const link = SLUG_TO_PATH[challenge.slug]?.(user.id)

  const inner = (
    <>
      <div className={styles.cardHead}>
        <div>
          <div className={styles.cardTitle}>{challenge.title}</div>
          {challenge.description ? (
            <div className={styles.cardDesc}>{challenge.description}</div>
          ) : null}
        </div>
        {complete ? <span className={styles.badge}>✓</span> : null}
      </div>
      <div className={styles.progress}>
        <ProgressBar value={seconds} max={goal} complete={complete} />
        <div className={styles.progressMeta}>
          <span>{formatMinutes(seconds)}</span>
          <span className="subtle">/ {formatMinutes(goal)}</span>
        </div>
      </div>
    </>
  )

  if (!link) {
    return <div className={styles.card}>{inner}</div>
  }

  return (
    <Link to={link} className={styles.card} data-clickable="true">
      {inner}
    </Link>
  )
}
