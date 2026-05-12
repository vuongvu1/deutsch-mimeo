import { Box, Card, Flex, Text } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useRecentSessions } from '@/hooks/useStats'
import { formatMinutes, formatRelativeTime } from '@/lib/dates'
import { paths } from '@/routes/paths'
import type { UserId } from '@/types/db'

import styles from './ActivityLog.module.css'

const USER_EMOJI: Record<UserId, string> = { mi: '🐷', meo: '🐱' }
const USER_NAME: Record<UserId, string> = { mi: 'Mi', meo: 'Meo' }

export function ActivityLog() {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useRecentSessions(10)

  if (isLoading) {
    return (
      <Card>
        <Text color="gray">{t('common.loading')}</Text>
      </Card>
    )
  }

  const entries = data ?? []
  if (entries.length === 0) {
    return (
      <Card>
        <Text color="gray">{t('activityLog.empty')}</Text>
      </Card>
    )
  }

  return (
    <Card>
      <Flex direction="column">
        {entries.map((e, idx) => {
          const verb = t('activityLog.verb')
          const title = e.video_title ?? t('activityLog.deletedVideo')
          const minutes = formatMinutes(e.seconds)
          const when = formatRelativeTime(e.updated_at, i18n.language)
          const row = (
            <Flex
              align="center"
              gap="3"
              py="2"
              className={styles.row}
              data-variant={e.user_id}
            >
              <Text size="4" aria-hidden style={{ lineHeight: 1 }}>
                {USER_EMOJI[e.user_id]}
              </Text>
              <Box flexGrow="1" minWidth="0">
                <Text as="div" size="2" truncate>
                  <Text weight="bold">{USER_NAME[e.user_id]}</Text>
                  <Text color="gray">{' '}{verb}{' '}</Text>
                  <Text weight="medium">{title}</Text>
                </Text>
              </Box>
              <Text
                size="1"
                color="gray"
                style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
              >
                {minutes} · {when}
              </Text>
            </Flex>
          )
          return (
            <Box
              key={e.id}
              className={styles.rowWrapper}
              data-first={idx === 0 || undefined}
            >
              {e.video_id ? (
                <Link
                  to={paths.player(e.user_id, e.video_id)}
                  className={styles.rowLink}
                >
                  {row}
                </Link>
              ) : (
                row
              )}
            </Box>
          )
        })}
      </Flex>
    </Card>
  )
}
