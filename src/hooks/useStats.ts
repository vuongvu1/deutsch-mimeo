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
  videoCount: number
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

  const videosRes = await supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (videosRes.error) throw videosRes.error

  return {
    todaySeconds,
    weekSeconds,
    monthSeconds,
    allTimeSeconds,
    longestSessionSeconds,
    videoCount: videosRes.count ?? 0,
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
