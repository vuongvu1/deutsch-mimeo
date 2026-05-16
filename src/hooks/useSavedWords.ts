import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { SavedWordRow, UserId } from '@/types/db'

export function useSavedWords(userId: UserId | undefined) {
  return useQuery({
    queryKey: ['saved-words', userId],
    enabled: !!userId,
    queryFn: async (): Promise<SavedWordRow[]> => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('saved_words')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

interface SaveWordInput {
  user_id: UserId
  de: string
  en: string
}

export function useSaveWord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveWordInput): Promise<SavedWordRow> => {
      const { data, error } = await supabase
        .from('saved_words')
        .upsert(
          {
            user_id: input.user_id,
            de: input.de,
            en: input.en,
          },
          { onConflict: 'user_id,de', ignoreDuplicates: false },
        )
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['saved-words', row.user_id] })
    },
  })
}

export function useUnsaveWord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { user_id: UserId; de: string }) => {
      const { error } = await supabase
        .from('saved_words')
        .delete()
        .eq('user_id', input.user_id)
        .eq('de', input.de)
      if (error) throw error
      return input
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ['saved-words', input.user_id] })
    },
  })
}
