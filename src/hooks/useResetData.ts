import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export function useResetData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const sessionsRes = await supabase.from('sessions').delete().not('id', 'is', null)
      if (sessionsRes.error) throw sessionsRes.error
      const videosRes = await supabase.from('videos').delete().not('id', 'is', null)
      if (videosRes.error) throw videosRes.error
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}

export function useClearSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sessions').delete().not('id', 'is', null)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}
