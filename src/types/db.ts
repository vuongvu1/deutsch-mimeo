export type UserId = 'mi' | 'meo'

export interface UserRow {
  id: UserId
  display_name: string
  emoji: string
}

export interface ChallengeRow {
  id: string
  slug: string
  title: string
  description: string | null
  daily_goal_seconds: number
  active: boolean
  optional: boolean
  sort_order: number
  created_at: string
}

export interface VideoRow {
  id: string
  user_id: UserId
  youtube_id: string
  title: string
  note: string | null
  watched_at: string | null
  position: number
  last_position_seconds: number
  created_at: string
}

export interface SessionRow {
  id: string
  user_id: UserId
  challenge_id: string
  video_id: string | null
  seconds: number
  local_date: string
  started_at: string
  updated_at: string
}

export interface DailyChallengeTotalRow {
  user_id: UserId
  challenge_id: string
  local_date: string
  total_seconds: number
}

export interface DailyCompletionRow {
  user_id: UserId
  local_date: string
  all_complete: boolean
  active_challenges_count: number
  completed_count: number
}

export interface SavedWordRow {
  id: string
  user_id: UserId
  de: string
  en: string
  note: string | null
  created_at: string
}

export type ListeningLevel = 'A1' | 'A2' | 'B1' | 'B2'

export type ListeningQuestionType = 'richtig_falsch' | 'multiple_choice'

export interface ListeningQuestion {
  type: ListeningQuestionType
  q: string
  options: string[]
  correctIndex: number
  explanationDe: string
  explanationEn: string
}

export interface ListeningExercise {
  transcript: string
  questions: ListeningQuestion[]
}

export interface ListeningRoundInsert {
  user_id: UserId
  challenge_id: string
  local_date: string
  level: ListeningLevel
  target_minutes: number
  num_questions: number
  transcript: string
  questions: ListeningQuestion[]
  answers: number[]
  score: number
  max_score: number
  passed: boolean
}

export interface ListeningRoundRow extends ListeningRoundInsert {
  id: string
  created_at: string
}
