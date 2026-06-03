import { useRegisterSW } from 'virtual:pwa-register/react'

const POLL_INTERVAL_MS = 5 * 60 * 1000

export interface UpdateState {
  updateAvailable: boolean
  applyUpdate: () => void
}

export function useUpdateAvailable(): UpdateState {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // No teardown: onRegisteredSW fires once and AppHeader (the only consumer)
      // stays mounted for the whole session, so these are app-lifetime listeners.
      const update = () => void registration.update()
      window.setInterval(update, POLL_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') update()
      })
    },
  })

  return {
    updateAvailable: needRefresh,
    applyUpdate: () => void updateServiceWorker(true),
  }
}
