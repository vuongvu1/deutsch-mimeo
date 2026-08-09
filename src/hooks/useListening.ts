import { useMutation, useQueryClient } from '@tanstack/react-query'

import { LISTENING_CHALLENGE_ID } from '@/hooks/useChallenges'
import { todayLocalDate } from '@/lib/dates'
import { pingProgress } from '@/lib/notify'
import { supabase } from '@/lib/supabase'
import type { ListeningExercise, ListeningLevel, ListeningRoundInsert, UserId } from '@/types/db'

export interface GenerateInput {
  level: ListeningLevel
  targetMinutes: number
  numQuestions: number
}

export function useGenerateListeningExercise() {
  return useMutation({
    mutationFn: async (input: GenerateInput): Promise<ListeningExercise> => {
      const res = await fetch('/api/listening/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error ?? `HTTP ${res.status}`)
      }
      return (await res.json()) as ListeningExercise
    },
  })
}

export interface SubmitInput {
  userId: UserId
  level: ListeningLevel
  targetMinutes: number
  numQuestions: number
  exercise: ListeningExercise
  answers: number[]
}

export interface SubmitResult {
  score: number
  maxScore: number
  passed: boolean
}

export function useSubmitListeningRound() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SubmitInput): Promise<SubmitResult> => {
      const maxScore = input.exercise.questions.length
      let score = 0
      input.exercise.questions.forEach((q, i) => {
        if (input.answers[i] === q.correctIndex) score += 1
      })
      const passed = score / maxScore > 0.5
      const local_date = todayLocalDate()
      const row: ListeningRoundInsert = {
        user_id: input.userId,
        challenge_id: LISTENING_CHALLENGE_ID,
        local_date,
        level: input.level,
        target_minutes: input.targetMinutes,
        num_questions: input.numQuestions,
        transcript: input.exercise.transcript,
        questions: input.exercise.questions,
        answers: input.answers,
        score,
        max_score: maxScore,
        passed,
      }
      const { error: insertErr } = await supabase.from('listening_rounds').insert(row)
      if (insertErr) throw insertErr

      // Submit = day done. The score and `passed` flag are kept in the row for
      // stats, but they don't gate the daily checkmark.
      const { error: sessErr } = await supabase.from('sessions').insert({
        user_id: input.userId,
        challenge_id: LISTENING_CHALLENGE_ID,
        video_id: null,
        seconds: 1,
        local_date,
      })
      if (sessErr) throw sessErr
      pingProgress(input.userId, LISTENING_CHALLENGE_ID)
      qc.invalidateQueries({ queryKey: ['today-seconds', input.userId, LISTENING_CHALLENGE_ID] })
      qc.invalidateQueries({ queryKey: ['stats', input.userId] })
      qc.invalidateQueries({ queryKey: ['comparison-stats'] })
      qc.invalidateQueries({ queryKey: ['users-today-status'] })
      qc.invalidateQueries({ queryKey: ['daily-totals'] })

      return { score, maxScore, passed }
    },
  })
}
