import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  Cross2Icon,
  DoubleArrowUpIcon,
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
  Dialog,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Skeleton,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Pagination } from '@/components/Pagination'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useUser } from '@/hooks/useUsers'
import {
  useAddVideo,
  useAddVideosBulk,
  useDeleteVideo,
  useReorderVideos,
  useSetVideoWatched,
  useVideos,
} from '@/hooks/useVideos'
import {
  extractPlaylistId,
  extractYouTubeId,
  fetchPlaylistItems,
  fetchYouTubeTitle,
  youtubeThumbUrl,
  type PlaylistVideo,
} from '@/lib/youtube'
import { paths } from '@/routes/paths'
import type { UserId, UserRow, VideoRow } from '@/types/db'

import styles from './VideoLibraryPage.module.css'

const PAGE_SIZE = 10

export function VideoLibraryPage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const videosQuery = useVideos(userId as UserId | undefined)
  const challengeQuery = useChallengeBySlug('listen')
  const [activePage, setActivePage] = useState(1)
  const [watchedPage, setWatchedPage] = useState(1)

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />

  const videos = videosQuery.data ?? []
  const active = videos.filter((v) => !v.watched_at)
  const watched = videos.filter((v) => v.watched_at)

  const activeTotalPages = Math.max(1, Math.ceil(active.length / PAGE_SIZE))
  const watchedTotalPages = Math.max(1, Math.ceil(watched.length / PAGE_SIZE))
  const activeCurPage = Math.min(activePage, activeTotalPages)
  const watchedCurPage = Math.min(watchedPage, watchedTotalPages)
  const activeOffset = (activeCurPage - 1) * PAGE_SIZE
  const watchedOffset = (watchedCurPage - 1) * PAGE_SIZE
  const activeSlice = active.slice(activeOffset, activeOffset + PAGE_SIZE)
  const watchedSlice = watched.slice(watchedOffset, watchedOffset + PAGE_SIZE)

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
        <VideoItemSkeletonList count={3} />
      ) : active.length === 0 ? (
        <Card>
          <Text color="gray">{t('videoLibrary.empty')}</Text>
        </Card>
      ) : (
        <>
          <Flex direction="column" gap="3">
            {activeSlice.map((v, idx) => (
              <VideoItem
                key={v.id}
                video={v}
                userId={user.id}
                section={active}
                index={activeOffset + idx}
              />
            ))}
          </Flex>
          {activeTotalPages > 1 ? (
            <Pagination
              page={activeCurPage}
              totalPages={activeTotalPages}
              onPage={setActivePage}
            />
          ) : null}
        </>
      )}

      <Heading size="5" weight="bold" mt="6" mb="3">
        {t('videoLibrary.watched')}{' '}
        <Text size="3" color="gray" weight="regular">
          ({watched.length})
        </Text>
      </Heading>

      {videosQuery.isLoading ? (
        <VideoItemSkeletonList count={2} />
      ) : watched.length === 0 ? (
        <Card>
          <Text color="gray">{t('videoLibrary.watchedEmpty')}</Text>
        </Card>
      ) : (
        <>
          <Flex direction="column" gap="3">
            {watchedSlice.map((v, idx) => (
              <VideoItem
                key={v.id}
                video={v}
                userId={user.id}
                section={watched}
                index={watchedOffset + idx}
              />
            ))}
          </Flex>
          {watchedTotalPages > 1 ? (
            <Pagination
              page={watchedCurPage}
              totalPages={watchedTotalPages}
              onPage={setWatchedPage}
            />
          ) : null}
        </>
      )}
    </Container>
  )
}

function AddVideoForm({ user }: { user: UserRow }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [playlistPreview, setPlaylistPreview] = useState<PlaylistVideo[] | null>(null)
  const addVideo = useAddVideo()
  const addVideosBulk = useAddVideosBulk()
  const videosQuery = useVideos(user.id)
  const existingIds = useMemo(
    () => new Set((videosQuery.data ?? []).map((v) => v.youtube_id)),
    [videosQuery.data],
  )

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const playlistId = extractPlaylistId(url)
    if (playlistId) {
      setSubmitting(true)
      try {
        const items = await fetchPlaylistItems(playlistId)
        if (items.length === 0) {
          setError(t('videoLibrary.playlistEmpty'))
        } else {
          setPlaylistPreview(items)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('videoLibrary.addError'))
      } finally {
        setSubmitting(false)
      }
      return
    }

    const id = extractYouTubeId(url)
    if (!id) {
      setError(t('videoLibrary.invalidUrl'))
      return
    }
    if (existingIds.has(id)) {
      setError(t('videoLibrary.alreadyAdded'))
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

  const newItems = playlistPreview?.filter((v) => !existingIds.has(v.youtubeId)) ?? []
  const dupCount = (playlistPreview?.length ?? 0) - newItems.length

  const onConfirmBulk = async () => {
    if (!playlistPreview || newItems.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await addVideosBulk.mutateAsync({
        user_id: user.id,
        items: newItems.map((v) => ({ youtube_id: v.youtubeId, title: v.title })),
      })
      setPlaylistPreview(null)
      setUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('videoLibrary.addError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
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
      <Dialog.Root
        open={!!playlistPreview}
        onOpenChange={(open) => {
          if (!open && !submitting) setPlaylistPreview(null)
        }}
      >
        <Dialog.Content maxWidth="520px">
          <Dialog.Title>
            {t('videoLibrary.playlistTitle', { count: playlistPreview?.length ?? 0 })}
          </Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="3">
            {t('videoLibrary.playlistSummary', { newCount: newItems.length, dupCount })}
          </Dialog.Description>
          <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: '50vh' }}>
            <Flex direction="column" gap="2" pr="3">
              {playlistPreview?.map((item) => {
                const dup = existingIds.has(item.youtubeId)
                return (
                  <Flex
                    key={item.youtubeId}
                    align="center"
                    gap="3"
                    style={{ opacity: dup ? 0.5 : 1 }}
                  >
                    <img
                      src={youtubeThumbUrl(item.youtubeId)}
                      alt=""
                      width={80}
                      height={45}
                      style={{
                        borderRadius: 'var(--radius-2)',
                        objectFit: 'cover',
                        flexShrink: 0,
                        background: 'var(--gray-a3)',
                      }}
                    />
                    <Box flexGrow="1" minWidth="0">
                      <Text
                        as="div"
                        size="2"
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.title}
                      </Text>
                      {dup ? (
                        <Text as="div" size="1" color="gray">
                          {t('videoLibrary.alreadyAdded')}
                        </Text>
                      ) : null}
                    </Box>
                  </Flex>
                )
              })}
            </Flex>
          </ScrollArea>
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" disabled={submitting}>
                {t('common.cancel')}
              </Button>
            </Dialog.Close>
            <Button
              variant="solid"
              onClick={onConfirmBulk}
              disabled={submitting || newItems.length === 0}
            >
              {submitting
                ? t('videoLibrary.adding')
                : t('videoLibrary.addNCta', { count: newItems.length })}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

function VideoItemSkeletonList({ count }: { count: number }) {
  return (
    <Flex direction="column" gap="3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} variant="surface" className={styles.item}>
          <Flex align="center" gap="3">
            <Skeleton className={styles.thumb} />
            <Box flexGrow="1" minWidth="0">
              <Skeleton>
                <Text as="div" size="3" weight="medium">
                  Loading video title placeholder
                </Text>
              </Skeleton>
            </Box>
          </Flex>
        </Card>
      ))}
    </Flex>
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

  const onMoveToTop = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canMoveUp) return
    const next = section.slice()
    const [moved] = next.splice(index, 1)
    next.unshift(moved)
    reorder.mutate({ user_id: userId, orderedIds: next.map((v) => v.id) })
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
              <Tooltip content={t('videoLibrary.moveToTop')}>
                <IconButton
                  type="button"
                  variant="ghost"
                  color="gray"
                  disabled={!canMoveUp}
                  onClick={onMoveToTop}
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
