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

const FLUSH_EVERY_ROUNDS = 1

/**
 * Event-based session tracker for the vocab match-pairs game: each
 * completed round (a board cleared of all pairs) calls `incrementRound()`,
 * which bumps an in-memory counter and flushes to the `sessions` row
 * (reusing the `seconds` column as a generic integer counter —
 * 1 unit = 1 round completed).
 *
 * State that flush reads (rounds, sessionId) lives in refs so it stays
 * synchronously up-to-date — `setState` is async, so reading from a
 * stateRef right after setState would always be one tick behind.
 * Flushes are chained via flushChainRef so an unmount flush can't be
 * dropped because an earlier flush is mid-request.
 */
export function useMatchSession({ userId, challengeId, enabled }: Args) {
  const qc = useQueryClient()
  const [rounds, setRounds] = useState(0)

  const roundsRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const ensurePromiseRef = useRef<Promise<string | null> | null>(null)
  const flushChainRef = useRef<Promise<void>>(Promise.resolve())
  const lastFlushedRef = useRef(0)
  const incrementsSinceFlushRef = useRef(0)

  const ensureSession = useCallback((): Promise<string | null> => {
    if (sessionIdRef.current) return Promise.resolve(sessionIdRef.current)
    if (ensurePromiseRef.current) return ensurePromiseRef.current
    ensurePromiseRef.current = (async () => {
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
      if (error || !data) {
        console.error('Failed to create vocab session', error)
        ensurePromiseRef.current = null
        return null
      }
      sessionIdRef.current = data.id
      return data.id
    })()
    return ensurePromiseRef.current
  }, [userId, challengeId])

  const flush = useCallback((): Promise<void> => {
    const next = flushChainRef.current.then(async () => {
      if (roundsRef.current === 0) return
      if (roundsRef.current === lastFlushedRef.current) return
      const id = sessionIdRef.current ?? (await ensureSession())
      if (!id) return
      const value = roundsRef.current
      const { error } = await supabase
        .from('sessions')
        .update({ seconds: value, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        console.error('Failed to flush vocab session', error)
        return
      }
      lastFlushedRef.current = value
      incrementsSinceFlushRef.current = 0
      qc.invalidateQueries({ queryKey: ['today-seconds', userId, challengeId] })
      qc.invalidateQueries({ queryKey: ['stats', userId] })
      qc.invalidateQueries({ queryKey: ['comparison-stats'] })
      qc.invalidateQueries({ queryKey: ['recent-sessions'] })
    })
    flushChainRef.current = next.catch(() => {})
    return next
  }, [qc, userId, challengeId, ensureSession])

  const incrementRound = useCallback(async () => {
    roundsRef.current += 1
    incrementsSinceFlushRef.current += 1
    setRounds(roundsRef.current)
    void ensureSession()
    if (incrementsSinceFlushRef.current >= FLUSH_EVERY_ROUNDS) {
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
    roundsInSession: rounds,
    incrementRound,
  }
}
