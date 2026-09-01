package utils

import (
	"sync"
	"time"
)

// A simple fixed-window rate limiter, in process memory. Good enough for a
// single backend instance (this app isn't horizontally scaled) — if that
// ever changes, this would need to move to something shared like Redis so
// multiple instances agree on the count.
type RateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*rateVisitor
	limit    int
	window   time.Duration
}

type rateVisitor struct {
	count      int
	windowFrom time.Time
}

// NewRateLimiter creates a limiter allowing at most `limit` calls to
// Allow() per `window` for any given key, and starts a background sweep
// that forgets keys whose window has long since passed — otherwise the
// visitor map would grow forever for a long-running process, one entry per
// unique key (IP, or IP+email) ever seen.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*rateVisitor),
		limit:    limit,
		window:   window,
	}
	go rl.sweepLoop()
	return rl
}

// Allow reports whether key is still within its limit for the current
// window. Each call counts, whether it returns true or false.
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	v, ok := rl.visitors[key]
	if !ok || now.Sub(v.windowFrom) > rl.window {
		rl.visitors[key] = &rateVisitor{count: 1, windowFrom: now}
		return true
	}
	if v.count >= rl.limit {
		return false
	}
	v.count++
	return true
}

func (rl *RateLimiter) sweepLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, v := range rl.visitors {
			if now.Sub(v.windowFrom) > rl.window {
				delete(rl.visitors, key)
			}
		}
		rl.mu.Unlock()
	}
}
