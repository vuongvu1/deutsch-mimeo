import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  Cross2Icon,
  PlusIcon,
  ResetIcon,
} from '@radix-ui/react-icons'
import {
  AlertDialog,
  Box,
  Button,
  Callout,
  Card,
  Container,
  Flex,
  Heading,
  IconButton,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'

import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useUser } from '@/hooks/useUsers'
import {
  useAddVideo,
  useDeleteVideo,
  useReorderVideos,
  useSetVideoWatched,
  useVideos,
} from '@/hooks/useVideos'
import { extractYouTubeId, fetchYouTubeTitle, youtubeThumbUrl } from '@/lib/youtube'
import { paths } from '@/routes/paths'
import type { UserId, UserRow, VideoRow } from '@/types/db'

import styles from './VideoLibraryPage.module.css'

export function VideoLibraryPage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const videosQuery = useVideos(userId as UserId | undefined)
  const challengeQuery = useChallengeBySlug('listen')

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />

  const videos = videosQuery.data ?? []
  const active = videos.filter((v) => !v.watched_at)
  const watched = videos.filter((v) => v.watched_at)

  const challengeTitle = t(`challenges.${challengeQuery.data?.slug ?? 'listen'}.title`, {
    defaultValue: challengeQuery.data?.title ?? 'Listen',
  })

  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.challenges(user.id) }}
        title={challengeTitle}
        emoji={t('videoLibrary.pageTitleEmoji')}
      />

      <AddVideoForm user={user} />

      <Heading size="5" weight="bold" mt="6" mb="3">
        {t('videoLibrary.yourVideos')}{' '}
        <Text size="3" color="gray" weight="regular">
          ({active.length})
        </Text>
      </Heading>

      {videosQuery.isLoading ? (
        <Text color="gray">{t('common.loading')}</Text>
      ) : active.length === 0 ? (
        <Card>
          <Text color="gray">{t('videoLibrary.empty')}</Text>
        </Card>
      ) : (
        <Flex direction="column" gap="3">
          {active.map((v, idx) => (
            <VideoItem
              key={v.id}
              video={v}
              userId={user.id}
              section={active}
              index={idx}
            />
          ))}
        </Flex>
      )}

      <Heading size="5" weight="bold" mt="6" mb="3">
        {t('videoLibrary.watched')}{' '}
        <Text size="3" color="gray" weight="regular">
          ({watched.length})
        </Text>
      </Heading>

      {watched.length === 0 ? (
        <Card>
          <Text color="gray">{t('videoLibrary.watchedEmpty')}</Text>
        </Card>
      ) : (
        <Flex direction="column" gap="3">
          {watched.map((v, idx) => (
            <VideoItem
              key={v.id}
              video={v}
              userId={user.id}
              section={watched}
              index={idx}
            />
          ))}
        </Flex>
      )}
    </Container>
  )
}

function AddVideoForm({ user }: { user: UserRow }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const addVideo = useAddVideo()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const id = extractYouTubeId(url)
    if (!id) {
      setError(t('videoLibrary.invalidUrl'))
      return
    }
    setSubmitting(true)
    try {
      const title = (await fetchYouTubeTitle(id)) ?? `YouTube ${id}`
      await addVideo.mutateAsync({
        user_id: user.id,
        youtube_id: id,
        title,
      })
      setUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('videoLibrary.addError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card asChild>
      <form onSubmit={onSubmit}>
        <Flex direction={{ initial: 'column', sm: 'row' }} gap="2" align="stretch">
          <Box flexGrow="1" minWidth="0">
            <TextField.Root
              type="url"
              size="3"
              placeholder={t('videoLibrary.addUrlPlaceholder')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </Box>
          <Button type="submit" size="3" variant="solid" disabled={submitting || !url.trim()}>
            <PlusIcon />
            {submitting ? t('videoLibrary.adding') : t('videoLibrary.addCta')}
          </Button>
        </Flex>
        {error ? (
          <Box mt="2">
            <Callout.Root color="red" size="1">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          </Box>
        ) : null}
      </form>
    </Card>
  )
}

function VideoItem({
  video,
  userId,
  section,
  index,
}: {
  video: VideoRow
  userId: UserId
  section: VideoRow[]
  index: number
}) {
  const { t } = useTranslation()
  const deleteVideo = useDeleteVideo()
  const setWatched = useSetVideoWatched()
  const reorder = useReorderVideos()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isWatched = !!video.watched_at
  const canMoveUp = index > 0
  const canMoveDown = index < section.length - 1

  const onDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteOpen(true)
  }

  const onConfirmDelete = () => {
    deleteVideo.mutate({ id: video.id, user_id: userId })
  }

  const onToggleWatched = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setWatched.mutate({ id: video.id, user_id: userId, watched: !isWatched })
  }

  const swap = (i: number, j: number) => {
    const next = section.slice()
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    reorder.mutate({ user_id: userId, orderedIds: next.map((v) => v.id) })
  }

  const onMoveUp = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canMoveUp) swap(index, index - 1)
  }

  const onMoveDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canMoveDown) swap(index, index + 1)
  }

  return (
    <>
      <Card asChild variant="surface" className={styles.item} data-watched={isWatched}>
        <Link to={paths.player(userId, video.id)}>
          <Flex align="center" gap="3">
            <img className={styles.thumb} src={youtubeThumbUrl(video.youtube_id)} alt="" />
            <Box flexGrow="1" minWidth="0">
              <Text
                as="div"
                size="3"
                weight="medium"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {video.title}
              </Text>
            </Box>
            <Flex gap="2" flexShrink="0" align="center" ml="2">
              <Tooltip content={t('videoLibrary.moveUp')}>
                <IconButton
                  type="button"
                  variant="ghost"
                  color="gray"
                  disabled={!canMoveUp}
                  onClick={onMoveUp}
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
                  onClick={onMoveDown}
                  aria-label={t('videoLibrary.moveDown')}
                >
                  <ArrowDownIcon />
                </IconButton>
              </Tooltip>
              <Tooltip
                content={
                  isWatched ? t('videoLibrary.unmarkWatched') : t('videoLibrary.markWatched')
                }
              >
                <IconButton
                  type="button"
                  variant="ghost"
                  color={isWatched ? 'gray' : 'green'}
                  onClick={onToggleWatched}
                  aria-label={
                    isWatched
                      ? t('videoLibrary.unmarkWatched')
                      : t('videoLibrary.markWatched')
                  }
                >
                  {isWatched ? <ResetIcon /> : <CheckIcon />}
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
