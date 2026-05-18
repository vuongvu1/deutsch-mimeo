import { BookmarkFilledIcon, BookmarkIcon, SpeakerLoudIcon, SpeakerOffIcon } from '@radix-ui/react-icons'
import { Badge, Box, Card, Container, Flex, IconButton, Select, Text, Tooltip } from '@radix-ui/themes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { ProgressBar } from '@/components/ProgressBar'
import { SavedWordsDialog } from '@/components/SavedWordsDialog'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useMatchSession } from '@/hooks/useMatchSession'
import { useSaveWord, useSavedWords, useUnsaveWord } from '@/hooks/useSavedWords'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { DEFAULT_PACK_ID, SAVED_PACK_ID, VOCAB_PACKS, VOCAB_PACKS_BY_ID } from '@/data/vocab'
import type { VocabPack, VocabWord } from '@/data/vocab'
import {
  isMuted,
  playGoalReached,
  playMatch,
  playRoundDone,
  playWrong,
  setMuted,
  speakGerman,
  subscribeMute,
} from '@/lib/sounds'
import { paths } from '@/routes/paths'
import type { UserId } from '@/types/db'

import styles from './VocabGamePage.module.css'

const ROUND_SIZE = 6
const WRONG_FLASH_MS = 380
const ROUND_DONE_FLASH_MS = 650

type TileKind = 'de' | 'en'

interface Tile {
  id: string
  kind: TileKind
  text: string
  pairKey: string
  removed: boolean
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildTiles(words: readonly VocabWord[], seed: number): Tile[] {
  const tiles: Tile[] = []
  words.forEach((w, i) => {
    const pairKey = `${seed}-${i}`
    tiles.push({ id: `${pairKey}-de`, kind: 'de', text: w.de, pairKey, removed: false })
    tiles.push({ id: `${pairKey}-en`, kind: 'en', text: w.en, pairKey, removed: false })
  })
  return shuffle(tiles)
}

function packStorageKey(userId: UserId): string {
  return `mimeo:vocab:pack:${userId}`
}

export function VocabGamePage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const challenge = useChallengeBySlug('vocab').data
  const todayQuery = useTodaySecondsForChallenge(
    userId as UserId | undefined,
    challenge?.id,
  )
  // Snapshot the baseline once so flush()'s invalidate-then-refetch
  // doesn't compound with roundsInSession.
  const baselineRef = useRef<number | null>(null)
  useEffect(() => {
    if (baselineRef.current === null && todayQuery.data !== undefined) {
      baselineRef.current = todayQuery.data
    }
  }, [todayQuery.data])

  const [packId, setPackId] = useState<string>(() => {
    if (userId !== 'mi' && userId !== 'meo') return DEFAULT_PACK_ID
    const stored = localStorage.getItem(packStorageKey(userId))
    if (stored && VOCAB_PACKS_BY_ID[stored]) return stored
    return DEFAULT_PACK_ID
  })

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />
  if (!challenge) return <Navigate to={paths.challenges(user.id)} replace />

  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.challenges(user.id) }}
        title={t('vocab.pageTitle')}
        emoji={t('vocab.pageTitleEmoji')}
        rightSlot={
          <Flex gap="2" align="center">
            <SavedWordsDialog userId={user.id} />
            <MuteToggle />
          </Flex>
        }
      />
      <Game
        user={user}
        challengeId={challenge.id}
        goal={challenge.daily_goal_seconds}
        baselineToday={baselineRef.current ?? 0}
        packId={packId}
        onPackChange={(id) => {
          setPackId(id)
          localStorage.setItem(packStorageKey(user.id), id)
        }}
      />
    </Container>
  )
}

interface GameProps {
  user: { id: UserId; display_name: string; emoji: string }
  challengeId: string
  goal: number
  baselineToday: number
  packId: string
  onPackChange: (id: string) => void
}

function Game({ user, challengeId, goal, baselineToday, packId, onPackChange }: GameProps) {
  const { t } = useTranslation()
  const { roundsInSession, incrementRound } = useMatchSession({
    userId: user.id,
    challengeId,
    enabled: true,
  })

  const savedWordsQuery = useSavedWords(user.id)
  const savedWords = savedWordsQuery.data ?? []
  const saveWord = useSaveWord()
  const unsaveWord = useUnsaveWord()
  const savedSet = useMemo(
    () => new Set(savedWords.map((w) => w.de)),
    [savedWords],
  )

  const pack: VocabPack = useMemo(() => {
    if (packId === SAVED_PACK_ID) {
      return { id: SAVED_PACK_ID, words: savedWords.map((w) => ({ de: w.de, en: w.en })) }
    }
    return VOCAB_PACKS_BY_ID[packId] ?? VOCAB_PACKS[0]
  }, [packId, savedWords])

  const savedPackEmpty = pack.id === SAVED_PACK_ID && pack.words.length === 0

  const enByDe = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of pack.words) map.set(w.de, w.en)
    for (const w of savedWords) if (!map.has(w.de)) map.set(w.de, w.en)
    return map
  }, [pack, savedWords])

  const toggleSave = useCallback(
    (de: string) => {
      if (savedSet.has(de)) {
        unsaveWord.mutate({ user_id: user.id, de })
        return
      }
      const en = enByDe.get(de) ?? ''
      saveWord.mutate({ user_id: user.id, de, en })
    },
    [savedSet, enByDe, saveWord, unsaveWord, user.id],
  )

  const todayTotal = baselineToday + roundsInSession
  const complete = todayTotal >= goal

  const poolRef = useRef<VocabWord[]>([])
  const roundSeedRef = useRef(0)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set())
  const [roundDoneFlash, setRoundDoneFlash] = useState(false)

  const drawNextRound = useCallback((): Tile[] => {
    if (poolRef.current.length < ROUND_SIZE) {
      poolRef.current = shuffle(pack.words)
    }
    const words = poolRef.current.slice(0, ROUND_SIZE)
    poolRef.current = poolRef.current.slice(ROUND_SIZE)
    roundSeedRef.current += 1
    return buildTiles(words, roundSeedRef.current)
  }, [pack])

  // Reset board when pack changes (or on mount).
  useEffect(() => {
    poolRef.current = shuffle(pack.words)
    setTiles(drawNextRound())
    setSelectedId(null)
    setWrongIds(new Set())
    // drawNextRound depends on pack via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.id])

  // Redeal when the round is cleared.
  useEffect(() => {
    if (tiles.length === 0) return
    if (!tiles.every((tile) => tile.removed)) return
    setRoundDoneFlash(true)
    playRoundDone()
    void incrementRound()
    const timer = window.setTimeout(() => {
      setRoundDoneFlash(false)
      setTiles(drawNextRound())
    }, ROUND_DONE_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [tiles, drawNextRound, incrementRound])

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

  const onTileClick = useCallback(
    (tile: Tile) => {
      if (tile.removed || roundDoneFlash) return
      if (wrongIds.size > 0) return

      if (!selectedId) {
        setSelectedId(tile.id)
        if (tile.kind === 'de') speakGerman(tile.text)
        return
      }
      if (selectedId === tile.id) {
        setSelectedId(null)
        return
      }

      const selected = tiles.find((t) => t.id === selectedId)
      if (!selected) {
        setSelectedId(tile.id)
        if (tile.kind === 'de') speakGerman(tile.text)
        return
      }

      if (selected.kind === tile.kind) {
        setSelectedId(tile.id)
        if (tile.kind === 'de') speakGerman(tile.text)
        return
      }

      if (selected.pairKey === tile.pairKey) {
        setTiles((prev) =>
          prev.map((p) =>
            p.id === selected.id || p.id === tile.id ? { ...p, removed: true } : p,
          ),
        )
        setSelectedId(null)
        playMatch()
        if (selected.kind === 'en') speakGerman(tile.text)
      } else {
        const wrongSet = new Set([selected.id, tile.id])
        setWrongIds(wrongSet)
        setSelectedId(null)
        playWrong()
        window.setTimeout(() => setWrongIds(new Set()), WRONG_FLASH_MS)
      }
    },
    [selectedId, tiles, wrongIds, roundDoneFlash],
  )

  const packOptions = useMemo(() => VOCAB_PACKS.map((p) => p.id), [])

  return (
    <Flex direction="column" gap="4">
      <Card size="2" variant="surface">
        <Flex direction="column" gap="3">
          <Flex
            justify="between"
            align={{ initial: 'start', sm: 'center' }}
            gap="3"
            direction={{ initial: 'column', sm: 'row' }}
          >
            <Box>
              <Text size="2" color="gray" weight="medium">
                {t('vocab.pack.label')}
              </Text>
              <Box mt="1">
                <Select.Root value={packId} onValueChange={onPackChange} size="2">
                  <Select.Trigger />
                  <Select.Content>
                    {packOptions.map((id) => (
                      <Select.Item key={id} value={id}>
                        {t(`vocab.packs.${id}`)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>
            </Box>
            <Flex direction="column" gap="1" align={{ initial: 'start', sm: 'end' }}>
              <Text size="2" color="gray">
                {t('vocab.sessionLabel')}
              </Text>
              <Badge size="2" variant="soft" radius="full">
                {t('vocab.rounds', { count: roundsInSession })}
              </Badge>
            </Flex>
          </Flex>

          <Box>
            <Flex justify="between" align="baseline" mb="1">
              <Text size="2" weight="medium">
                {t('vocab.today')}
              </Text>
              <Text size="2" color="gray" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t('vocab.rounds', { count: todayTotal })} / {t('vocab.rounds', { count: goal })}
              </Text>
            </Flex>
            <ProgressBar value={todayTotal} max={goal} complete={complete} />
            {complete ? (
              <Text size="2" color="green" mt="2" as="div">
                {t('vocab.goalReached')}
              </Text>
            ) : null}
          </Box>

          <Text size="1" color="gray">
            {t('vocab.instructions')}
          </Text>
        </Flex>
      </Card>

      {roundDoneFlash ? (
        <Card size="2" variant="classic">
          <Box className={styles.roundDoneBanner}>{t('vocab.roundDone')}</Box>
        </Card>
      ) : savedPackEmpty ? (
        <Card size="2" variant="surface">
          <Flex direction="column" gap="2" align="center" p="4">
            <Text size="3" weight="medium">
              {t('vocab.saved.emptyPackTitle')}
            </Text>
            <Text size="2" color="gray" align="center">
              {t('vocab.saved.emptyPackHint')}
            </Text>
          </Flex>
        </Card>
      ) : (
        <Box className={styles.grid}>
          {tiles.map((tile) => (
            <TileButton
              key={tile.id}
              tile={tile}
              selected={selectedId === tile.id}
              wrong={wrongIds.has(tile.id)}
              onClick={() => onTileClick(tile)}
              saved={tile.kind === 'de' && savedSet.has(tile.text)}
              onToggleSave={tile.kind === 'de' ? () => toggleSave(tile.text) : undefined}
            />
          ))}
        </Box>
      )}
    </Flex>
  )
}

function MuteToggle() {
  const { t } = useTranslation()
  const [muted, setMutedState] = useState<boolean>(() => isMuted())
  useEffect(() => subscribeMute(setMutedState), [])
  const label = muted ? t('vocab.sound.unmute') : t('vocab.sound.mute')
  return (
    <Tooltip content={label}>
      <IconButton
        variant="soft"
        radius="full"
        aria-label={label}
        aria-pressed={muted}
        onClick={() => setMuted(!muted)}
      >
        {muted ? <SpeakerOffIcon /> : <SpeakerLoudIcon />}
      </IconButton>
    </Tooltip>
  )
}

function TileButton({
  tile,
  selected,
  wrong,
  onClick,
  saved,
  onToggleSave,
}: {
  tile: Tile
  selected: boolean
  wrong: boolean
  onClick: () => void
  saved: boolean
  onToggleSave?: () => void
}) {
  const { t } = useTranslation()
  const cls = [
    styles.tile,
    tile.kind === 'de' ? styles.tileDe : styles.tileEn,
    selected ? styles.tileSelected : '',
    wrong ? styles.tileWrong : '',
    tile.removed ? styles.tileRemoved : '',
  ]
    .filter(Boolean)
    .join(' ')
  const saveLabel = saved ? t('vocab.saved.unsave') : t('vocab.saved.save')
  return (
    <div className={styles.tileWrap}>
      <button type="button" className={cls} onClick={onClick} aria-pressed={selected}>
        <span className={styles.tileText}>{tile.text}</span>
      </button>
      {onToggleSave && !tile.removed ? (
        <Tooltip content={saveLabel}>
          <button
            type="button"
            aria-label={saveLabel}
            aria-pressed={saved}
            className={`${styles.saveBtn} ${saved ? styles.saveBtnActive : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSave()
            }}
          >
            {saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}
          </button>
        </Tooltip>
      ) : null}
    </div>
  )
}
