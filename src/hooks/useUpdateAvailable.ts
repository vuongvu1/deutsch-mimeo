import { useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 5 * 60 * 1000

function getMainScriptSrc(doc: Document): string | null {
  const scripts = Array.from(doc.querySelectorAll('script[src]'))
  for (const s of scripts) {
    const src = s.getAttribute('src') ?? ''
    if (src.includes('/assets/') && src.endsWith('.js')) return src
  }
  return null
}

export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    if (available) return
    if (import.meta.env.DEV) return
    const current = getMainScriptSrc(document)
    if (!current) return

    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch(`/index.html?ts=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const text = await res.text()
        const parsed = new DOMParser().parseFromString(text, 'text/html')
        const latest = getMainScriptSrc(parsed)
        if (!cancelled && latest && latest !== current) setAvailable(true)
      } catch {
        // ignore network errors
      }
    }

    const interval = window.setInterval(check, POLL_INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [available])

  return available
}
