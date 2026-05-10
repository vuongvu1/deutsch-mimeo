import { useEffect, useRef } from 'react'

import { loadYouTubeApi } from '@/lib/youtube'

interface Props {
  youtubeId: string
  onPlay: () => void
  onPauseOrEnd: () => void
  onEnded?: () => void
}

export function YouTubePlayer({ youtubeId, onPlay, onPauseOrEnd, onEnded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const onPlayRef = useRef(onPlay)
  const onPauseOrEndRef = useRef(onPauseOrEnd)
  const onEndedRef = useRef(onEnded)

  useEffect(() => {
    onPlayRef.current = onPlay
    onPauseOrEndRef.current = onPauseOrEnd
    onEndedRef.current = onEnded
  }, [onPlay, onPauseOrEnd, onEnded])

  useEffect(() => {
    let cancelled = false
    let player: YT.Player | null = null
    void loadYouTubeApi().then((YTApi) => {
      if (cancelled || !containerRef.current) return
      player = new YTApi.Player(containerRef.current, {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
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
  }, [youtubeId])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
