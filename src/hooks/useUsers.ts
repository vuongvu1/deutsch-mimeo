import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { UserId, UserRow } from '@/types/db'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<UserRow[]> => {
      const { data, error } = await supabase.from('users').select('*').order('id')
      if (error) throw error
      return data
    },
  })
}

export function useUser(userId: UserId | undefined) {
  return useQuery({
    queryKey: ['user', userId],
    enabled: !!userId,
    queryFn: async (): Promise<UserRow | null> => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
