export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Efraimidis-Spirakis weighted shuffle: key = -ln(U) / weight, sort ascending.
// Higher weight => smaller expected key => earlier position.
export function weightedShuffle<T>(arr: readonly T[], weight: (item: T) => number): T[] {
  return arr
    .map((item) => ({ item, key: -Math.log(Math.random()) / Math.max(weight(item), 1e-9) }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item)
}
