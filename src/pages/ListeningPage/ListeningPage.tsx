import {
  CheckCircledIcon,
  CrossCircledIcon,
  EyeNoneIcon,
  EyeOpenIcon,
  PauseIcon,
  PlayIcon,
  ReloadIcon,
  SpeakerOffIcon,
} from '@radix-ui/react-icons'
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Container,
  Flex,
  Heading,
  IconButton,
  RadioGroup,
  Select,
  Spinner,
  Switch,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'

import { MuteToggle } from '@/components/MuteToggle'
import { ProgressBar } from '@/components/ProgressBar'
import { TopBar } from '@/components/TopBar'
import { LISTENING_CHALLENGE_ID, useChallengeBySlug } from '@/hooks/useChallenges'
import {
  type GenerateInput,
  useGenerateListeningExercise,
  useSubmitListeningRound,
} from '@/hooks/useListening'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { todayLocalDate } from '@/lib/dates'
import {
  cancelLongForm,
  getLongFormProgress,
  getLongFormProgressRatio,
  getLongFormState,
  pauseLongForm,
  resumeLongForm,
  type SpeechProgress,
  type SpeechState,
  speakLongForm,
  splitTranscriptSentences,
  subscribeLongFormProgress,
  subscribeLongFormState,
} from '@/lib/longFormSpeech'
import { isMuted, subscribeMute } from '@/lib/sounds'
import { supabase } from '@/lib/supabase'
import { paths } from '@/routes/paths'
import type { ListeningExercise, ListeningLevel, UserId } from '@/types/db'

import styles from './ListeningPage.module.css'

const LEVELS: ListeningLevel[] = ['A1', 'A2', 'B1', 'B2']
const MINUTES = [1, 2, 3, 5] as const
const QUESTION_COUNTS = [5, 10, 15] as const

// Goethe plays the audio once or twice depending on level/part; in exam mode we
// cap the number of fresh playthroughs per round to match.
const EXAM_PLAY_LIMIT: Record<ListeningLevel, number> = { A1: 2, A2: 2, B1: 2, B2: 1 }

const STORAGE_PREFIX = 'mimeo:listening:'
const lvKey = (u: UserId) => `${STORAGE_PREFIX}level:${u}`
const mnKey = (u: UserId) => `${STORAGE_PREFIX}minutes:${u}`
const qsKey = (u: UserId) => `${STORAGE_PREFIX}questions:${u}`
const exKey = (u: UserId) => `${STORAGE_PREFIX}exam:${u}`

type Phase =
  | { kind: 'setup'; error?: string }
  | { kind: 'loading' }
  | { kind: 'listening'; exercise: ListeningExercise; selection: GenerateInput; examMode: boolean }
  | {
      kind: 'answering'
      exercise: ListeningExercise
      selection: GenerateInput
      examMode: boolean
      answers: (number | null)[]
    }
  | {
      kind: 'results'
      exercise: ListeningExercise
      selection: GenerateInput
      answers: number[]
      score: number
      passed: boolean
    }

function loadStored<T>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const raw = window.localStorage.getItem(key)
  if (raw == null) return fallback
  const parsed = Number.isNaN(Number(raw)) ? raw : Number(raw)
  return (allowed as readonly unknown[]).includes(parsed) ? (parsed as T) : fallback
}

function loadExamMode(userId: UserId): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(exKey(userId)) === '1'
}

interface DailyCache {
  date: string
  exercise: ListeningExercise
  selection: GenerateInput
  examMode: boolean
  submitted?: {
    answers: number[]
    score: number
    passed: boolean
  }
}

// Bumped to daily.v2 when questions gained a `type` field — old in-progress
// caches lack it, so invalidating them avoids rendering a half-shaped round.
const cacheKey = (u: UserId) => `${STORAGE_PREFIX}daily.v2:${u}`

function loadDailyCache(userId: UserId, today: string): DailyCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(cacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DailyCache
    if (parsed.date !== today) return null
    return parsed
  } catch {
    return null
  }
}

function saveDailyCache(userId: UserId, cache: DailyCache): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(cacheKey(userId), JSON.stringify(cache))
}

function clearDailyCache(userId: UserId): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(cacheKey(userId))
}

export function ListeningPage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const challenge = useChallengeBySlug('listening').data
  const todayQuery = useTodaySecondsForChallenge(userId as UserId | undefined, challenge?.id)

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />
  if (!challenge) return <Navigate to={paths.challenges(user.id)} replace />

  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.challenges(user.id) }}
        title={t('listening.pageTitle')}
        emoji={t('listening.pageTitleEmoji')}
        rightSlot={<MuteToggle />}
      />
      <Game user={user} goal={challenge.daily_goal_seconds} todaySeconds={todayQuery.data ?? 0} />
    </Container>
  )
}

interface GameProps {
  user: { id: UserId; display_name: string; emoji: string }
  goal: number
  todaySeconds: number
}

function Game({ user, goal, todaySeconds }: GameProps) {
  const { t } = useTranslation()

  const generate = useGenerateListeningExercise()
  const submit = useSubmitListeningRound()

  const [level, setLevel] = useState<ListeningLevel>(() =>
    loadStored<ListeningLevel>(lvKey(user.id), LEVELS, 'A2'),
  )
  const [targetMinutes, setTargetMinutes] = useState<number>(() =>
    loadStored<number>(mnKey(user.id), MINUTES, 1),
  )
  const [numQuestions, setNumQuestions] = useState<number>(() =>
    loadStored<number>(qsKey(user.id), QUESTION_COUNTS, 5),
  )
  const [examMode, setExamMode] = useState<boolean>(() => loadExamMode(user.id))
  // Fresh playthroughs used in the current round (only enforced in exam mode).
  const [playsUsed, setPlaysUsed] = useState(0)

  // Initial phase: resume today's cached exercise if there is one.
  const [phase, setPhase] = useState<Phase>(() => {
    const cached = loadDailyCache(user.id, todayLocalDate())
    if (!cached) return { kind: 'setup' }
    if (cached.submitted) {
      return {
        kind: 'results',
        exercise: cached.exercise,
        selection: cached.selection,
        answers: cached.submitted.answers,
        score: cached.submitted.score,
        passed: cached.submitted.passed,
      }
    }
    return {
      kind: 'listening',
      exercise: cached.exercise,
      selection: cached.selection,
      examMode: cached.examMode ?? false,
    }
  })

  useEffect(() => {
    return () => {
      cancelLongForm()
    }
  }, [])

  // Liveness for the home-page "is doing X" badge. useUsersTodayStatus only
  // considers a session "active" if its updated_at is within the last 45 s,
  // and our listening submit doesn't write any session row until the user
  // taps Submit. So while they're actually listening or answering — the
  // moment we most want the badge to show — there's nothing for it to see.
  // Mirror what useMatchSession does for vocab: drop a seconds=0 row on
  // first engagement, then keep touching its updated_at while engaged.
  const qc = useQueryClient()
  const livenessSessionIdRef = useRef<string | null>(null)
  const isLive =
    phase.kind === 'loading' || phase.kind === 'listening' || phase.kind === 'answering'
  useEffect(() => {
    if (!isLive) return
    let cancelled = false
    const ping = async () => {
      if (cancelled) return
      try {
        if (!livenessSessionIdRef.current) {
          const { data, error } = await supabase
            .from('sessions')
            .insert({
              user_id: user.id,
              challenge_id: LISTENING_CHALLENGE_ID,
              video_id: null,
              seconds: 0,
              local_date: todayLocalDate(),
            })
            .select('id')
            .single()
          if (cancelled || error || !data) return
          livenessSessionIdRef.current = data.id
        } else {
          await supabase
            .from('sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', livenessSessionIdRef.current)
          if (cancelled) return
        }
        qc.invalidateQueries({ queryKey: ['users-today-status'] })
      } catch (err) {
        console.warn('[listening] liveness ping failed', err)
      }
    }
    void ping()
    const timerId = window.setInterval(() => void ping(), 20_000)
    return () => {
      cancelled = true
      window.clearInterval(timerId)
    }
  }, [isLive, user.id, qc])

  const complete = todaySeconds >= goal

  // Replay cap for the active round. Outside exam mode the limit is infinite, so
  // the counter is inert and free-replay behaviour is unchanged.
  const activeExamMode =
    phase.kind === 'listening' || phase.kind === 'answering' ? phase.examMode : false
  const activeLevel =
    phase.kind === 'listening' || phase.kind === 'answering' || phase.kind === 'results'
      ? phase.selection.level
      : level
  const playsLimit = activeExamMode ? EXAM_PLAY_LIMIT[activeLevel] : Number.POSITIVE_INFINITY
  const canPlay = playsUsed < playsLimit
  function consumePlay(): boolean {
    if (playsUsed >= playsLimit) return false
    setPlaysUsed((n) => n + 1)
    return true
  }

  function start() {
    const selection: GenerateInput = { level, targetMinutes, numQuestions }
    window.localStorage.setItem(lvKey(user.id), level)
    window.localStorage.setItem(mnKey(user.id), String(targetMinutes))
    window.localStorage.setItem(qsKey(user.id), String(numQuestions))
    window.localStorage.setItem(exKey(user.id), examMode ? '1' : '0')
    setPhase({ kind: 'loading' })
    generate.mutate(selection, {
      onSuccess: (exercise) => {
        saveDailyCache(user.id, { date: todayLocalDate(), exercise, selection, examMode })
        setPlaysUsed(1)
        setPhase({ kind: 'listening', exercise, selection, examMode })
        speakLongForm(exercise.transcript)
      },
      onError: (err) => {
        setPhase({ kind: 'setup', error: err instanceof Error ? err.message : 'Unknown error' })
      },
    })
  }

  // Back to the setup screen so the user can adjust level/length/questions
  // before generating a new text. Their current selections are preserved in
  // the level/targetMinutes/numQuestions state, so the dropdowns are
  // pre-filled. They can change anything (or nothing) and tap Start.
  function regenerate() {
    cancelLongForm()
    clearDailyCache(user.id)
    setPlaysUsed(0)
    setPhase({ kind: 'setup' })
  }

  function toAnswering() {
    if (phase.kind !== 'listening') return
    cancelLongForm()
    setPhase({
      kind: 'answering',
      exercise: phase.exercise,
      selection: phase.selection,
      examMode: phase.examMode,
      answers: new Array(phase.exercise.questions.length).fill(null),
    })
  }

  function backToListening() {
    if (phase.kind !== 'answering') return
    if (phase.examMode && !canPlay) return
    if (phase.examMode) setPlaysUsed((n) => n + 1)
    setPhase({
      kind: 'listening',
      exercise: phase.exercise,
      selection: phase.selection,
      examMode: phase.examMode,
    })
    speakLongForm(phase.exercise.transcript)
  }

  function setAnswer(idx: number, value: number) {
    if (phase.kind !== 'answering') return
    const answers = [...phase.answers]
    answers[idx] = value
    setPhase({ ...phase, answers })
  }

  function doSubmit() {
    if (phase.kind !== 'answering') return
    if (phase.answers.some((a) => a == null)) return
    const finalAnswers = phase.answers as number[]
    submit.mutate(
      {
        userId: user.id,
        level: phase.selection.level,
        targetMinutes: phase.selection.targetMinutes,
        numQuestions: phase.selection.numQuestions,
        exercise: phase.exercise,
        answers: finalAnswers,
      },
      {
        onSuccess: (res) => {
          saveDailyCache(user.id, {
            date: todayLocalDate(),
            exercise: phase.exercise,
            selection: phase.selection,
            examMode: phase.examMode,
            submitted: { answers: finalAnswers, score: res.score, passed: res.passed },
          })
          setPhase({
            kind: 'results',
            exercise: phase.exercise,
            selection: phase.selection,
            answers: finalAnswers,
            score: res.score,
            passed: res.passed,
          })
        },
      },
    )
  }

  function newRound() {
    cancelLongForm()
    clearDailyCache(user.id)
    setPlaysUsed(0)
    setPhase({ kind: 'setup' })
  }

  const currentSelection =
    phase.kind === 'listening' || phase.kind === 'answering' || phase.kind === 'results'
      ? phase.selection
      : null

  return (
    <Flex direction="column" gap="4">
      <Card size="2" variant="surface">
        <Flex direction="column" gap="2">
          <Flex justify="between" align="baseline">
            <Text size="2" weight="medium">
              {t('listening.today')}
            </Text>
            <Text size="2" color="gray" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('listening.rounds', { count: todaySeconds })} /{' '}
              {t('listening.rounds', { count: goal })}
            </Text>
          </Flex>
          <ProgressBar value={todaySeconds} max={goal} complete={complete} />
          {complete ? (
            <Text size="2" color="green" as="div">
              {t('listening.goalReached')}
            </Text>
          ) : null}
          {currentSelection ? (
            <SelectionSummary selection={currentSelection} examMode={activeExamMode} />
          ) : null}
        </Flex>
      </Card>

      {phase.kind === 'setup' ? (
        <SetupCard
          level={level}
          targetMinutes={targetMinutes}
          numQuestions={numQuestions}
          examMode={examMode}
          onLevel={setLevel}
          onMinutes={setTargetMinutes}
          onQuestions={setNumQuestions}
          onExamMode={setExamMode}
          onStart={start}
          error={phase.error}
        />
      ) : null}

      {phase.kind === 'loading' ? <LoadingCard /> : null}

      {phase.kind === 'listening' ? (
        <ListeningCard
          exercise={phase.exercise}
          examMode={phase.examMode}
          canPlay={canPlay}
          playsUsed={playsUsed}
          playsLimit={EXAM_PLAY_LIMIT[phase.selection.level]}
          onConsumePlay={consumePlay}
          onReady={toAnswering}
          onRegenerate={regenerate}
        />
      ) : null}

      {phase.kind === 'answering' ? (
        <AnsweringCard
          exercise={phase.exercise}
          examMode={phase.examMode}
          answers={phase.answers}
          onAnswer={setAnswer}
          onSubmit={doSubmit}
          onBackToListening={backToListening}
          replayDisabled={phase.examMode && !canPlay}
          onRegenerate={regenerate}
          submitting={submit.isPending}
        />
      ) : null}

      {phase.kind === 'results' ? (
        <ResultsCard
          user={user}
          exercise={phase.exercise}
          answers={phase.answers}
          score={phase.score}
          passed={phase.passed}
          onNewRound={newRound}
        />
      ) : null}
    </Flex>
  )
}

function SelectionSummary({
  selection,
  examMode,
}: {
  selection: GenerateInput
  examMode: boolean
}) {
  const { t } = useTranslation()
  return (
    <Flex gap="2" wrap="wrap" mt="1">
      <Badge variant="soft" radius="full" color="gray">
        {t(`listening.levels.${selection.level}`)}
      </Badge>
      <Badge variant="soft" radius="full" color="gray">
        {t('listening.setup.minutes', { count: selection.targetMinutes })}
      </Badge>
      <Badge variant="soft" radius="full" color="gray">
        {t('listening.setup.questionsValue', { count: selection.numQuestions })}
      </Badge>
      {examMode ? (
        <Badge variant="soft" radius="full" color="amber">
          {t('listening.setup.examMode')}
        </Badge>
      ) : null}
    </Flex>
  )
}

interface SetupCardProps {
  level: ListeningLevel
  targetMinutes: number
  numQuestions: number
  examMode: boolean
  onLevel: (l: ListeningLevel) => void
  onMinutes: (m: number) => void
  onQuestions: (n: number) => void
  onExamMode: (v: boolean) => void
  onStart: () => void
  error: string | undefined
}

function SetupCard({
  level,
  targetMinutes,
  numQuestions,
  examMode,
  onLevel,
  onMinutes,
  onQuestions,
  onExamMode,
  onStart,
  error,
}: SetupCardProps) {
  const { t } = useTranslation()
  return (
    <Card size="3" variant="surface">
      <Flex direction="column" gap="4">
        <Heading size="4">{t('listening.setup.title')}</Heading>
        <Text size="2" color="gray">
          {t('listening.setup.subtitle')}
        </Text>
        {error ? (
          <Callout.Root color="red" size="1">
            <Callout.Text>{t('listening.setup.error', { reason: error })}</Callout.Text>
          </Callout.Root>
        ) : null}
        <Flex direction={{ initial: 'column', sm: 'row' }} gap="3">
          <Box flexGrow="1">
            <Text size="2" color="gray" weight="medium" as="div" mb="1">
              {t('listening.setup.level')}
            </Text>
            <Select.Root value={level} onValueChange={(v) => onLevel(v as ListeningLevel)} size="2">
              <Select.Trigger />
              <Select.Content>
                {LEVELS.map((l) => (
                  <Select.Item key={l} value={l}>
                    {t(`listening.levels.${l}`)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Box>
          <Box flexGrow="1">
            <Text size="2" color="gray" weight="medium" as="div" mb="1">
              {t('listening.setup.length')}
            </Text>
            <Select.Root
              value={String(targetMinutes)}
              onValueChange={(v) => onMinutes(Number(v))}
              size="2"
            >
              <Select.Trigger />
              <Select.Content>
                {MINUTES.map((m) => (
                  <Select.Item key={m} value={String(m)}>
                    {t('listening.setup.minutes', { count: m })}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Box>
          <Box flexGrow="1">
            <Text size="2" color="gray" weight="medium" as="div" mb="1">
              {t('listening.setup.questions')}
            </Text>
            <Select.Root
              value={String(numQuestions)}
              onValueChange={(v) => onQuestions(Number(v))}
              size="2"
            >
              <Select.Trigger />
              <Select.Content>
                {QUESTION_COUNTS.map((n) => (
                  <Select.Item key={n} value={String(n)}>
                    {t('listening.setup.questionsValue', { count: n })}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Box>
        </Flex>
        <Text as="label" size="2" color="gray" style={{ cursor: 'var(--cursor-switch)' }}>
          <Flex align="center" gap="2">
            <Switch
              color="amber"
              checked={examMode}
              onCheckedChange={onExamMode}
              aria-label={t('listening.setup.examMode')}
            />
            {t('listening.setup.examMode')}
          </Flex>
        </Text>
        <Button size="3" onClick={onStart}>
          {t('listening.setup.startCta')}
        </Button>
      </Flex>
    </Card>
  )
}

function LoadingCard() {
  const { t } = useTranslation()
  return (
    <Card size="3" variant="surface">
      <Flex direction="column" align="center" gap="3" py="6">
        <Spinner size="3" />
        <Text size="3" weight="medium">
          {t('listening.loading.title')}
        </Text>
        <Text size="2" color="gray">
          {t('listening.loading.subtitle')}
        </Text>
      </Flex>
    </Card>
  )
}

interface ListeningCardProps {
  exercise: ListeningExercise
  examMode: boolean
  canPlay: boolean
  playsUsed: number
  playsLimit: number
  onConsumePlay: () => boolean
  onReady: () => void
  onRegenerate: () => void
}

function ListeningCard({
  exercise,
  examMode,
  canPlay,
  playsUsed,
  playsLimit,
  onConsumePlay,
  onReady,
  onRegenerate,
}: ListeningCardProps) {
  const { t } = useTranslation()
  const [speechState, setSpeechState] = useState<SpeechState>(() => getLongFormState())
  const [progress, setProgress] = useState<SpeechProgress | null>(() => getLongFormProgress())
  const [smoothPct, setSmoothPct] = useState<number>(0)
  const [showTranscript, setShowTranscript] = useState(false)
  const [muted, setMutedState] = useState<boolean>(() => isMuted())

  useEffect(() => subscribeLongFormState(setSpeechState), [])
  useEffect(() => subscribeLongFormProgress(setProgress), [])
  useEffect(() => subscribeMute(setMutedState), [])

  // Smooth progress: poll the per-sentence elapsed ratio on every frame and
  // feed it to the Radix progress bar so the fill animates continuously
  // instead of snapping at sentence boundaries.
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    const tick = () => {
      const ratio = getLongFormProgressRatio()
      if (ratio != null) setSmoothPct(ratio * 100)
      rafRef.current = window.requestAnimationFrame(tick)
    }
    rafRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const sentences = useMemo(
    () => splitTranscriptSentences(exercise.transcript),
    [exercise.transcript],
  )

  const activeSentenceRef = useRef<HTMLSpanElement | null>(null)

  function play() {
    if (speechState === 'paused') {
      resumeLongForm()
      return
    }
    if (!onConsumePlay()) return
    speakLongForm(exercise.transcript)
  }

  function pause() {
    pauseLongForm()
  }

  function restart() {
    if (!onConsumePlay()) return
    cancelLongForm()
    speakLongForm(exercise.transcript)
  }

  const playing = speechState === 'speaking'
  const loading = speechState === 'loading'
  const primaryLabel = loading
    ? t('listening.listening.preparing')
    : playing
      ? t('listening.listening.pause')
      : t('listening.listening.play')

  const showProgress = progress != null && progress.engine === 'piper' && progress.total > 1
  const progressCurrent = progress?.current ?? 0
  const progressTotal = progress?.total ?? 0
  const progressBuffered = progress?.buffered ?? 0
  // While Piper is the engine and there's an active session, use the smooth
  // pct from rAF; otherwise fall back to whole-sentence progress.
  const progressValue =
    showProgress && (playing || speechState === 'paused')
      ? smoothPct
      : showProgress
        ? (progressCurrent / Math.max(1, progressTotal)) * 100
        : 0
  const activeSentence =
    progress != null && progress.engine === 'piper' && (playing || speechState === 'paused')
      ? progress.current
      : -1

  // Keep the highlighted sentence in view when the transcript is open.
  useEffect(() => {
    if (!showTranscript || activeSentence < 0) return
    activeSentenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeSentence, showTranscript])

  return (
    <Card size="3" variant="surface">
      <Flex direction="column" gap="4">
        <Heading size="4">{t('listening.listening.title')}</Heading>
        <Text size="2" color="gray">
          {examMode ? t('listening.listening.examSubtitle') : t('listening.listening.subtitle')}
        </Text>
        <Flex gap="2" align="center" wrap="wrap">
          <Tooltip content={primaryLabel}>
            <IconButton
              size="3"
              variant="solid"
              radius="full"
              onClick={playing ? pause : play}
              disabled={loading || (!playing && speechState !== 'paused' && !canPlay)}
              aria-label={primaryLabel}
            >
              {loading ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip content={t('listening.listening.restart')}>
            <IconButton
              size="3"
              variant="soft"
              radius="full"
              onClick={restart}
              disabled={loading || !canPlay}
              aria-label={t('listening.listening.restart')}
            >
              <ReloadIcon />
            </IconButton>
          </Tooltip>
          {examMode ? (
            <Badge color="amber" variant="soft" radius="full">
              {t('listening.listening.plays', {
                used: Math.min(playsUsed, playsLimit),
                limit: playsLimit,
              })}
            </Badge>
          ) : null}
          <Box flexGrow="1" />
          {examMode ? null : (
            <Button
              variant="soft"
              onClick={() => setShowTranscript((v) => !v)}
              aria-pressed={showTranscript}
            >
              {showTranscript ? <EyeNoneIcon /> : <EyeOpenIcon />}
              <span style={{ marginLeft: 6 }}>
                {showTranscript
                  ? t('listening.listening.hideTranscript')
                  : t('listening.listening.showTranscript')}
              </span>
            </Button>
          )}
        </Flex>
        {muted ? (
          <Callout.Root color="amber" size="1">
            <Callout.Icon>
              <SpeakerOffIcon />
            </Callout.Icon>
            <Callout.Text>{t('listening.listening.mutedHint')}</Callout.Text>
          </Callout.Root>
        ) : null}
        {showProgress ? (
          <Box>
            <Flex justify="between" align="baseline" mb="1">
              <Text size="1" color="gray">
                {t('listening.listening.progress', {
                  current: Math.min(progressCurrent + 1, progressTotal),
                  total: progressTotal,
                })}
              </Text>
              {progressBuffered < progressTotal ? (
                <Text size="1" color="gray">
                  {t('listening.listening.buffering', {
                    buffered: progressBuffered,
                    total: progressTotal,
                  })}
                </Text>
              ) : null}
            </Flex>
            <ProgressBar value={progressValue} max={100} />
          </Box>
        ) : null}
        {examMode ? (
          <Box className={styles.transcriptHiddenHint}>
            <Text size="2" color="gray">
              {t('listening.listening.examTranscriptHidden')}
            </Text>
          </Box>
        ) : showTranscript ? (
          <Box className={styles.transcriptBox}>
            <Text size="3" as="p" style={{ lineHeight: 1.6 }}>
              {sentences.map((s, i) => (
                <span
                  key={i}
                  ref={i === activeSentence ? activeSentenceRef : undefined}
                  className={i === activeSentence ? styles.transcriptCurrent : undefined}
                >
                  {s}
                  {i < sentences.length - 1 ? ' ' : null}
                </span>
              ))}
            </Text>
          </Box>
        ) : (
          <Box className={styles.transcriptHiddenHint}>
            <Text size="2" color="gray">
              {t('listening.listening.hiddenHint')}
            </Text>
          </Box>
        )}
        <Flex gap="3" direction={{ initial: 'column', sm: 'row' }}>
          <Button size="3" onClick={onReady} style={{ flex: 1 }}>
            {t('listening.listening.ready')}
          </Button>
          <Button size="3" variant="soft" color="gray" onClick={onRegenerate} style={{ flex: 1 }}>
            {t('listening.listening.regenerate')}
          </Button>
        </Flex>
      </Flex>
    </Card>
  )
}

interface AnsweringCardProps {
  exercise: ListeningExercise
  examMode: boolean
  answers: (number | null)[]
  onAnswer: (questionIdx: number, value: number) => void
  onSubmit: () => void
  onBackToListening: () => void
  replayDisabled: boolean
  onRegenerate: () => void
  submitting: boolean
}

function AnsweringCard({
  exercise,
  examMode,
  answers,
  onAnswer,
  onSubmit,
  onBackToListening,
  replayDisabled,
  onRegenerate,
  submitting,
}: AnsweringCardProps) {
  const { t } = useTranslation()
  const [showTranscript, setShowTranscript] = useState(false)
  const allAnswered = useMemo(() => answers.every((a) => a != null), [answers])

  return (
    <Flex direction="column" gap="4">
      <Card size="3" variant="surface">
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center" wrap="wrap" gap="3">
            <Heading size="4">{t('listening.answering.title')}</Heading>
            <Flex gap="2" wrap="wrap">
              <Button variant="soft" onClick={onBackToListening} disabled={replayDisabled}>
                <ReloadIcon /> {t('listening.answering.replay')}
              </Button>
              {examMode ? null : (
                <Button variant="soft" onClick={() => setShowTranscript((v) => !v)}>
                  {showTranscript ? <EyeNoneIcon /> : <EyeOpenIcon />}
                  <span style={{ marginLeft: 6 }}>
                    {showTranscript
                      ? t('listening.listening.hideTranscript')
                      : t('listening.listening.showTranscript')}
                  </span>
                </Button>
              )}
              <Button variant="soft" color="gray" onClick={onRegenerate}>
                {t('listening.listening.regenerate')}
              </Button>
            </Flex>
          </Flex>
          {!examMode && showTranscript ? (
            <Box className={styles.transcriptBox}>
              <Text size="2" as="p" style={{ lineHeight: 1.6 }}>
                {exercise.transcript}
              </Text>
            </Box>
          ) : null}
        </Flex>
      </Card>
      {exercise.questions.map((q, idx) => {
        const isRf = q.type === 'richtig_falsch'
        const opts = isRf ? [t('listening.richtig'), t('listening.falsch')] : q.options
        return (
          <Card key={idx} size="3" variant="surface">
            <Flex direction="column" gap="3">
              <Heading size="3" weight="medium">
                {idx + 1}. {q.q}
              </Heading>
              <RadioGroup.Root
                value={answers[idx] == null ? '' : String(answers[idx])}
                onValueChange={(v) => onAnswer(idx, Number(v))}
              >
                <Flex direction={isRf ? 'row' : 'column'} gap={isRf ? '5' : '2'} wrap="wrap">
                  {opts.map((opt, oi) => (
                    <Text as="label" size="2" key={oi} style={{ cursor: 'var(--cursor-radio)' }}>
                      <Flex gap="2" align="center">
                        <RadioGroup.Item value={String(oi)} />
                        <span>{opt}</span>
                      </Flex>
                    </Text>
                  ))}
                </Flex>
              </RadioGroup.Root>
            </Flex>
          </Card>
        )
      })}
      <Button size="3" onClick={onSubmit} disabled={!allAnswered || submitting}>
        {submitting ? t('listening.answering.submitting') : t('listening.answering.submit')}
      </Button>
    </Flex>
  )
}

interface ResultsCardProps {
  user: { id: UserId; display_name: string; emoji: string }
  exercise: ListeningExercise
  answers: number[]
  score: number
  passed: boolean
  onNewRound: () => void
}

function ResultsCard({ user, exercise, answers, score, passed, onNewRound }: ResultsCardProps) {
  const { t } = useTranslation()
  const max = exercise.questions.length
  const goethePassed = max > 0 && score / max >= 0.6
  return (
    <Flex direction="column" gap="4">
      <Card size="3" variant="classic">
        <Flex direction="column" align="center" gap="2" py="3">
          <Badge size="3" color={passed ? 'green' : 'amber'} radius="full" variant="solid">
            {score} / {max}
          </Badge>
          <Heading size="5">{t('listening.results.heading')}</Heading>
          <Text size="2" color="gray" align="center">
            {passed ? t('listening.results.passedHint') : t('listening.results.encourageHint')}
          </Text>
          <Text size="1" color={goethePassed ? 'green' : 'gray'}>
            {t('listening.results.goetheLine')}
            {goethePassed ? ' ✓' : ''}
          </Text>
        </Flex>
      </Card>
      <Card size="3" variant="surface">
        <Flex direction="column" gap="2">
          <Heading size="3" weight="medium">
            {t('listening.results.transcript')}
          </Heading>
          <Box className={styles.transcriptBox}>
            <Text size="2" as="p" style={{ lineHeight: 1.6 }}>
              {exercise.transcript}
            </Text>
          </Box>
        </Flex>
      </Card>
      {exercise.questions.map((q, idx) => {
        const picked = answers[idx]
        const isCorrect = picked === q.correctIndex
        const opts =
          q.type === 'richtig_falsch' ? [t('listening.richtig'), t('listening.falsch')] : q.options
        return (
          <Card key={idx} size="3" variant="surface">
            <Flex direction="column" gap="3">
              <Flex gap="2" align="start">
                {isCorrect ? (
                  <Box style={{ color: 'var(--green-9)' }}>
                    <CheckCircledIcon width="20" height="20" />
                  </Box>
                ) : (
                  <Box style={{ color: 'var(--red-9)' }}>
                    <CrossCircledIcon width="20" height="20" />
                  </Box>
                )}
                <Heading size="3" weight="medium">
                  {idx + 1}. {q.q}
                </Heading>
              </Flex>
              <Flex direction="column" gap="1">
                {opts.map((opt, oi) => {
                  const isPicked = oi === picked
                  const isAnswer = oi === q.correctIndex
                  const cls = [
                    styles.optionRow,
                    isAnswer ? styles.optionCorrect : '',
                    isPicked && !isAnswer ? styles.optionWrong : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <Box key={oi} className={cls}>
                      <Text size="2">
                        {isAnswer ? '✓ ' : isPicked ? '✗ ' : '  '}
                        {opt}
                      </Text>
                    </Box>
                  )
                })}
              </Flex>
              <Box className={styles.explanationBox}>
                <Text size="2" weight="medium" color="gray" as="div" mb="1">
                  {t('listening.results.explanationDe')}
                </Text>
                <Text size="2" as="p">
                  {q.explanationDe}
                </Text>
                <Text size="2" weight="medium" color="gray" as="div" mt="2" mb="1">
                  {t('listening.results.explanationEn')}
                </Text>
                <Text size="2" as="p">
                  {q.explanationEn}
                </Text>
              </Box>
            </Flex>
          </Card>
        )
      })}
      <Flex gap="3" direction={{ initial: 'column', sm: 'row' }}>
        <Button size="3" onClick={onNewRound} style={{ flex: 1 }}>
          {t('listening.results.newRound')}
        </Button>
        <Button asChild size="3" variant="soft" style={{ flex: 1 }}>
          <Link to={paths.challenges(user.id)}>{t('listening.results.backToList')}</Link>
        </Button>
      </Flex>
    </Flex>
  )
}
