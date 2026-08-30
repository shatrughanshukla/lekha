package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
)

// This is a correctness-based cache, not a time-based one: an insight is
// only ever reused when the EXACT numeric summary that would produce it
// hasn't changed since it was last generated. The moment a single transfer
// changes, the summary hash changes, and the cache misses — so a cached
// insight can never be stale, it can only be missing (which just means
// paying for one more Gemini call, not showing wrong information).
//
// This lives in process memory, so it resets on every server restart —
// fine for what it's for (avoiding repeat Gemini calls within a running
// session, e.g. someone clicking "Generate" twice, or the dashboard and a
// company view both loading insights close together). It is NOT a
// database-backed cache, so don't reach for it expecting it to survive
// deploys — that would need a table, not a bigger promise than this makes.

type cachedInsight struct {
	summaryHash string
	insight     string
}

var (
	insightCacheMu sync.RWMutex
	insightCache   = map[string]cachedInsight{}
)

// HashSummary returns a stable hex hash of the given JSON summary bytes —
// used as the "has anything actually changed" fingerprint.
func HashSummary(summaryJSON []byte) string {
	sum := sha256.Sum256(summaryJSON)
	return hex.EncodeToString(sum[:])
}

// GetCachedInsight returns a previously generated insight for cacheKey,
// but only if it was generated from the exact same summary hash. Returns
// ok=false on any miss (never cached, or the underlying data has changed).
func GetCachedInsight(cacheKey, summaryHash string) (insight string, ok bool) {
	insightCacheMu.RLock()
	defer insightCacheMu.RUnlock()
	entry, found := insightCache[cacheKey]
	if !found || entry.summaryHash != summaryHash {
		return "", false
	}
	return entry.insight, true
}

// SetCachedInsight stores a freshly generated insight against the summary
// hash that produced it, replacing whatever was cached for cacheKey before.
func SetCachedInsight(cacheKey, summaryHash, insight string) {
	insightCacheMu.Lock()
	defer insightCacheMu.Unlock()
	insightCache[cacheKey] = cachedInsight{summaryHash: summaryHash, insight: insight}
}
