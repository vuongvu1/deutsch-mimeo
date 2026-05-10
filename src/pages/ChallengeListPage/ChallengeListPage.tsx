import { Badge, Box, Button, Card, Container, Flex, Heading, Text } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'

import { ProgressBar } from '@/components/ProgressBar'
import { TopBar } from '@/components/TopBar'
import { useChallenges } from '@/hooks/useChallenges'
import { useTodaySecondsForChallenge } from '@/hooks/useStats'
import { useUser } from '@/hooks/useUsers'
import { formatMinutes } from '@/lib/dates'
import { paths } from '@/routes/paths'
import type { ChallengeRow, UserId, UserRow } from '@/types/db'

const SLUG_TO_PATH: Record<string, ((u: UserId) => string) | undefined> = {
  listen: (u) => paths.videoLibrary(u),
}

export function ChallengeListPage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const userQuery = useUser(userId as UserId | undefined)
  const challengesQuery = useChallenges()

  if (userId !== 'mi' && userId !== 'meo') return <Navigate to="/" replace />
  const user = userQuery.data
  if (!user) return <Navigate to="/" replace />

  const challenges = challengesQuery.data

  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <TopBar
        back={{ to: paths.home() }}
        title={user.display_name}
        emoji={user.emoji}
        rightSlot={
          <Button asChild variant="soft">
            <Link to={paths.stats(user.id)}>{t('challengeList.statsBtn')}</Link>
          </Button>
        }
      />

      <Heading size="6" weight="bold" mb="4">
        {t('challengeList.title')}
      </Heading>

      <Flex direction="column" gap="3">
        {challenges.map((c) => (
          <ChallengeCard key={c.id} challenge={c} user={user} />
        ))}
      </Flex>
    </Container>
  )
}

function ChallengeCard({ challenge, user }: { challenge: ChallengeRow; user: UserRow }) {
  const { t } = useTranslation()
  const todayQuery = useTodaySecondsForChallenge(user.id, challenge.id)
  const seconds = todayQuery.data ?? 0
  const goal = challenge.daily_goal_seconds
  const complete = seconds >= goal
  const link = SLUG_TO_PATH[challenge.slug]?.(user.id)

  const titleKey = `challenges.${challenge.slug}.title`
  const descKey = `challenges.${challenge.slug}.description`
  const title = t(titleKey, { defaultValue: challenge.title })
  const description = t(descKey, { defaultValue: challenge.description ?? '' })

  const inner = (
    <>
      <Flex justify="between" align="start" gap="3" mb="3">
        <Box minWidth="0">
          <Heading size="4" weight="bold" mb="1">
            {title}
          </Heading>
          {description ? (
            <Text size="2" color="gray">
              {description}
            </Text>
          ) : null}
        </Box>
        {complete ? (
          <Badge color="green" variant="solid" radius="full">
            ✓
          </Badge>
        ) : null}
      </Flex>
      <ProgressBar value={seconds} max={goal} complete={complete} />
      <Flex justify="between" mt="2">
        <Text size="2">{formatMinutes(seconds)}</Text>
        <Text size="2" color="gray">
          / {formatMinutes(goal)}
        </Text>
      </Flex>
    </>
  )

  if (!link) {
    return (
      <Card size="3" variant="surface">
        {inner}
      </Card>
    )
  }

  return (
    <Card asChild size="3" variant="surface">
      <Link to={link}>{inner}</Link>
    </Card>
  )
}
