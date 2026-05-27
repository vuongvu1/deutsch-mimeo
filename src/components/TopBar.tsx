import { ArrowLeftIcon } from '@radix-ui/react-icons'
import { Box, Flex, Heading, IconButton, Text, Tooltip } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface Props {
  back?: { to: string; label?: string }
  title?: string
  emoji?: string
  rightSlot?: React.ReactNode
}

export function TopBar({ back, title, emoji, rightSlot }: Props) {
  const { t } = useTranslation()
  const backLabel = back?.label ?? t('common.back')
  return (
    <Flex asChild align="center" justify="between" gap="3" mb="5" wrap="wrap">
      <header>
        <Flex align="center" gap="3" minWidth="0">
          {back ? (
            <Tooltip content={backLabel}>
              <IconButton asChild variant="soft" radius="full" aria-label={backLabel}>
                <Link to={back.to}>
                  <ArrowLeftIcon />
                </Link>
              </IconButton>
            </Tooltip>
          ) : null}
          {emoji ? (
            <Text size="6" asChild>
              <span aria-hidden>{emoji}</span>
            </Text>
          ) : null}
          {title ? (
            <Box minWidth="0">
              <Heading
                size="5"
                weight="bold"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </Heading>
            </Box>
          ) : null}
        </Flex>
        {rightSlot ? <Box>{rightSlot}</Box> : null}
      </header>
    </Flex>
  )
}
