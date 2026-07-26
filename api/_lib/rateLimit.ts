/**
 * rateLimit.ts
 *
 * In-process sliding-window rate limiter.
 *
 * Design decisions:
 *   - No Redis, no new npm packages. Module-level Map is sufficient for a
 *     single Vercel serverless function instance. Vercel spins up one process
 *     per concurrent request on the free tier, so this is per-instance — good
 *     enough to prevent a single session from flooding the DB within one
 *     request burst. A Redis-backed limiter is the correct upgrade path when
 *     the platform scales to multiple instances.
 *   - Sliding window (not fixed window) prevents the "boundary burst" attack
 *     where a client sends MAX requests at 00:59 and MAX again at 01:01.
 *   - Entries are pruned lazily on each check to avoid a background timer.
 *   - clearRateLimitStore() is exported for test teardown only.
 */

interface WindowEntry {
  timestamps: number[]; // epoch ms of each request in the current window
}

// key → sliding window state
const store = new Map<string, WindowEntry>();

export interface RateLimitOptions {
  /** Maximum number of requests allowed within windowMs. */
  max: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

/**
 * Check whether `key` has exceeded the rate limit.
 *
 * @returns true  — request is allowed (counter incremented)
 * @returns false — request is denied (limit exceeded)
 */
export function checkRateLimit(key: string, opts: RateLimitOptions): boolean {
  const now = Date.now();
  const windowStart = now - opts.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Prune timestamps outside the current window (lazy eviction)
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  if (entry.timestamps.length >= opts.max) {
    return false; // denied
  }

  entry.timestamps.push(now);
  return true; // allowed
}

/** Exposed for test teardown — do not call in production code. */
export function clearRateLimitStore(): void {
  store.clear();
}

/** Exposed for tests — returns current request count for a key. */
export function getRateLimitCount(key: string, windowMs: number): number {
  const entry = store.get(key);
  if (!entry) return 0;
  const windowStart = Date.now() - windowMs;
  return entry.timestamps.filter(t => t > windowStart).length;
}
