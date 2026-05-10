import { Theme } from '@radix-ui/themes'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Appearance = 'light' | 'dark'

interface ThemeContextValue {
  appearance: Appearance
  setAppearance: (a: Appearance) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'mimeo:appearance'

function getInitialAppearance(): Appearance {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(getInitialAppearance)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, appearance)
    document.documentElement.style.colorScheme = appearance
  }, [appearance])

  const value: ThemeContextValue = {
    appearance,
    setAppearance,
    toggle: () => setAppearance((prev) => (prev === 'dark' ? 'light' : 'dark')),
  }

  return (
    <ThemeContext.Provider value={value}>
      <Theme appearance={appearance} accentColor="amber" grayColor="slate" radius="large">
        {children}
      </Theme>
    </ThemeContext.Provider>
  )
}

export function useAppearance() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useAppearance must be used inside ThemeProvider')
  return ctx
}
