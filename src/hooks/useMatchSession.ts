import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { todayLocalDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import type { UserId } from '@/types/db'

interface Args {
  userId: UserId
  challengeId: string
  enabled: boolean
}

interface State {
  sessionId: string | null
  matches: number
}

const FLUSH_EVERY_MATCHES = 5

/**
 * Event-based session tracker for the vocab match-pairs game: each correct
 * match calls `incrementMatch()`, which bumps an in-memory counter and
 * periodically flushes to the `sessions` row (reusing the `seconds` column
 * as a generic integer counter — 1 unit = 1 correct match).
 *
 * Mirrors the lifecycle of useSessionTracker (flush on visibility-hidden,
 * beforeunload, unmount) but does not auto-tick.
 */
export function useMatchSession({ userId, challengeId, enabled }: Args) {
  const qc = useQueryClient()
  const [state, setState] = useState<State>({ sessionId: null, matches: 0 })
  const stateRef = useRef(state)
  stateRef.current = state

  const flushingRef = useRef(false)
  const incrementsSinceFlushRef = useRef(0)

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (stateRef.current.sessionId) return stateRef.current.sessionId
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        challenge_id: challengeId,
        video_id: null,
        seconds: 0,
        local_date: todayLocalDate(),
      })
      .select('id')
      .single()
    if (error) {
      console.error('Failed to create vocab session', error)
      return null
    }
    setState((s) => ({ ...s, sessionId: data.id }))
    return data.id
  }, [userId, challengeId])

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    const id = stateRef.current.sessionId
    const matches = stateRef.current.matches
    if (!id || matches <= 0) return
    flushingRef.current = true
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ seconds: matches, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) console.error('Failed to flush vocab session', error)
      qc.invalidateQueries({ queryKey: ['today-seconds', userId, challengeId] })
      qc.invalidateQueries({ queryKey: ['stats', userId] })
      qc.invalidateQueries({ queryKey: ['comparison-stats'] })
      qc.invalidateQueries({ queryKey: ['recent-sessions'] })
    } finally {
      flushingRef.current = false
      incrementsSinceFlushRef.current = 0
    }
  }, [qc, userId, challengeId])

  const incrementMatch = useCallback(async () => {
    await ensureSession()
    setState((s) => ({ ...s, matches: s.matches + 1 }))
    incrementsSinceFlushRef.current += 1
    if (incrementsSinceFlushRef.current >= FLUSH_EVERY_MATCHES) {
      void flush()
    }
  }, [ensureSession, flush])

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

  useEffect(() => {
    return () => {
      void flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    matchesInSession: state.matches,
    incrementMatch,
  }
}
