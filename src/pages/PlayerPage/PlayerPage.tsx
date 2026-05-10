import { Box, Callout, Card, Container, Flex, Grid, Text } from '@radix-ui/themes'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { ProgressBar } from '@/components/ProgressBar'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useSessionTracker } from '@/hooks/useSessionTracker'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { useSetVideoWatched, useVideo } from '@/hooks/useVideos'
import { formatMinutes, formatSeconds } from '@/lib/dates'
import { paths } from '@/routes/paths'
import type { ChallengeRow, UserId, UserRow, VideoRow } from '@/types/db'

import styles from './PlayerPage.module.css'
import { YouTubePlayer } from './YouTubePlayer'

export function PlayerPage() {
  const { t } = useTranslation()
  const { userId, videoId } = useParams<{ userId: string; videoId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const videoQuery = useVideo(videoId)
  const challengeQuery = useChallengeBySlug('listen')

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />

  if (videoQuery.isLoading) {
    return (
      <Container size="3" px={{ initial: '4', sm: '5' }} py="6">
        <Text color="gray">{t('common.loading')}</Text>
      </Container>
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
  const { t } = useTranslation()
  const tracker = useSessionTracker({
    userId: user.id,
    challengeId: challenge.id,
    videoId: video.id,
    enabled: true,
  })
  const setWatched = useSetVideoWatched()
  const todayQuery = useTodaySecondsForChallenge(user.id, challenge.id)
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
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.videoLibrary(user.id) }}
        title={video.title}
        emoji={user.emoji}
      />

      <Box className={styles.playerWrap} mb="5">
        <YouTubePlayer
          youtubeId={video.youtube_id}
          onPlay={tracker.handlePlay}
          onPauseOrEnd={tracker.handlePauseOrEnd}
          onEnded={() => {
            if (!video.watched_at) {
              setWatched.mutate({ id: video.id, user_id: user.id, watched: true })
            }
          }}
        />
      </Box>

      <Grid columns={{ initial: '1', sm: '2' }} gap="3" mb="5">
        <Card>
          <Text size="2" color="gray">
            {t('player.session')}
          </Text>
          <Text as="div" size="7" weight="bold" mt="1">
            {formatSeconds(tracker.sessionSeconds)}
          </Text>
          <Text as="div" size="2" color={tracker.isPlaying ? 'green' : 'gray'} mt="1">
            {tracker.isPlaying ? t('player.playing') : t('player.paused')}
          </Text>
        </Card>
        <Card>
          <Text size="2" color="gray">
            {t('player.todayTotal')}
          </Text>
          <Flex align="baseline" gap="2" mt="1">
            <Text size="7" weight="bold">
              {formatMinutes(liveToday)}
            </Text>
            <Text size="3" color="gray">
              / {formatMinutes(goal)}
            </Text>
          </Flex>
          <Box mt="3">
            <ProgressBar value={liveToday} max={goal} complete={complete} />
          </Box>
        </Card>
      </Grid>

      {complete ? (
        <Callout.Root color="green">
          <Callout.Text>{t('player.goalReached')}</Callout.Text>
        </Callout.Root>
      ) : null}
    </Container>
  )
}
