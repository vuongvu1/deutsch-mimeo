import { Card, Container, Flex, Grid, Heading, Section, Text } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import meoImg from '@/assets/meo.jpg'
import miImg from '@/assets/mi.jpg'
import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useUsers } from '@/hooks/useUsers'
import { paths } from '@/routes/paths'
import type { UserRow } from '@/types/db'

import { ActivityLog } from './ActivityLog'
import { ComparisonPanel } from './ComparisonPanel'
import styles from './HomePage.module.css'

const USER_IMAGES = { mi: miImg, meo: meoImg } as const

export function HomePage() {
  const { t } = useTranslation()
  const usersQuery = useUsers()
  const listenChallenge = useChallengeBySlug('listen')

  const users = usersQuery.data
  const mi = users.find((u) => u.id === 'mi')!
  const meo = users.find((u) => u.id === 'meo')!

  return (
    <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '6' }}>
      <Flex direction="column" align="center" gap="2" mb="6">
        <Heading size="8" weight="bold" align="center">
          🇩🇪 {t('header.appName')}
        </Heading>
        <Text color="gray">{t('home.welcome')}</Text>
      </Flex>

      <Grid columns="2" gap={{ initial: '3', sm: '5' }} mb="7">
        <UserCard user={mi} variant="mi" />
        <UserCard user={meo} variant="meo" />
      </Grid>

      <Section size="1" pt="0">
        <Heading size="4" mb="4" color="gray" weight="medium">
          {t('home.todayCompare')}
        </Heading>
        <ComparisonPanel challenge={listenChallenge.data ?? undefined} />
      </Section>

      <Section size="1" pt="0">
        <Heading size="4" mb="4" color="gray" weight="medium">
          {t('home.recentActivity')}
        </Heading>
        <ActivityLog />
      </Section>
    </Container>
  )
}

function UserCard({ user, variant }: { user: UserRow; variant: 'mi' | 'meo' }) {
  const { t } = useTranslation()
  return (
    <Card asChild size="4" variant="surface" className={styles.userCard} data-variant={variant}>
      <Link to={paths.challenges(user.id)}>
        <Flex direction="column" align="center" gap="3" py="3">
          <img
            className={styles.userAvatar}
            src={USER_IMAGES[variant]}
            alt={user.display_name}
            draggable={false}
          />
          <Heading size={{ initial: '5', sm: '7' }} weight="bold">
            {user.display_name}
          </Heading>
          <Text size="2" color="gray">
            {t('home.cta')}
          </Text>
        </Flex>
      </Link>
    </Card>
  )
}
