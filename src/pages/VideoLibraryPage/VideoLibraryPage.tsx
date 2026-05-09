import { useState } from 'react'
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
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const videosQuery = useVideos(userId as UserId | undefined)
  const challengeQuery = useChallengeBySlug('listen')

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  if (userQuery.isLoading) {
    return (
      <div className="container">
        <p className="muted">Lade…</p>
      </div>
    )
  }
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />

  const videos = videosQuery.data ?? []
  const challengeTitle = challengeQuery.data?.title ?? 'Listen'

  return (
    <div className="container">
      <TopBar back={{ to: paths.challenges(user.id) }} title={challengeTitle} emoji="🎧" />

      <AddVideoForm user={user} />

      <h2 className={styles.h2}>
        Deine Videos <span className="subtle">({videos.length})</span>
      </h2>

      {videosQuery.isLoading ? (
        <p className="muted">Lade…</p>
      ) : videos.length === 0 ? (
        <div className="card muted">Noch keine Videos. Füge eins oben hinzu.</div>
      ) : (
        <div className={styles.list}>
          {videos.map((v) => (
            <VideoItem key={v.id} video={v} userId={user.id} />
          ))}
        </div>
      )}
    </div>
  )
}

function AddVideoForm({ user }: { user: UserRow }) {
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
      setError('Bitte gültige YouTube-URL einfügen')
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
      setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={styles.fields}>
        <input
          type="url"
          placeholder="YouTube-URL einfügen…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Notiz (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={submitting || !url.trim()}>
        {submitting ? 'Hinzufügen…' : '+ Video'}
      </button>
      {error ? <div className={styles.error}>{error}</div> : null}
    </form>
  )
}

function VideoItem({ video, userId }: { video: VideoRow; userId: UserId }) {
  const deleteVideo = useDeleteVideo()
  const onDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(`„${video.title}“ löschen?`)) {
      deleteVideo.mutate({ id: video.id, user_id: userId })
    }
  }
  return (
    <Link to={paths.player(userId, video.id)} className={styles.item}>
      <img className={styles.thumb} src={youtubeThumbUrl(video.youtube_id)} alt="" />
      <div className={styles.itemBody}>
        <div className={styles.itemTitle}>{video.title}</div>
        {video.note ? <div className={styles.itemNote}>{video.note}</div> : null}
      </div>
      <button
        type="button"
        className={styles.deleteBtn}
        onClick={onDelete}
        aria-label="Löschen"
        title="Löschen"
      >
        ×
      </button>
    </Link>
  )
}
