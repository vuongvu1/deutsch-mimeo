import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { ChallengeRow } from '@/types/db'

export function useChallenges() {
  return useQuery({
    queryKey: ['challenges'],
    queryFn: async (): Promise<ChallengeRow[]> => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('active', true)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useChallengeBySlug(slug: string) {
  return useQuery({
    queryKey: ['challenge', slug],
    queryFn: async (): Promise<ChallengeRow | null> => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
