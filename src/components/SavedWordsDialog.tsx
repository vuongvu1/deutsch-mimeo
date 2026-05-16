import { BookmarkFilledIcon, SpeakerLoudIcon, TrashIcon } from '@radix-ui/react-icons'
import {
  Badge,
  Button,
  Dialog,
  Flex,
  IconButton,
  ScrollArea,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { useSavedWords, useUnsaveWord } from '@/hooks/useSavedWords'
import { speakGerman } from '@/lib/sounds'
import type { UserId } from '@/types/db'

interface Props {
  userId: UserId
}

export function SavedWordsDialog({ userId }: Props) {
  const { t } = useTranslation()
  const words = useSavedWords(userId).data ?? []
  const unsave = useUnsaveWord()
  const triggerLabel = t('vocab.saved.open', { count: words.length })

  return (
    <Dialog.Root>
      <Tooltip content={triggerLabel}>
        <Dialog.Trigger>
          <IconButton variant="soft" radius="full" aria-label={triggerLabel}>
            <BookmarkFilledIcon />
          </IconButton>
        </Dialog.Trigger>
      </Tooltip>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title mb="1">
          {t('vocab.saved.title')}
          <Badge size="1" variant="soft" radius="full" ml="2" style={{ verticalAlign: 'middle' }}>
            {words.length}
          </Badge>
        </Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          {t('vocab.saved.subtitle')}
        </Dialog.Description>

        {words.length === 0 ? (
          <Text size="2" color="gray" as="div">
            {t('vocab.saved.empty')}
          </Text>
        ) : (
          <ScrollArea type="auto" scrollbars="vertical" style={{ maxHeight: '60vh' }}>
            <Flex direction="column" gap="2" pr="3">
              {words.map((w) => (
                <Flex
                  key={w.id}
                  align="center"
                  justify="between"
                  gap="3"
                  px="3"
                  py="2"
                  style={{
                    border: '1px solid var(--gray-a5)',
                    borderRadius: 'var(--radius-3)',
                  }}
                >
                  <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                    <Text size="3" weight="medium" truncate>
                      {w.de}
                    </Text>
                    <Text size="2" color="gray" truncate>
                      {w.en}
                    </Text>
                  </Flex>
                  <Flex gap="1" align="center" flexShrink="0">
                    <Tooltip content={t('vocab.saved.speak')}>
                      <IconButton
                        variant="ghost"
                        size="2"
                        aria-label={t('vocab.saved.speak')}
                        onClick={() => speakGerman(w.de)}
                      >
                        <SpeakerLoudIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content={t('vocab.saved.remove')}>
                      <IconButton
                        variant="ghost"
                        color="red"
                        size="2"
                        aria-label={t('vocab.saved.remove')}
                        onClick={() =>
                          unsave.mutate({ user_id: userId, de: w.de })
                        }
                      >
                        <TrashIcon />
                      </IconButton>
                    </Tooltip>
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </ScrollArea>
        )}

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
