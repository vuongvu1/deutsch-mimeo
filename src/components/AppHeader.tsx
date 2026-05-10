import { MoonIcon, SunIcon } from '@radix-ui/react-icons'
import { Box, Container, Flex, Heading, IconButton, Select } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { paths } from '@/routes/paths'
import { useAppearance } from '@/theme/ThemeProvider'

export function AppHeader() {
  const { t, i18n } = useTranslation()
  const { appearance, toggle } = useAppearance()

  const currentLang = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'de'

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
                <Select.Trigger
                  variant="soft"
                  aria-label={t('header.languageLabel')}
                />
                <Select.Content>
                  <Select.Item value="de">🇩🇪 DE</Select.Item>
                  <Select.Item value="en">🇬🇧 EN</Select.Item>
                </Select.Content>
              </Select.Root>
              <IconButton
                variant="soft"
                onClick={toggle}
                aria-label={
                  appearance === 'dark' ? t('header.themeLight') : t('header.themeDark')
                }
              >
                {appearance === 'dark' ? <SunIcon /> : <MoonIcon />}
              </IconButton>
            </Flex>
          </Flex>
        </Container>
      </header>
    </Box>
  )
}
