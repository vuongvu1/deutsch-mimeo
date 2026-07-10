import { Badge, Box, Button, Card, Container, Flex, Text, TextField } from '@radix-ui/themes'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'

import { MuteToggle } from '@/components/MuteToggle'
import { ProgressBar } from '@/components/ProgressBar'
import { TopBar } from '@/components/TopBar'
import { RECALL_CHALLENGE_ID, useChallengeBySlug } from '@/hooks/useChallenges'
import { useMatchSession } from '@/hooks/useMatchSession'
import { useBumpWordStat, useSavedWords } from '@/hooks/useSavedWords'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { drawRecallBatch, isAnswerCorrect } from '@/lib/recall'
import { playGoalReached, playMatch, playWrong, speakGerman } from '@/lib/sounds'
import { paths } from '@/routes/paths'
import type { SavedWordRow, UserId } from '@/types/db'

const CORRECT_ADVANCE_MS = 900

export function RecallPage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const challenge = useChallengeBySlug('recall').data
  const todayQuery = useTodaySecondsForChallenge(userId as UserId | undefined, challenge?.id)
  // Snapshot the baseline once so flush()'s invalidate-then-refetch
  // doesn't compound with roundsInSession.
  const baselineRef = useRef<number | null>(null)
  useEffect(() => {
    if (baselineRef.current === null && todayQuery.data !== undefined) {
      baselineRef.current = todayQuery.data
    }
  }, [todayQuery.data])

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />
  if (!challenge) return <Navigate to={paths.challenges(user.id)} replace />

  return (
    <Container size="2" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.challenges(user.id) }}
        title={t('recall.pageTitle')}
        emoji={t('recall.pageTitleEmoji')}
        rightSlot={<MuteToggle />}
      />
      <Quiz
        userId={user.id}
        goal={challenge.daily_goal_seconds}
        baselineToday={baselineRef.current ?? 0}
      />
    </Container>
  )
}

interface QuizProps {
  userId: UserId
  goal: number
  baselineToday: number
}

function Quiz({ userId, goal, baselineToday }: QuizProps) {
  const { t } = useTranslation()
  const { roundsInSession, incrementRound } = useMatchSession({
    userId,
    challengeId: RECALL_CHALLENGE_ID,
    enabled: true,
  })
  const savedWordsQuery = useSavedWords(userId)
  const pool = savedWordsQuery.data ?? []
  const bumpStat = useBumpWordStat()

  const [queue, setQueue] = useState<SavedWordRow[]>([])
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<{
    word: SavedWordRow
    correct: boolean
    typed: string
  } | null>(null)
  const lastShownIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const todayTotal = baselineToday + roundsInSession
  const complete = todayTotal >= goal
  const current: SavedWordRow | undefined = queue[0]

  useEffect(() => {
    if (queue.length > 0 || feedback !== null || pool.length === 0) return
    setQueue(drawRecallBatch(pool, lastShownIdRef.current))
  }, [queue, feedback, pool])

  const advance = useCallback(() => {
    if (!feedback) return
    setQueue((q) => {
      const rest = q.slice(1)
      return feedback.correct ? rest : [...rest, feedback.word]
    })
    setFeedback(null)
    setInput('')
  }, [feedback])

  useEffect(() => {
    if (!feedback?.correct) return
    const timer = window.setTimeout(advance, CORRECT_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [feedback, advance])

  useEffect(() => {
    if (current && feedback === null) inputRef.current?.focus()
  }, [current, feedback])

  // Celebrate the daily goal exactly once, and only when this session caused
  // the crossing (not when the page loads with baselineToday already ≥ goal).
  const goalCelebratedRef = useRef(false)
  useEffect(() => {
    if (goalCelebratedRef.current) return
    if (roundsInSession === 0) return
    if (baselineToday >= goal) {
      goalCelebratedRef.current = true
      return
    }
    if (todayTotal < goal) return
    goalCelebratedRef.current = true
    playGoalReached()
  }, [roundsInSession, todayTotal, baselineToday, goal])

  const submitAnswer = (typed: string) => {
    if (!current || feedback) return
    const correct = isAnswerCorrect(current.de, typed)
    const fresh = pool.find((w) => w.id === current.id) ?? current
    lastShownIdRef.current = current.id
    bumpStat.mutate({ word: fresh, field: correct ? 'times_correct' : 'times_wrong' })
    if (correct) {
      playMatch()
      void incrementRound()
    } else {
      playWrong()
    }
    speakGerman(current.de)
    setFeedback({ word: fresh, correct, typed })
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    submitAnswer(input.trim())
  }

  if (savedWordsQuery.isLoading) {
    return (
      <Card>
        <Text color="gray">{t('common.loading')}</Text>
      </Card>
    )
  }

  if (savedWordsQuery.isError) {
    return (
      <Card>
        <Text color="red">{t('recall.loadError')}</Text>
      </Card>
    )
  }

  if (pool.length === 0) {
    return (
      <Card size="3" variant="surface">
        <Flex direction="column" gap="2" align="center" p="4">
          <Text size="3" weight="medium">
            {t('recall.empty.title')}
          </Text>
          <Text size="2" color="gray" align="center">
            {t('recall.empty.hint')}
          </Text>
          <Button asChild variant="soft" mt="2">
            <Link to={paths.vocabGame(userId)}>{t('recall.empty.cta')}</Link>
          </Button>
        </Flex>
      </Card>
    )
  }

  return (
    <Flex direction="column" gap="4">
      <Card size="2" variant="surface">
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center" gap="3">
            <Text size="2" color="gray">
              {t('recall.sessionLabel')}
            </Text>
            <Badge size="2" variant="soft" radius="full">
              {t('recall.words', { count: roundsInSession })}
            </Badge>
          </Flex>
          <Box>
            <Flex justify="between" align="baseline" mb="1">
              <Text size="2" weight="medium">
                {t('recall.today')}
              </Text>
              <Text size="2" color="gray" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t('recall.words', { count: todayTotal })} / {t('recall.words', { count: goal })}
              </Text>
            </Flex>
            <ProgressBar value={todayTotal} max={goal} complete={complete} />
            {complete ? (
              <Text size="2" color="green" mt="2" as="div">
                {t('recall.goalReached')}
              </Text>
            ) : null}
          </Box>
        </Flex>
      </Card>

      {current ? (
        <Card size="3" variant="surface">
          <Flex direction="column" gap="4">
            <Box>
              <Text size="2" color="gray" as="div" mb="1">
                {t('recall.promptLabel')}
              </Text>
              <Text size="6" weight="bold">
                {current.en}
              </Text>
            </Box>

            {feedback ? (
              feedback.correct ? (
                <Flex align="center" gap="2">
                  <Text size="3" color="green" weight="bold">
                    ✓ {t('recall.correct')}
                  </Text>
                  <Text size="3" weight="medium">
                    {feedback.word.de}
                  </Text>
                </Flex>
              ) : (
                <Flex direction="column" gap="2" align="start">
                  <Text size="3" color="red" weight="bold">
                    {t('recall.wrongTitle')}
                  </Text>
                  {feedback.typed ? (
                    <>
                      <Text size="2" color="gray">
                        {t('recall.yourAnswerLabel')}
                      </Text>
                      <Text size="4" color="red" style={{ textDecoration: 'line-through' }}>
                        {feedback.typed}
                      </Text>
                    </>
                  ) : null}
                  <Text size="2" color="gray">
                    {t('recall.solutionLabel')}
                  </Text>
                  <Text size="5" weight="bold">
                    {feedback.word.de}
                  </Text>
                  <Button onClick={advance} mt="1">
                    {t('recall.continue')}
                  </Button>
                </Flex>
              )
            ) : (
              <form onSubmit={onSubmit}>
                <Flex gap="2">
                  <Box flexGrow="1">
                    <TextField.Root
                      ref={inputRef}
                      size="3"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={t('recall.inputPlaceholder')}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </Box>
                  <Button size="3" type="submit" disabled={input.trim().length === 0}>
                    {t('recall.check')}
                  </Button>
                  <Button
                    size="3"
                    type="button"
                    variant="soft"
                    color="gray"
                    onClick={() => submitAnswer('')}
                  >
                    {t('recall.skip')}
                  </Button>
                </Flex>
              </form>
            )}
          </Flex>
        </Card>
      ) : null}
    </Flex>
  )
}
