import type { ChallengeRow } from '@/types/db'

export const LISTEN_CHALLENGE_ID = '00000000-0000-4000-8000-000000000001'

const CHALLENGES: readonly ChallengeRow[] = [
  {
    id: LISTEN_CHALLENGE_ID,
    slug: 'listen',
    title: 'Listen 30 min/day',
    description: 'Watch German YouTube videos for at least 30 minutes total each day.',
    daily_goal_seconds: 1800,
    active: true,
    sort_order: 0,
    created_at: '1970-01-01T00:00:00.000Z',
  },
]

const CHALLENGES_BY_SLUG: Record<string, ChallengeRow | undefined> = Object.fromEntries(
  CHALLENGES.map((c) => [c.slug, c]),
)

export function useChallenges() {
  return { data: CHALLENGES as ChallengeRow[], isLoading: false, error: null }
}

export function useChallengeBySlug(slug: string) {
  return { data: CHALLENGES_BY_SLUG[slug] ?? null, isLoading: false, error: null }
}
