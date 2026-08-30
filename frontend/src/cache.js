// A tiny in-memory cache, scoped to the page's lifetime (it resets on a
// hard reload, but survives navigating between screens within the app).
// That's exactly the case worth optimizing: Dashboard -> a company ->
// back to Dashboard shouldn't ever flash an empty "Loading…" state for
// data that was fetched moments ago. Pattern is stale-while-revalidate:
// components render cached data immediately, then a fresh fetch runs
// quietly in the background and replaces it when it lands.
//
// Deliberately NOT localStorage — this is financial data, and a cache
// that could silently show numbers from a previous browser session (after
// a real reload, days later) is a correctness risk, not just a UX one.
// Resetting on reload is the right tradeoff here.

const store = new Map()

export function getCached(key) {
  return store.has(key) ? store.get(key) : undefined
}

export function setCached(key, value) {
  store.set(key, value)
}

// Clears one exact key, or every key starting with a prefix (e.g.
// clearCached('company:abc-123:') after leaving/deleting a company).
export function clearCached(keyOrPrefix) {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix)
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(keyOrPrefix)) store.delete(key)
  }
}
