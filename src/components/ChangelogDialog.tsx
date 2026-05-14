import { RocketIcon } from '@radix-ui/react-icons'
import {
  Badge,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { changelog, type ChangelogEntryType } from '@/lib/changelog'

const TYPE_COLORS: Record<ChangelogEntryType, 'green' | 'amber' | 'blue' | 'gray'> = {
  feature: 'green',
  fix: 'amber',
  improvement: 'blue',
  chore: 'gray',
}

export function ChangelogDialog() {
  const { t, i18n } = useTranslation()
  const triggerLabel = t('header.changelog')
  const lang: 'en' | 'de' = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'de'

  return (
    <Dialog.Root>
      <Tooltip content={triggerLabel}>
        <Dialog.Trigger>
          <IconButton variant="soft" aria-label={triggerLabel}>
            <RocketIcon />
          </IconButton>
        </Dialog.Trigger>
      </Tooltip>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>{t('changelog.title')}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          {t('changelog.subtitle')}
        </Dialog.Description>
        <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: '60vh' }}>
          <Flex direction="column" gap="4" pr="3">
            {changelog.map((v) => (
              <Flex key={v.version} direction="column" gap="2">
                <Flex align="baseline" gap="2" wrap="wrap">
                  <Heading size="3">v{v.version}</Heading>
                  <Text size="1" color="gray">
                    {v.date}
                  </Text>
                </Flex>
                {v.entries.map((entry, idx) => (
                  <Text key={idx} as="div" size="2">
                    <Badge
                      color={TYPE_COLORS[entry.type]}
                      variant="soft"
                      size="1"
                      mr="2"
                    >
                      {t(`changelog.types.${entry.type}`)}
                    </Badge>
                    {entry[lang]}
                  </Text>
                ))}
              </Flex>
            ))}
          </Flex>
        </ScrollArea>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              {t('common.close')}
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
