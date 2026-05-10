import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { UserId, VideoRow } from '@/types/db'

export function useVideos(userId: UserId | undefined) {
  return useQuery({
    queryKey: ['videos', userId],
    enabled: !!userId,
    queryFn: async (): Promise<VideoRow[]> => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useVideo(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video', videoId],
    enabled: !!videoId,
    queryFn: async (): Promise<VideoRow | null> => {
      if (!videoId) return null
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

interface AddVideoInput {
  user_id: UserId
  youtube_id: string
  title: string
  note?: string | null
}

export function useAddVideo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddVideoInput): Promise<VideoRow> => {
      const { data, error } = await supabase
        .from('videos')
        .insert({
          user_id: input.user_id,
          youtube_id: input.youtube_id,
          title: input.title,
          note: input.note ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (video) => {
      qc.invalidateQueries({ queryKey: ['videos', video.user_id] })
    },
  })
}

export function useDeleteVideo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; user_id: UserId }) => {
      const { error } = await supabase.from('videos').delete().eq('id', input.id)
      if (error) throw error
      return input
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ['videos', input.user_id] })
    },
  })
}

export function useSetVideoWatched() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; user_id: UserId; watched: boolean }) => {
      const { error } = await supabase
        .from('videos')
        .update({ watched_at: input.watched ? new Date().toISOString() : null })
        .eq('id', input.id)
      if (error) throw error
      return input
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ['videos', input.user_id] })
      qc.invalidateQueries({ queryKey: ['video', input.id] })
    },
  })
}
