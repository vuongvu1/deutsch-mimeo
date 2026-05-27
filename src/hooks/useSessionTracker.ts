import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { todayLocalDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import type { UserId } from '@/types/db'

interface Args {
  userId: UserId
  challengeId: string
  videoId: string
  enabled: boolean
  getCurrentVideoTime?: () => number | null
}

interface State {
  sessionId: string | null
  sessionSeconds: number
  isPlaying: boolean
}

const FLUSH_EVERY_TICKS = 10 // flush to DB every 10s of play

/**
 * Tracks a play session: increments seconds locally while `isPlaying` is true,
 * persists to Supabase periodically and on state changes.
 *
 * Returns helpers the player calls on YouTube state-change events.
 */
export function useSessionTracker({
  userId,
  challengeId,
  videoId,
  enabled,
  getCurrentVideoTime,
}: Args) {
  const qc = useQueryClient()
  const getCurrentVideoTimeRef = useRef(getCurrentVideoTime)
  getCurrentVideoTimeRef.current = getCurrentVideoTime
  const [state, setState] = useState<State>({
    sessionId: null,
    sessionSeconds: 0,
    isPlaying: false,
  })
  const stateRef = useRef(state)
  stateRef.current = state

  const flushingRef = useRef(false)
  const ticksSinceFlushRef = useRef(0)

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (stateRef.current.sessionId) return stateRef.current.sessionId
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        challenge_id: challengeId,
        video_id: videoId,
        seconds: 0,
        local_date: todayLocalDate(),
      })
      .select('id')
      .single()
    if (error) {
      console.error('Failed to create session', error)
      return null
    }
    setState((s) => ({ ...s, sessionId: data.id }))
    return data.id
  }, [userId, challengeId, videoId])

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    const id = stateRef.current.sessionId
    const seconds = stateRef.current.sessionSeconds
    if (!id || seconds <= 0) return
    flushingRef.current = true
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ seconds, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) console.error('Failed to flush session', error)

      const t = getCurrentVideoTimeRef.current?.()
      if (typeof t === 'number' && Number.isFinite(t) && t >= 0) {
        const { error: posError } = await supabase
          .from('videos')
          .update({ last_position_seconds: Math.floor(t) })
          .eq('id', videoId)
        if (posError) console.error('Failed to flush video position', posError)
        // Don't invalidate ['video', videoId] here — it would refetch into the
        // mounted PlayerScreen, change YouTubePlayer.startSeconds, and destroy
        // the player mid-playback. The next mount refetches anyway (staleTime=0).
      }

      // Refresh dependent queries so progress UI stays in sync.
      qc.invalidateQueries({ queryKey: ['today-seconds', userId, challengeId] })
      qc.invalidateQueries({ queryKey: ['stats', userId] })
      qc.invalidateQueries({ queryKey: ['comparison-stats'] })
      qc.invalidateQueries({ queryKey: ['recent-sessions'] })
    } finally {
      flushingRef.current = false
      ticksSinceFlushRef.current = 0
    }
  }, [qc, userId, challengeId, videoId])

  // 1-second tick while playing.
  useEffect(() => {
    if (!enabled || !state.isPlaying) return
    const interval = window.setInterval(() => {
      setState((s) => ({ ...s, sessionSeconds: s.sessionSeconds + 1 }))
      ticksSinceFlushRef.current += 1
      if (ticksSinceFlushRef.current >= FLUSH_EVERY_TICKS) {
        void flush()
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [enabled, state.isPlaying, flush])

  // Flush when tab is hidden or page is unloaded.
  useEffect(() => {
    if (!enabled) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    const onBeforeUnload = () => {
      void flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [enabled, flush])

  // biome-ignore lint/correctness/useExhaustiveDependencies: final flush on unmount only
  useEffect(() => {
    return () => {
      void flush()
    }
  }, [])

  const handlePlay = useCallback(async () => {
    await ensureSession()
    setState((s) => ({ ...s, isPlaying: true }))
  }, [ensureSession])

  const handlePauseOrEnd = useCallback(() => {
    setState((s) => ({ ...s, isPlaying: false }))
    void flush()
  }, [flush])

  return {
    sessionSeconds: state.sessionSeconds,
    isPlaying: state.isPlaying,
    handlePlay,
    handlePauseOrEnd,
  }
}
