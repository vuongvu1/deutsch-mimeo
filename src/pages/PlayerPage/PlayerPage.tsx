import { useEffect, useRef } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { TopBar } from '@/components/TopBar'
import { ProgressBar } from '@/components/ProgressBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useSessionTracker } from '@/hooks/useSessionTracker'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { useVideo } from '@/hooks/useVideos'
import { formatMinutes, formatSeconds } from '@/lib/dates'
import { paths } from '@/routes/paths'
import type { ChallengeRow, UserId, UserRow, VideoRow } from '@/types/db'

import styles from './PlayerPage.module.css'
import { YouTubePlayer } from './YouTubePlayer'

export function PlayerPage() {
  const { userId, videoId } = useParams<{ userId: string; videoId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const videoQuery = useVideo(videoId)
  const challengeQuery = useChallengeBySlug('listen')

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />

  if (userQuery.isLoading || videoQuery.isLoading || challengeQuery.isLoading) {
    return (
      <div className="container">
        <p className="muted">Lade…</p>
      </div>
    )
  }
  const user = userQuery.data
  const video = videoQuery.data
  const challenge = challengeQuery.data
  if (!user) return <Navigate to="/" replace />
  if (!video || !challenge) return <Navigate to={paths.videoLibrary(user.id)} replace />

  return <PlayerScreen user={user} video={video} challenge={challenge} />
}

function PlayerScreen({
  user,
  video,
  challenge,
}: {
  user: UserRow
  video: VideoRow
  challenge: ChallengeRow
}) {
  const tracker = useSessionTracker({
    userId: user.id,
    challengeId: challenge.id,
    videoId: video.id,
    enabled: true,
  })
  const todayQuery = useTodaySecondsForChallenge(user.id, challenge.id)
  // Snapshot the persisted total at first load; live = snapshot + current session,
  // so flushes during this session don't double-count.
  const baselineRef = useRef<number | null>(null)
  useEffect(() => {
    if (baselineRef.current === null && todayQuery.data !== undefined) {
      baselineRef.current = todayQuery.data
    }
  }, [todayQuery.data])
  const baseline = baselineRef.current ?? 0
  const liveToday = baseline + tracker.sessionSeconds
  const goal = challenge.daily_goal_seconds
  const complete = liveToday >= goal

  return (
    <div className="container">
      <TopBar
        back={{ to: paths.videoLibrary(user.id) }}
        title={video.title}
        emoji={user.emoji}
      />

      <div className={styles.playerWrap}>
        <YouTubePlayer
          youtubeId={video.youtube_id}
          onPlay={tracker.handlePlay}
          onPauseOrEnd={tracker.handlePauseOrEnd}
        />
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Diese Session</div>
          <div className={styles.statValue}>{formatSeconds(tracker.sessionSeconds)}</div>
          <div className={styles.statHint}>
            {tracker.isPlaying ? '▶︎ läuft' : '⏸ pausiert'}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Heute total</div>
          <div className={styles.statValue}>
            {formatMinutes(liveToday)}{' '}
            <span className="subtle">/ {formatMinutes(goal)}</span>
          </div>
          <div className={styles.progress}>
            <ProgressBar value={liveToday} max={goal} complete={complete} />
          </div>
        </div>
      </div>

      {complete ? (
        <div className={styles.complete}>
          🎉 Tagesziel erreicht! Du kannst weiterhören — alles zählt.
        </div>
      ) : null}
    </div>
  )
}
