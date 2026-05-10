import { Cross2Icon, PlusIcon } from '@radix-ui/react-icons'
import {
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
} from '@radix-ui/themes'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'

import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useUser } from '@/hooks/useUsers'
import { useAddVideo, useDeleteVideo, useVideos } from '@/hooks/useVideos'
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
          ({videos.length})
        </Text>
      </Heading>

      {videosQuery.isLoading ? (
        <Text color="gray">{t('common.loading')}</Text>
      ) : videos.length === 0 ? (
        <Card>
          <Text color="gray">{t('videoLibrary.empty')}</Text>
        </Card>
      ) : (
        <Flex direction="column" gap="3">
          {videos.map((v) => (
            <VideoItem key={v.id} video={v} userId={user.id} />
          ))}
        </Flex>
      )}
    </Container>
  )
}

function AddVideoForm({ user }: { user: UserRow }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
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
        note: note.trim() || null,
      })
      setUrl('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('videoLibrary.addError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card asChild>
      <form onSubmit={onSubmit}>
        <Flex direction="column" gap="3">
          <TextField.Root
            type="url"
            size="3"
            placeholder={t('videoLibrary.addUrlPlaceholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <TextField.Root
            type="text"
            size="3"
            placeholder={t('videoLibrary.notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            type="submit"
            size="3"
            variant="solid"
            disabled={submitting || !url.trim()}
          >
            <PlusIcon />
            {submitting ? t('videoLibrary.adding') : t('videoLibrary.addCta')}
          </Button>
          {error ? (
            <Callout.Root color="red" size="1">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          ) : null}
        </Flex>
      </form>
    </Card>
  )
}

function VideoItem({ video, userId }: { video: VideoRow; userId: UserId }) {
  const { t } = useTranslation()
  const deleteVideo = useDeleteVideo()
  const onDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(t('videoLibrary.confirmDelete', { title: video.title }))) {
      deleteVideo.mutate({ id: video.id, user_id: userId })
    }
  }
  return (
    <Card asChild variant="surface">
      <Link to={paths.player(userId, video.id)} className={styles.item}>
        <Flex align="center" gap="3">
          <Box asChild flexShrink="0">
            <img
              className={styles.thumb}
              src={youtubeThumbUrl(video.youtube_id)}
              alt=""
            />
          </Box>
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
            {video.note ? (
              <Text as="div" size="2" color="gray">
                {video.note}
              </Text>
            ) : null}
          </Box>
          <IconButton
            type="button"
            variant="ghost"
            color="gray"
            onClick={onDelete}
            aria-label={t('common.delete')}
          >
            <Cross2Icon />
          </IconButton>
        </Flex>
      </Link>
    </Card>
  )
}
