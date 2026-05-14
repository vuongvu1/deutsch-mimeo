import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  Cross2Icon,
  DoubleArrowUpIcon,
} from '@radix-ui/react-icons'
import {
  AlertDialog,
  Box,
  Button,
  Callout,
  Card,
  Container,
  Flex,
  Grid,
  Heading,
  IconButton,
  Switch,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'

import { Pagination } from '@/components/Pagination'
import { ProgressBar } from '@/components/ProgressBar'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useSessionTracker } from '@/hooks/useSessionTracker'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import {
  useDeleteVideo,
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

const PAGE_SIZE = 10
const AUTO_NEXT_STORAGE_KEY = 'mimeo:autoNext'
const MOVIE_MODE_STORAGE_KEY = 'mimeo:movieMode'
const TAB_SECONDS_STORAGE_KEY = 'mimeo:tabSessionSeconds'

function getInitialAutoNext(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem(AUTO_NEXT_STORAGE_KEY)
  if (stored === 'false') return false
  return true
}

function getInitialMovieMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(MOVIE_MODE_STORAGE_KEY) === 'true'
}

function getInitialTabBaseline(): number {
  if (typeof window === 'undefined') return 0
  const n = Number(window.sessionStorage.getItem(TAB_SECONDS_STORAGE_KEY))
  return Number.isFinite(n) && n > 0 ? n : 0
}

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
  const [page, setPage] = useState(1)
  const [autoNext, setAutoNext] = useState<boolean>(getInitialAutoNext)
  const [movieMode, setMovieMode] = useState<boolean>(getInitialMovieMode)
  const [tabBaseline] = useState<number>(getInitialTabBaseline)
  const tabSessionSeconds = tabBaseline + tracker.sessionSeconds
  useEffect(() => {
    if (baselineRef.current === null && todayQuery.data !== undefined) {
      baselineRef.current = todayQuery.data
    }
  }, [todayQuery.data])
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])
  useEffect(() => {
    window.localStorage.setItem(AUTO_NEXT_STORAGE_KEY, autoNext ? 'true' : 'false')
  }, [autoNext])
  useEffect(() => {
    window.localStorage.setItem(MOVIE_MODE_STORAGE_KEY, movieMode ? 'true' : 'false')
  }, [movieMode])
  useEffect(() => {
    window.sessionStorage.setItem(TAB_SECONDS_STORAGE_KEY, String(tabSessionSeconds))
  }, [tabSessionSeconds])
  useEffect(() => {
    if (!movieMode) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMovieMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [movieMode])

  const upcoming = useMemo(
    () =>
      (videosQuery.data ?? []).filter((v) => v.id !== video.id && !v.watched_at),
    [videosQuery.data, video.id],
  )

  const totalPages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE))
  const curPage = Math.min(page, totalPages)
  const offset = (curPage - 1) * PAGE_SIZE
  const pageSlice = upcoming.slice(offset, offset + PAGE_SIZE)

  const baseline = baselineRef.current ?? 0
  const liveToday = baseline + tracker.sessionSeconds
  const goal = challenge.daily_goal_seconds
  const complete = liveToday >= goal

  const handleEnded = () => {
    if (!video.watched_at) {
      setWatched.mutate({ id: video.id, user_id: user.id, watched: true })
    }
    if (!autoNext) return
    const next = upcoming[0]
    if (next) {
      navigate(paths.player(user.id, next.id), { state: { autoplay: true } })
    }
  }

  const persistOrder = (next: VideoRow[]) => {
    const orderedIds = video.watched_at
      ? next.map((v) => v.id)
      : [video.id, ...next.map((v) => v.id)]
    reorder.mutate({ user_id: user.id, orderedIds })
  }

  const swapUpcoming = (i: number, j: number) => {
    const next = upcoming.slice()
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    persistOrder(next)
  }

  const moveUpcomingToTop = (i: number) => {
    if (i <= 0) return
    const next = upcoming.slice()
    const [moved] = next.splice(i, 1)
    next.unshift(moved)
    persistOrder(next)
  }

  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.videoLibrary(user.id) }}
        title={video.title}
        emoji={user.emoji}
      />

      {movieMode ? (
        <Box
          className={styles.movieBackdrop}
          onClick={() => setMovieMode(false)}
          aria-label={t('player.exitMovieMode')}
        />
      ) : null}

      {movieMode ? (
        <Box className={styles.movieStats}>
          <Text size="2" color="gray" style={{ flexShrink: 0 }}>
            {t('player.todayTotal')}
          </Text>
          <Box className={styles.movieStatsBar}>
            <ProgressBar value={liveToday} max={goal} complete={complete} />
          </Box>
          <Flex align="baseline" gap="1" style={{ flexShrink: 0 }}>
            <Text size="3" weight="bold" style={{ color: 'white' }}>
              {formatMinutes(liveToday)}
            </Text>
            <Text size="1" color="gray">
              / {formatMinutes(goal)}
            </Text>
          </Flex>
        </Box>
      ) : null}

      <Box className={styles.playerSlot} mb="5">
        <Box className={`${styles.playerBox} ${movieMode ? styles.playerBoxMovie : ''}`}>
          <YouTubePlayer
            youtubeId={video.youtube_id}
            autoplay={autoplay}
            onPlay={tracker.handlePlay}
            onPauseOrEnd={tracker.handlePauseOrEnd}
            onEnded={handleEnded}
          />
        </Box>
      </Box>

      <Grid columns={{ initial: '1', sm: '2' }} gap="3" mb="5">
        <Card>
          <Text size="2" color="gray">
            {t('player.session')}
          </Text>
          <Text as="div" size="7" weight="bold" mt="1">
            {formatSeconds(tabSessionSeconds)}
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

      <Flex align="center" justify="between" gap="3" mb="3">
        <Heading size="4" weight="bold">
          {t('player.upNext')}{' '}
          <Text size="3" color="gray" weight="regular">
            ({upcoming.length})
          </Text>
        </Heading>
        <Flex align="center" gap="4">
          <Text as="label" size="2" color="gray" style={{ cursor: 'var(--cursor-switch)' }}>
            <Flex align="center" gap="2">
              <Switch
                color="amber"
                checked={autoNext}
                onCheckedChange={setAutoNext}
                aria-label={t('player.autoplay')}
              />
              {t('player.autoplay')}
            </Flex>
          </Text>
          <Text as="label" size="2" color="gray" style={{ cursor: 'var(--cursor-switch)' }}>
            <Flex align="center" gap="2">
              <Switch
                color="amber"
                checked={movieMode}
                onCheckedChange={setMovieMode}
                aria-label={t('player.movieMode')}
              />
              {t('player.movieMode')}
            </Flex>
          </Text>
        </Flex>
      </Flex>
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
        <>
          <Flex direction="column" gap="2">
            {pageSlice.map((v, idx) => {
              const realIdx = offset + idx
              return (
                <PlaylistItem
                  key={v.id}
                  video={v}
                  userId={user.id}
                  index={realIdx}
                  total={upcoming.length}
                  onMoveUp={() => swapUpcoming(realIdx, realIdx - 1)}
                  onMoveDown={() => swapUpcoming(realIdx, realIdx + 1)}
                  onMoveToTop={() => moveUpcomingToTop(realIdx)}
                />
              )
            })}
          </Flex>
          {totalPages > 1 ? (
            <Pagination page={curPage} totalPages={totalPages} onPage={setPage} />
          ) : null}
        </>
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
  onMoveToTop,
}: {
  video: VideoRow
  userId: UserId
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveToTop: () => void
}) {
  const { t } = useTranslation()
  const setWatched = useSetVideoWatched()
  const deleteVideo = useDeleteVideo()
  const [deleteOpen, setDeleteOpen] = useState(false)
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
  const handleTop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canMoveUp) onMoveToTop()
  }
  const onMarkWatched = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setWatched.mutate({ id: video.id, user_id: userId, watched: true })
  }
  const onDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteOpen(true)
  }
  const onConfirmDelete = () => {
    deleteVideo.mutate({ id: video.id, user_id: userId })
  }

  return (
    <>
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
              <Tooltip content={t('videoLibrary.moveToTop')}>
                <IconButton
                  type="button"
                  variant="ghost"
                  color="gray"
                  disabled={!canMoveUp}
                  onClick={handleTop}
                  aria-label={t('videoLibrary.moveToTop')}
                >
                  <DoubleArrowUpIcon />
                </IconButton>
              </Tooltip>
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
              <Tooltip content={t('videoLibrary.markWatched')}>
                <IconButton
                  type="button"
                  variant="ghost"
                  color="green"
                  onClick={onMarkWatched}
                  aria-label={t('videoLibrary.markWatched')}
                >
                  <CheckIcon />
                </IconButton>
              </Tooltip>
              <Tooltip content={t('common.delete')}>
                <IconButton
                  type="button"
                  variant="ghost"
                  color="gray"
                  onClick={onDeleteClick}
                  aria-label={t('common.delete')}
                >
                  <Cross2Icon />
                </IconButton>
              </Tooltip>
            </Flex>
          </Flex>
        </Link>
      </Card>
      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Content maxWidth="450px">
          <AlertDialog.Title>
            {t('videoLibrary.confirmDelete', { title: video.title })}
          </AlertDialog.Title>
          <AlertDialog.Description size="2">
            {t('videoLibrary.deleteWarning')}
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                {t('common.cancel')}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button variant="solid" color="red" onClick={onConfirmDelete}>
                {t('common.delete')}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  )
}
