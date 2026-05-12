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
        .order('position', { ascending: true })
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
      const { data: minRow, error: minErr } = await supabase
        .from('videos')
        .select('position')
        .eq('user_id', input.user_id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (minErr) throw minErr
      const position = (minRow?.position ?? 1) - 1

      const { data, error } = await supabase
        .from('videos')
        .insert({
          user_id: input.user_id,
          youtube_id: input.youtube_id,
          title: input.title,
          note: input.note ?? null,
          position,
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

interface AddVideosBulkInput {
  user_id: UserId
  items: { youtube_id: string; title: string }[]
}

export function useAddVideosBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddVideosBulkInput): Promise<VideoRow[]> => {
      if (input.items.length === 0) return []
      const { data: minRow, error: minErr } = await supabase
        .from('videos')
        .select('position')
        .eq('user_id', input.user_id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (minErr) throw minErr
      const minPos = minRow?.position ?? 1
      const rows = input.items.map((item, idx) => ({
        user_id: input.user_id,
        youtube_id: item.youtube_id,
        title: item.title,
        position: minPos - input.items.length + idx,
      }))
      const { data, error } = await supabase.from('videos').insert(rows).select()
      if (error) throw error
      return data
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ['videos', input.user_id] })
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

interface ReorderInput {
  user_id: UserId
  orderedIds: string[]
}

export function useReorderVideos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ReorderInput) => {
      const results = await Promise.all(
        input.orderedIds.map((id, idx) =>
          supabase.from('videos').update({ position: idx + 1 }).eq('id', id),
        ),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
      return input
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['videos', input.user_id] })
      const previous = qc.getQueryData<VideoRow[]>(['videos', input.user_id])
      if (previous) {
        const byId = new Map(previous.map((v) => [v.id, v]))
        const reorderedSet = new Set(input.orderedIds)
        const reordered = input.orderedIds
          .map((id, idx) => {
            const v = byId.get(id)
            return v ? { ...v, position: idx + 1 } : null
          })
          .filter((v): v is VideoRow => v !== null)
        const others = previous.filter((v) => !reorderedSet.has(v.id))
        const merged = [...reordered, ...others].sort((a, b) => a.position - b.position)
        qc.setQueryData(['videos', input.user_id], merged)
      }
      return { previous }
    },
    onError: (_err, input, context) => {
      if (context?.previous) {
        qc.setQueryData(['videos', input.user_id], context.previous)
      }
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: ['videos', input.user_id] })
    },
  })
}
