import { useEffect, useImperativeHandle, useRef } from 'react'

import { loadYouTubeApi } from '@/lib/youtube'

export interface YouTubePlayerHandle {
  getCurrentTime: () => number | null
}

interface Props {
  youtubeId: string
  autoplay?: boolean
  startSeconds?: number
  onPlay: () => void
  onPauseOrEnd: () => void
  onEnded?: () => void
  ref?: React.Ref<YouTubePlayerHandle>
}

export function YouTubePlayer({
  youtubeId,
  autoplay,
  startSeconds,
  onPlay,
  onPauseOrEnd,
  onEnded,
  ref,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const onPlayRef = useRef(onPlay)
  const onPauseOrEndRef = useRef(onPauseOrEnd)
  const onEndedRef = useRef(onEnded)
  // startSeconds is read once on mount; later updates must NOT destroy the player.
  const startSecondsRef = useRef(startSeconds)

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => {
      try {
        const t = playerRef.current?.getCurrentTime()
        return typeof t === 'number' && Number.isFinite(t) ? t : null
      } catch {
        return null
      }
    },
  }))

  useEffect(() => {
    onPlayRef.current = onPlay
    onPauseOrEndRef.current = onPauseOrEnd
    onEndedRef.current = onEnded
  }, [onPlay, onPauseOrEnd, onEnded])

  useEffect(() => {
    let cancelled = false
    let player: YT.Player | null = null
    const initialStart = startSecondsRef.current
    const start = initialStart && initialStart > 0 ? Math.floor(initialStart) : undefined
    void loadYouTubeApi().then((YTApi) => {
      if (cancelled || !containerRef.current) return
      player = new YTApi.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          ...(autoplay ? { autoplay: 1 } : {}),
          ...(start !== undefined ? { start } : {}),
        },
        events: {
          onStateChange: (e) => {
            const State = YTApi.PlayerState
            if (e.data === State.PLAYING) onPlayRef.current()
            else if (e.data === State.PAUSED || e.data === State.ENDED) onPauseOrEndRef.current()
            if (e.data === State.ENDED) onEndedRef.current?.()
          },
        },
      })
      playerRef.current = player
    })
    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy()
      } catch {
        // ignore destroy errors during unmount
      }
      playerRef.current = null
    }
  }, [youtubeId, autoplay])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
