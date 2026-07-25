/**
 * cache/policy.ts
 *
 * Single source of truth for cache TTLs and metadata types.
 *
 * ── Design ────────────────────────────────────────────────────────────────────
 * TTLs are set per-platform based on two factors:
 *   1. Scrape cost  — expensive platforms (Meesho render=true, 10+ credits)
 *      get longer TTLs so one scrape serves many users.
 *   2. Price volatility — Amazon flash deals change hourly; Meesho prices
 *      are stable for days. Longer TTL on stable platforms is safe.
 *
 * All values are in milliseconds. Change them here only — never hardcode
 * TTL values anywhere else in the codebase.
 */

// ─── Per-platform TTL config ──────────────────────────────────────────────────

export interface PlatformCachePolicy {
  /** How long results stay valid in the in-process memory cache. */
  memTtlMs: number;
  /** How long results stay valid in MongoDB. */
  dbTtlMs: number;
  /** Human-readable label for logging. */
  label: string;
}

/**
 * Platform keys must match the lowercase platform name used in SearchProduct.platform
 * after .toLowerCase().replace(/\s+/g, '').
 */
export const PLATFORM_CACHE_POLICIES: Readonly<Record<string, PlatformCachePolicy>> = {
  amazon:   { memTtlMs: 2  * 60 * 60 * 1000, dbTtlMs: 2  * 60 * 60 * 1000, label: 'Amazon'   },
  flipkart: { memTtlMs: 4  * 60 * 60 * 1000, dbTtlMs: 4  * 60 * 60 * 1000, label: 'Flipkart' },
  myntra:   { memTtlMs: 12 * 60 * 60 * 1000, dbTtlMs: 12 * 60 * 60 * 1000, label: 'Myntra'   },
  ajio:     { memTtlMs: 12 * 60 * 60 * 1000, dbTtlMs: 12 * 60 * 60 * 1000, label: 'Ajio'     },
  meesho:   { memTtlMs: 24 * 60 * 60 * 1000, dbTtlMs: 24 * 60 * 60 * 1000, label: 'Meesho'   },
};

/**
 * Default policy used when a platform is not in the table above.
 * Conservative: 6h mem, 6h DB.
 */
export const DEFAULT_CACHE_POLICY: PlatformCachePolicy = {
  memTtlMs: 6  * 60 * 60 * 1000,
  dbTtlMs:  6  * 60 * 60 * 1000,
  label: 'unknown',
};

/**
 * The TTL used for the full-query cache entry (all platforms combined).
 * Set to the MINIMUM platform TTL so the cache expires as soon as the
 * freshest platform's data would be stale.
 */
export const QUERY_CACHE_TTL_MS = Math.min(
  ...Object.values(PLATFORM_CACHE_POLICIES).map(p => p.dbTtlMs),
); // = 2h (Amazon)

/**
 * MongoDB TTL index value in seconds. Must be >= QUERY_CACHE_TTL_MS / 1000.
 * Set to 24h so documents are never deleted before the longest platform TTL.
 * The application-level TTL check (QUERY_CACHE_TTL_MS) controls freshness;
 * the MongoDB TTL index is just a cleanup mechanism.
 */
export const MONGO_TTL_SECONDS = 24 * 60 * 60; // 24h

// ─── Cache metadata ───────────────────────────────────────────────────────────

export type CacheSource = 'memory' | 'mongodb' | 'live';

export interface CacheMeta {
  /** ISO timestamp when the data was originally fetched from the platforms. */
  fetchedAt: string;
  /** ISO timestamp when this cache entry expires (fetchedAt + TTL). */
  expiresAt: string;
  /** Age of the cache entry in milliseconds at the time of this response. */
  cacheAgeMs: number;
  /** Where the data came from for this response. */
  cacheSource: CacheSource;
  /** True when cacheAgeMs > QUERY_CACHE_TTL_MS — prices may have changed. */
  isStale: boolean;
}

/** Builds a CacheMeta object from a fetchedAt timestamp and source. */
export function buildCacheMeta(fetchedAt: Date, source: CacheSource): CacheMeta {
  const now = Date.now();
  const fetchedAtMs = fetchedAt.getTime();
  const cacheAgeMs = now - fetchedAtMs;
  const expiresAt = new Date(fetchedAtMs + QUERY_CACHE_TTL_MS);
  return {
    fetchedAt:   fetchedAt.toISOString(),
    expiresAt:   expiresAt.toISOString(),
    cacheAgeMs,
    cacheSource: source,
    isStale:     cacheAgeMs > QUERY_CACHE_TTL_MS,
  };
}

/** CacheMeta for a brand-new live fetch. */
export function liveCacheMeta(): CacheMeta {
  return buildCacheMeta(new Date(), 'live');
}

// ─── Monitoring counters ──────────────────────────────────────────────────────
// In-process counters. Reset on cold start. Exported for the /api/admin/cache-stats endpoint.

export const cacheStats = {
  memHits:    0,
  dbHits:     0,
  misses:     0,  // live scrapes triggered
  creditsUsed: 0, // approximate, based on escalation tier
  byPlatform: {} as Record<string, { hits: number; misses: number; credits: number }>,
};

export function recordCacheHit(source: 'memory' | 'mongodb', query: string) {
  if (source === 'memory') cacheStats.memHits++;
  else cacheStats.dbHits++;
  console.log(`[cache] HIT source=${source} query="${query}"`);
}

export function recordCacheMiss(query: string) {
  cacheStats.misses++;
  console.log(`[cache] MISS query="${query}"`);
}

export function recordCredits(platform: string, credits: number) {
  cacheStats.creditsUsed += credits;
  const key = platform.toLowerCase();
  if (!cacheStats.byPlatform[key]) cacheStats.byPlatform[key] = { hits: 0, misses: 0, credits: 0 };
  cacheStats.byPlatform[key].credits += credits;
  cacheStats.byPlatform[key].misses++;
}

export function recordPlatformHit(platform: string) {
  const key = platform.toLowerCase();
  if (!cacheStats.byPlatform[key]) cacheStats.byPlatform[key] = { hits: 0, misses: 0, credits: 0 };
  cacheStats.byPlatform[key].hits++;
}
