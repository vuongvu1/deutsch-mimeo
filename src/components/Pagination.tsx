import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import { Button, Flex, Text } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  const { t } = useTranslation()
  return (
    <Flex gap="3" align="center" justify="center" mt="3">
      <Button
        variant="soft"
        color="gray"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label={t('common.prev')}
      >
        <ChevronLeftIcon />
        {t('common.prev')}
      </Button>
      <Text color="gray" size="2">
        {t('common.pageOf', { page, total: totalPages })}
      </Text>
      <Button
        variant="soft"
        color="gray"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label={t('common.next')}
      >
        {t('common.next')}
        <ChevronRightIcon />
      </Button>
    </Flex>
  )
}
