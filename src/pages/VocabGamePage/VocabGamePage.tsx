import { Badge, Box, Card, Container, Flex, Select, Text } from '@radix-ui/themes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { ProgressBar } from '@/components/ProgressBar'
import { TopBar } from '@/components/TopBar'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useMatchSession } from '@/hooks/useMatchSession'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { DEFAULT_PACK_ID, VOCAB_PACKS, VOCAB_PACKS_BY_ID } from '@/data/vocab'
import type { VocabWord } from '@/data/vocab'
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
      />
      <Game
        user={user}
        challengeId={challenge.id}
        goal={challenge.daily_goal_seconds}
        baselineToday={todayQuery.data ?? 0}
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
  const pack = VOCAB_PACKS_BY_ID[packId] ?? VOCAB_PACKS[0]
  const { matchesInSession, incrementMatch } = useMatchSession({
    userId: user.id,
    challengeId,
    enabled: true,
  })

  const todayTotal = baselineToday + matchesInSession
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
    const timer = window.setTimeout(() => {
      setRoundDoneFlash(false)
      setTiles(drawNextRound())
    }, ROUND_DONE_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [tiles, drawNextRound])

  const onTileClick = useCallback(
    (tile: Tile) => {
      if (tile.removed || roundDoneFlash) return
      if (wrongIds.size > 0) return

      if (!selectedId) {
        setSelectedId(tile.id)
        return
      }
      if (selectedId === tile.id) {
        setSelectedId(null)
        return
      }

      const selected = tiles.find((t) => t.id === selectedId)
      if (!selected) {
        setSelectedId(tile.id)
        return
      }

      if (selected.kind === tile.kind) {
        setSelectedId(tile.id)
        return
      }

      if (selected.pairKey === tile.pairKey) {
        setTiles((prev) =>
          prev.map((p) =>
            p.id === selected.id || p.id === tile.id ? { ...p, removed: true } : p,
          ),
        )
        setSelectedId(null)
        void incrementMatch()
      } else {
        const wrongSet = new Set([selected.id, tile.id])
        setWrongIds(wrongSet)
        setSelectedId(null)
        window.setTimeout(() => setWrongIds(new Set()), WRONG_FLASH_MS)
      }
    },
    [selectedId, tiles, wrongIds, incrementMatch, roundDoneFlash],
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
                {t('vocab.matches', { count: matchesInSession })}
              </Badge>
            </Flex>
          </Flex>

          <Box>
            <Flex justify="between" align="baseline" mb="1">
              <Text size="2" weight="medium">
                {t('vocab.today')}
              </Text>
              <Text size="2" color="gray" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t('vocab.matches', { count: todayTotal })} / {t('vocab.matches', { count: goal })}
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
      ) : (
        <Box className={styles.grid}>
          {tiles.map((tile) => (
            <TileButton
              key={tile.id}
              tile={tile}
              selected={selectedId === tile.id}
              wrong={wrongIds.has(tile.id)}
              onClick={() => onTileClick(tile)}
            />
          ))}
        </Box>
      )}
    </Flex>
  )
}

function TileButton({
  tile,
  selected,
  wrong,
  onClick,
}: {
  tile: Tile
  selected: boolean
  wrong: boolean
  onClick: () => void
}) {
  const cls = [
    styles.tile,
    tile.kind === 'de' ? styles.tileDe : styles.tileEn,
    selected ? styles.tileSelected : '',
    wrong ? styles.tileWrong : '',
    tile.removed ? styles.tileRemoved : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={cls} onClick={onClick} aria-pressed={selected}>
      {tile.text}
    </button>
  )
}
