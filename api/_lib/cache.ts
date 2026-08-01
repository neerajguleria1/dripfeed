/**
 * cache.ts
 *
 * Generic in-memory LRU cache with TTL-based expiry for feed endpoints.
 *
 * Uses a plain Map with periodic cleanup — no external dependencies.
 * Each serverless instance maintains its own cache (cleared on cold start).
 *
 * Configured presets:
 *   - homeFeed:     TTL 15min, max 10 entries
 *   - discoverFeed: TTL 5min,  max 50 entries
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  timestamp: number; // Date.now() when cached
  ttl: number;       // TTL in milliseconds
}

export interface CacheConfig {
  ttl: number;       // Default TTL in milliseconds
  maxEntries: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export const CACHE_CONFIG = {
  homeFeed: { ttl: 15 * 60 * 1000, maxEntries: 10 } as CacheConfig,
  discoverFeed: { ttl: 5 * 60 * 1000, maxEntries: 50 } as CacheConfig,
} as const;

// ─── Internal Store ───────────────────────────────────────────────────────────

const store = new Map<string, CacheEntry<unknown>>();

// ─── Periodic Cleanup ─────────────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 60 * 1000; // Run cleanup every 60 seconds
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupTimer !== null) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.timestamp >= entry.ttl) {
        store.delete(key);
      }
    }
    // If store is empty, stop the timer to avoid keeping the process alive
    if (store.size === 0 && cleanupTimer !== null) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow the process to exit even if the timer is active (serverless)
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ─── LRU Eviction Helper ──────────────────────────────────────────────────────

function evictIfNeeded(maxEntries: number): void {
  while (store.size >= maxEntries) {
    // Map iterator order = insertion order; first key = least recently used
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) {
      store.delete(oldestKey);
    } else {
      break;
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve a cached value by key. Returns `null` if not found or expired.
 * Accessing an entry moves it to the "most recently used" position (LRU).
 */
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp >= entry.ttl) {
    // Expired — lazy eviction
    store.delete(key);
    return null;
  }

  // Move to tail (most recently used) by re-inserting
  store.delete(key);
  store.set(key, entry);

  return entry.data as T;
}

/**
 * Store a value in the cache with an explicit TTL (in milliseconds).
 * If the cache exceeds maxEntries for the inferred config, the LRU entry
 * is evicted.
 */
export function cacheSet<T>(key: string, data: T, ttl: number): void {
  // Determine max entries from the TTL to infer which preset applies
  const maxEntries = getMaxEntriesForTtl(ttl);

  // Remove existing entry first (ensures re-insertion moves it to tail)
  if (store.has(key)) {
    store.delete(key);
  }

  evictIfNeeded(maxEntries);

  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl,
  };

  store.set(key, entry as CacheEntry<unknown>);

  // Ensure cleanup is running
  startCleanup();
}

/**
 * Remove a specific key from the cache.
 */
export function cacheInvalidate(key: string): void {
  store.delete(key);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Infer max entries based on TTL. Matches CACHE_CONFIG presets:
 *   - 15min TTL → homeFeed (max 10)
 *   - 5min TTL  → discoverFeed (max 50)
 *   - fallback  → 100 entries
 */
function getMaxEntriesForTtl(ttl: number): number {
  if (ttl === CACHE_CONFIG.homeFeed.ttl) return CACHE_CONFIG.homeFeed.maxEntries;
  if (ttl === CACHE_CONFIG.discoverFeed.ttl) return CACHE_CONFIG.discoverFeed.maxEntries;
  return 100; // Safe default for any custom TTL
}

// ─── Test Utilities (exported for testing only) ───────────────────────────────

/** Clear the entire cache and reset cleanup timer. Useful for tests. */
export function cacheClear(): void {
  store.clear();
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/** Get current cache size. */
export function cacheSize(): number {
  return store.size;
}
