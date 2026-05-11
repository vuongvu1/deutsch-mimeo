import { ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons'
import {
  Box,
  Callout,
  Card,
  Container,
  Flex,
  Grid,
  Heading,
  IconButton,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'

import { ProgressBar } from '@/components/ProgressBar'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useSessionTracker } from '@/hooks/useSessionTracker'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import {
  useReorderVideos,
  useSetVideoWatched,
  useVideo,
  useVideos,
} from '@/hooks/useVideos'
import { formatMinutes, formatSeconds } from '@/lib/dates'
import { youtubeThumbUrl } from '@/lib/youtube'
import { paths } from '@/routes/paths'
import type { ChallengeRow, UserId, UserRow, VideoRow } from '@/types/db'

import styles from './PlayerPage.module.css'
import { YouTubePlayer } from './YouTubePlayer'

export function PlayerPage() {
  const { t } = useTranslation()
  const { userId, videoId } = useParams<{ userId: string; videoId: string }>()
  const location = useLocation()
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

  const navState = location.state as { autoplay?: boolean } | null
  const autoplay = navState?.autoplay === true

  return (
    <PlayerScreen
      key={video.id}
      user={user}
      video={video}
      challenge={challenge}
      autoplay={autoplay}
    />
  )
}

function PlayerScreen({
  user,
  video,
  challenge,
  autoplay,
}: {
  user: UserRow
  video: VideoRow
  challenge: ChallengeRow
  autoplay: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tracker = useSessionTracker({
    userId: user.id,
    challengeId: challenge.id,
    videoId: video.id,
    enabled: true,
  })
  const setWatched = useSetVideoWatched()
  const reorder = useReorderVideos()
  const todayQuery = useTodaySecondsForChallenge(user.id, challenge.id)
  const videosQuery = useVideos(user.id)
  const baselineRef = useRef<number | null>(null)
  useEffect(() => {
    if (baselineRef.current === null && todayQuery.data !== undefined) {
      baselineRef.current = todayQuery.data
    }
  }, [todayQuery.data])
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  const upcoming = useMemo(
    () =>
      (videosQuery.data ?? []).filter((v) => v.id !== video.id && !v.watched_at),
    [videosQuery.data, video.id],
  )

  const baseline = baselineRef.current ?? 0
  const liveToday = baseline + tracker.sessionSeconds
  const goal = challenge.daily_goal_seconds
  const complete = liveToday >= goal

  const handleEnded = () => {
    if (!video.watched_at) {
      setWatched.mutate({ id: video.id, user_id: user.id, watched: true })
    }
    const next = upcoming[0]
    if (next) {
      navigate(paths.player(user.id, next.id), { state: { autoplay: true } })
    }
  }

  const swapUpcoming = (i: number, j: number) => {
    const next = upcoming.slice()
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    const orderedIds = video.watched_at
      ? next.map((v) => v.id)
      : [video.id, ...next.map((v) => v.id)]
    reorder.mutate({ user_id: user.id, orderedIds })
  }

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
          autoplay={autoplay}
          onPlay={tracker.handlePlay}
          onPauseOrEnd={tracker.handlePauseOrEnd}
          onEnded={handleEnded}
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
        <Box mb="5">
          <Callout.Root color="green">
            <Callout.Text>{t('player.goalReached')}</Callout.Text>
          </Callout.Root>
        </Box>
      ) : null}

      <Heading size="4" weight="bold" mb="3">
        {t('player.upNext')}{' '}
        <Text size="3" color="gray" weight="regular">
          ({upcoming.length})
        </Text>
      </Heading>
      {videosQuery.isLoading ? (
        <Text color="gray" size="2">
          {t('common.loading')}
        </Text>
      ) : upcoming.length === 0 ? (
        <Card>
          <Text color="gray" size="2">
            {t('player.playlistEmpty')}
          </Text>
        </Card>
      ) : (
        <Flex direction="column" gap="2">
          {upcoming.map((v, idx) => (
            <PlaylistItem
              key={v.id}
              video={v}
              userId={user.id}
              index={idx}
              total={upcoming.length}
              onMoveUp={() => swapUpcoming(idx, idx - 1)}
              onMoveDown={() => swapUpcoming(idx, idx + 1)}
            />
          ))}
        </Flex>
      )}
    </Container>
  )
}

function PlaylistItem({
  video,
  userId,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  video: VideoRow
  userId: UserId
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const { t } = useTranslation()
  const canMoveUp = index > 0
  const canMoveDown = index < total - 1

  const handleUp = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canMoveUp) onMoveUp()
  }
  const handleDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canMoveDown) onMoveDown()
  }

  return (
    <Card asChild variant="surface" className={styles.playlistItem}>
      <Link to={paths.player(userId, video.id)} state={{ autoplay: true }}>
        <Flex align="center" gap="3">
          <img
            className={styles.playlistThumb}
            src={youtubeThumbUrl(video.youtube_id)}
            alt=""
          />
          <Text
            as="div"
            size="2"
            weight="medium"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {video.title}
          </Text>
          <Flex gap="2" flexShrink="0" align="center">
            <Tooltip content={t('videoLibrary.moveUp')}>
              <IconButton
                type="button"
                variant="ghost"
                color="gray"
                disabled={!canMoveUp}
                onClick={handleUp}
                aria-label={t('videoLibrary.moveUp')}
              >
                <ArrowUpIcon />
              </IconButton>
            </Tooltip>
            <Tooltip content={t('videoLibrary.moveDown')}>
              <IconButton
                type="button"
                variant="ghost"
                color="gray"
                disabled={!canMoveDown}
                onClick={handleDown}
                aria-label={t('videoLibrary.moveDown')}
              >
                <ArrowDownIcon />
              </IconButton>
            </Tooltip>
          </Flex>
        </Flex>
      </Link>
    </Card>
  )
}
