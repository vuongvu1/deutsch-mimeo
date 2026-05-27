import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import '@/i18n'
import { prewarmPiper } from '@/lib/sounds'
import { router } from '@/routes/router'
import { ThemeProvider } from '@/theme/ThemeProvider'

import '@radix-ui/themes/styles.css'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)

if (typeof window !== 'undefined') {
  const schedule =
    typeof window.requestIdleCallback === 'function'
      ? (cb: () => void) => window.requestIdleCallback(() => cb(), { timeout: 2000 })
      : (cb: () => void) => window.setTimeout(cb, 1500)
  schedule(prewarmPiper)
}
