import { MoonIcon, ResetIcon, SunIcon, TrashIcon } from '@radix-ui/react-icons'
import {
  AlertDialog,
  Box,
  Button,
  Callout,
  Container,
  Flex,
  Heading,
  IconButton,
  Select,
  Tooltip,
} from '@radix-ui/themes'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useClearSessions, useResetData } from '@/hooks/useResetData'
import { paths } from '@/routes/paths'
import { useAppearance } from '@/theme/ThemeProvider'

export function AppHeader() {
  const { t, i18n } = useTranslation()
  const { appearance, toggle } = useAppearance()

  const currentLang = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'de'
  const themeTooltip =
    appearance === 'dark' ? t('header.themeLight') : t('header.themeDark')

  return (
    <Box
      asChild
      style={{
        borderBottom: '1px solid var(--gray-a4)',
        background: 'var(--color-panel-solid)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <header>
        <Container size="3" px={{ initial: '4', sm: '5' }} py="3">
          <Flex align="center" justify="between" gap="3">
            <Heading asChild size="4" weight="bold">
              <Link to={paths.home()}>🇩🇪 {t('header.appName')}</Link>
            </Heading>
            <Flex align="center" gap="2">
              <Select.Root
                value={currentLang}
                onValueChange={(v) => void i18n.changeLanguage(v)}
              >
                <Select.Trigger variant="soft" aria-label={t('header.languageLabel')} />
                <Select.Content>
                  <Select.Item value="de">🇩🇪 DE</Select.Item>
                  <Select.Item value="en">🇬🇧 EN</Select.Item>
                </Select.Content>
              </Select.Root>
              <Tooltip content={themeTooltip}>
                <IconButton variant="soft" onClick={toggle} aria-label={themeTooltip}>
                  {appearance === 'dark' ? <SunIcon /> : <MoonIcon />}
                </IconButton>
              </Tooltip>
              <DestructiveAction
                triggerIcon={<ResetIcon />}
                triggerColor="amber"
                triggerLabel={t('header.clearSessions')}
                title={t('clearSessions.title')}
                body={t('clearSessions.body')}
                confirmCta={t('clearSessions.confirmCta')}
                inProgressLabel={t('clearSessions.inProgress')}
                errorFallback={t('clearSessions.error')}
                useMutationHook={useClearSessions}
              />
              <DestructiveAction
                triggerIcon={<TrashIcon />}
                triggerColor="red"
                triggerLabel={t('header.reset')}
                title={t('reset.title')}
                body={t('reset.body')}
                confirmCta={t('reset.confirmCta')}
                inProgressLabel={t('reset.inProgress')}
                errorFallback={t('reset.error')}
                useMutationHook={useResetData}
              />
            </Flex>
          </Flex>
        </Container>
      </header>
    </Box>
  )
}

interface DestructiveActionProps {
  triggerIcon: ReactNode
  triggerColor: 'amber' | 'red'
  triggerLabel: string
  title: string
  body: string
  confirmCta: string
  inProgressLabel: string
  errorFallback: string
  useMutationHook: typeof useResetData
}

function DestructiveAction({
  triggerIcon,
  triggerColor,
  triggerLabel,
  title,
  body,
  confirmCta,
  inProgressLabel,
  errorFallback,
  useMutationHook,
}: DestructiveActionProps) {
  const { t } = useTranslation()
  const mutation = useMutationHook()
  const [open, setOpen] = useState(false)

  const onConfirm = (e: React.MouseEvent) => {
    e.preventDefault()
    mutation.mutate(undefined, {
      onSuccess: () => {
        setOpen(false)
        mutation.reset()
      },
    })
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) mutation.reset()
      }}
    >
      <Tooltip content={triggerLabel}>
        <AlertDialog.Trigger>
          <IconButton variant="soft" color={triggerColor} aria-label={triggerLabel}>
            {triggerIcon}
          </IconButton>
        </AlertDialog.Trigger>
      </Tooltip>
      <AlertDialog.Content maxWidth="450px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{body}</AlertDialog.Description>
        {mutation.error ? (
          <Box mt="3">
            <Callout.Root color="red" size="1">
              <Callout.Text>
                {mutation.error instanceof Error ? mutation.error.message : errorFallback}
              </Callout.Text>
            </Callout.Root>
          </Box>
        ) : null}
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
          </AlertDialog.Cancel>
          <Button
            variant="solid"
            color={triggerColor}
            disabled={mutation.isPending}
            onClick={onConfirm}
          >
            {mutation.isPending ? inProgressLabel : confirmCta}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  )
}
