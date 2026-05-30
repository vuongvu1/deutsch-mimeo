import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { todayLocalDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import type { UserId } from '@/types/db'

interface Args {
  userId: UserId
  challengeId: string
  videoId: string
  // True only while watch-together is on AND the source video is playing.
  active: boolean
  // Seconds credited per real second of playback. >1 = cheat mode. Mirrors the
  // active user's tracker so both timers tick identically.
  secondsPerTick?: number
}

const FLUSH_EVERY_TICKS = 10 // flush to DB every 10s of play

/**
 * Mirrors watched-together seconds onto a partner's `sessions` row (same
 * video_id as the active user's video). Counts only while `active`. Shares the
 * same flush-safety as useSessionTracker, minus the video-position logic.
 */
export function usePartnerSession({
  userId,
  challengeId,
  videoId,
  active,
  secondsPerTick = 1,
}: Args) {
  const qc = useQueryClient()
  const secondsPerTickRef = useRef(secondsPerTick)
  secondsPerTickRef.current = secondsPerTick

  const [sessionSeconds, setSessionSeconds] = useState(0)
  const secondsRef = useRef(0)
  secondsRef.current = sessionSeconds
  const sessionIdRef = useRef<string | null>(null)
  const creatingRef = useRef(false)
  const flushingRef = useRef(false)
  const ticksSinceFlushRef = useRef(0)

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current
    if (creatingRef.current) return null
    creatingRef.current = true
    try {
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
        console.error('Failed to create partner session', error)
        return null
      }
      sessionIdRef.current = data.id
      return data.id
    } finally {
      creatingRef.current = false
    }
  }, [userId, challengeId, videoId])

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    const id = sessionIdRef.current
    const seconds = secondsRef.current
    if (!id || seconds <= 0) return
    flushingRef.current = true
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ seconds, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) console.error('Failed to flush partner session', error)
      qc.invalidateQueries({ queryKey: ['today-seconds', userId, challengeId] })
      qc.invalidateQueries({ queryKey: ['stats', userId] })
      qc.invalidateQueries({ queryKey: ['comparison-stats'] })
      qc.invalidateQueries({ queryKey: ['recent-sessions'] })
    } finally {
      flushingRef.current = false
      ticksSinceFlushRef.current = 0
    }
  }, [qc, userId, challengeId])

  // Create the partner session the first time it goes active.
  useEffect(() => {
    if (active) void ensureSession()
  }, [active, ensureSession])

  // 1-second tick while active.
  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(() => {
      setSessionSeconds((s) => s + secondsPerTickRef.current)
      ticksSinceFlushRef.current += 1
      if (ticksSinceFlushRef.current >= FLUSH_EVERY_TICKS) {
        void flush()
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [active, flush])

  // Flush whenever it deactivates (toggle off / pause). No-op before first tick.
  useEffect(() => {
    if (active) return
    void flush()
  }, [active, flush])

  // Flush when tab is hidden or page is unloaded.
  useEffect(() => {
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
  }, [flush])

  // biome-ignore lint/correctness/useExhaustiveDependencies: final flush on unmount only
  useEffect(() => {
    return () => {
      void flush()
    }
  }, [])

  return { sessionSeconds }
}
