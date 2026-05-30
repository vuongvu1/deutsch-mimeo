// Cheat mode: doubles the listen timer so the 30-min goal is met in 15 real
// minutes. Activated via ?cheat=true and kept in sessionStorage, so it survives
// in-tab navigation but turns off when the tab closes (or via ?cheat=false).

export const CHEAT_STORAGE_KEY = 'mimeo:cheat'
export const CHEAT_MULTIPLIER = 2

// true for 'true'/'1', false for 'false'/'0', null when absent/unrecognized.
export function parseCheatParam(search: string): boolean | null {
  const raw = new URLSearchParams(search).get('cheat')
  if (raw === null) return null
  const v = raw.toLowerCase()
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return null
}

export function getStoredCheat(): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(CHEAT_STORAGE_KEY) === 'true'
}

export function setStoredCheat(on: boolean): void {
  if (typeof window === 'undefined') return
  if (on) window.sessionStorage.setItem(CHEAT_STORAGE_KEY, 'true')
  else window.sessionStorage.removeItem(CHEAT_STORAGE_KEY)
}
