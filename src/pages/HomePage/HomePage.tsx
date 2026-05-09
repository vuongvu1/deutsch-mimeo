import { Link } from 'react-router-dom'

import { useChallengeBySlug } from '@/hooks/useChallenges'
import { useUsers } from '@/hooks/useUsers'
import { paths } from '@/routes/paths'
import type { UserRow } from '@/types/db'

import { ComparisonPanel } from './ComparisonPanel'
import styles from './HomePage.module.css'

export function HomePage() {
  const usersQuery = useUsers()
  const listenChallenge = useChallengeBySlug('listen')

  const users = usersQuery.data ?? []
  const mi = users.find((u) => u.id === 'mi')
  const meo = users.find((u) => u.id === 'meo')

  return (
    <div className="container">
      <div className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandEmoji}>🇩🇪</span>
          <h1 className={styles.brandTitle}>Deutsch MiMeo</h1>
        </div>
        <p className="muted">Wer ist da?</p>
      </div>

      <div className={styles.userGrid}>
        {mi ? <UserCard user={mi} variant="mi" /> : <UserSkeleton variant="mi" />}
        {meo ? <UserCard user={meo} variant="meo" /> : <UserSkeleton variant="meo" />}
      </div>

      <section className={styles.comparison}>
        <h2 className={styles.sectionTitle}>Heute · Vergleich</h2>
        <ComparisonPanel challenge={listenChallenge.data ?? undefined} />
      </section>
    </div>
  )
}

function UserCard({ user, variant }: { user: UserRow; variant: 'mi' | 'meo' }) {
  return (
    <Link to={paths.challenges(user.id)} className={styles.userCard} data-variant={variant}>
      <div className={styles.userEmoji}>{user.emoji}</div>
      <div className={styles.userName}>{user.display_name}</div>
      <div className={styles.userCta}>Los geht's →</div>
    </Link>
  )
}

function UserSkeleton({ variant }: { variant: 'mi' | 'meo' }) {
  return <div className={styles.userCard} data-variant={variant} aria-hidden />
}
