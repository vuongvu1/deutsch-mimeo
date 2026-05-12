import { useQuery } from '@tanstack/react-query'

import { daysAgoLocalDate, todayLocalDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import type { ChallengeRow, UserId } from '@/types/db'

export interface UserStatsForChallenge {
  todaySeconds: number
  weekSeconds: number
  monthSeconds: number
  allTimeSeconds: number
  longestSessionSeconds: number
  activeVideoCount: number
  watchedVideoCount: number
  goalCompleteToday: boolean
  daysCompleteAllChallenges: number
  totalDistinctActiveDays: number
}

async function fetchUserStats(
  userId: UserId,
  challenge: ChallengeRow,
): Promise<UserStatsForChallenge> {
  const today = todayLocalDate()
  const weekStart = daysAgoLocalDate(6) // 7-day window inclusive of today
  const monthStart = daysAgoLocalDate(29)

  // Sessions for the relevant challenge
  const sessionsRes = await supabase
    .from('sessions')
    .select('seconds, local_date')
    .eq('user_id', userId)
    .eq('challenge_id', challenge.id)

  if (sessionsRes.error) throw sessionsRes.error
  const sessions = sessionsRes.data ?? []

  let todaySeconds = 0
  let weekSeconds = 0
  let monthSeconds = 0
  let allTimeSeconds = 0
  let longestSessionSeconds = 0
  const distinctActiveDays = new Set<string>()
  for (const s of sessions) {
    allTimeSeconds += s.seconds
    if (s.seconds > longestSessionSeconds) longestSessionSeconds = s.seconds
    distinctActiveDays.add(s.local_date)
    if (s.local_date === today) todaySeconds += s.seconds
    if (s.local_date >= weekStart) weekSeconds += s.seconds
    if (s.local_date >= monthStart) monthSeconds += s.seconds
  }

  // Days complete all challenges (uses view)
  const completionRes = await supabase
    .from('daily_completion')
    .select('local_date, all_complete')
    .eq('user_id', userId)
    .eq('all_complete', true)
  if (completionRes.error) throw completionRes.error

  const [activeRes, watchedRes] = await Promise.all([
    supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('watched_at', null),
    supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('watched_at', 'is', null),
  ])
  if (activeRes.error) throw activeRes.error
  if (watchedRes.error) throw watchedRes.error

  return {
    todaySeconds,
    weekSeconds,
    monthSeconds,
    allTimeSeconds,
    longestSessionSeconds,
    activeVideoCount: activeRes.count ?? 0,
    watchedVideoCount: watchedRes.count ?? 0,
    goalCompleteToday: todaySeconds >= challenge.daily_goal_seconds,
    daysCompleteAllChallenges: completionRes.data?.length ?? 0,
    totalDistinctActiveDays: distinctActiveDays.size,
  }
}

export function useUserStats(userId: UserId | undefined, challenge: ChallengeRow | undefined) {
  return useQuery({
    queryKey: ['stats', userId, challenge?.id],
    enabled: !!userId && !!challenge,
    queryFn: () => fetchUserStats(userId!, challenge!),
  })
}

export interface ComparisonStats {
  mi: UserStatsForChallenge
  meo: UserStatsForChallenge
}

export function useComparisonStats(challenge: ChallengeRow | undefined) {
  return useQuery({
    queryKey: ['comparison-stats', challenge?.id],
    enabled: !!challenge,
    queryFn: async (): Promise<ComparisonStats> => {
      const [mi, meo] = await Promise.all([
        fetchUserStats('mi', challenge!),
        fetchUserStats('meo', challenge!),
      ])
      return { mi, meo }
    },
  })
}

export function useTodaySecondsForChallenge(
  userId: UserId | undefined,
  challengeId: string | undefined,
) {
  const today = todayLocalDate()
  return useQuery({
    queryKey: ['today-seconds', userId, challengeId, today],
    enabled: !!userId && !!challengeId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('sessions')
        .select('seconds')
        .eq('user_id', userId!)
        .eq('challenge_id', challengeId!)
        .eq('local_date', today)
      if (error) throw error
      return (data ?? []).reduce((sum, s) => sum + s.seconds, 0)
    },
  })
}

export interface RecentSessionEntry {
  id: string
  user_id: UserId
  video_id: string | null
  seconds: number
  started_at: string
  updated_at: string
  video_title: string | null
  video_youtube_id: string | null
}

export function useRecentSessions(limit = 10) {
  return useQuery({
    queryKey: ['recent-sessions', limit],
    queryFn: async (): Promise<RecentSessionEntry[]> => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, user_id, video_id, seconds, started_at, updated_at, videos(title, youtube_id)')
        .gt('seconds', 0)
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      type Row = {
        id: string
        user_id: UserId
        video_id: string | null
        seconds: number
        started_at: string
        updated_at: string
        videos: { title: string; youtube_id: string } | { title: string; youtube_id: string }[] | null
      }
      return (data ?? []).map((r: Row) => {
        const v = Array.isArray(r.videos) ? (r.videos[0] ?? null) : r.videos
        return {
          id: r.id,
          user_id: r.user_id,
          video_id: r.video_id,
          seconds: r.seconds,
          started_at: r.started_at,
          updated_at: r.updated_at,
          video_title: v?.title ?? null,
          video_youtube_id: v?.youtube_id ?? null,
        }
      })
    },
  })
}

export function useDailyTotalsRange(
  userId: UserId | undefined,
  challengeId: string | undefined,
  fromDate: string,
  toDate: string,
) {
  return useQuery({
    queryKey: ['daily-totals', userId, challengeId, fromDate, toDate],
    enabled: !!userId && !!challengeId,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('sessions')
        .select('seconds, local_date')
        .eq('user_id', userId!)
        .eq('challenge_id', challengeId!)
        .gte('local_date', fromDate)
        .lte('local_date', toDate)
      if (error) throw error
      const map: Record<string, number> = {}
      for (const row of data ?? []) {
        map[row.local_date] = (map[row.local_date] ?? 0) + row.seconds
      }
      return map
    },
  })
}
