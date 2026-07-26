/**
 * trendingEngine.ts
 *
 * Trending Products engine.
 *
 * ── Signal sources ────────────────────────────────────────────────────────────
 * All signals come from the existing AnalyticsEvent collection — no new writes.
 *
 *   view           → product_detail_viewed
 *   compareClick   → compare_opened
 *   wishlistAdd    → wishlist_added
 *   affiliateClick → affiliate_link_clicked
 *   priceAlert     → alert_created
 *
 * ── Recency decay ─────────────────────────────────────────────────────────────
 * Each event is weighted by exp(-λ * ageHours) where λ = ln(2) / halfLifeHours.
 * Default half-life: 12h (score halves every 12 hours).
 * This is computed in the MongoDB aggregation pipeline via $subtract + $divide.
 *
 * ── Rolling windows ───────────────────────────────────────────────────────────
 * 24h, 7d, 30d — each window runs a separate aggregation.
 * Results are merged: a product appearing in multiple windows gets a combined
 * score that rewards sustained trending (not just a single spike).
 *
 * ── Caching ───────────────────────────────────────────────────────────────────
 * Results cached in LRUCache per (window, category) key.
 * TTL: TRENDING_CACHE_TTL_MS (default 10 min). Configurable via env var.
 * Admin weight changes call invalidateTrendingCache() to bust the cache.
 *
 * ── Admin weights ─────────────────────────────────────────────────────────────
 * Loaded from TrendingConfig singleton. Cached for WEIGHTS_CACHE_TTL_MS (5 min).
 * Falls back to DEFAULT_WEIGHTS if the DB document doesn't exist yet.
 */

import { LRUCache } from './lruCache.js';
import type { ITrendingWeights } from './models/TrendingConfig.js';
import { DEFAULT_WEIGHTS } from './models/TrendingConfig.js';

// ─── Config ───────────────────────────────────────────────────────────────────

export const TRENDING_CACHE_TTL_MS =
  Number(process.env.TRENDING_CACHE_TTL_MS) || 10 * 60 * 1000; // 10 min

const WEIGHTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/** Recency decay half-life in hours. Score halves every N hours. */
const DECAY_HALF_LIFE_HOURS = 12;

/** Max products returned per window. */
export const TRENDING_LIMIT = 20;

/** Max LRU entries — one per (window × category) combination. */
const CACHE_SIZE = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrendingWindow = '24h' | '7d' | '30d';

export interface TrendingProduct {
  canonicalId:  string;
  productTitle: string;
  platform?:    string;
  score:        number;
  /** Breakdown of signal contributions (for admin analytics). */
  signals: {
    views:          number;
    compareClicks:  number;
    wishlistAdds:   number;
    affiliateClicks: number;
    priceAlerts:    number;
  };
}

export interface TrendingResult {
  window:   TrendingWindow;
  products: TrendingProduct[];
  cachedAt: number;
  weights:  ITrendingWeights;
}

// ─── Module-level caches ──────────────────────────────────────────────────────

const trendingCache = new LRUCache<string, TrendingResult>({
  maxSize: CACHE_SIZE,
  ttlMs:   TRENDING_CACHE_TTL_MS,
});

let _weightsCache: { weights: ITrendingWeights; cachedAt: number } | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function windowToMs(window: TrendingWindow): number {
  if (window === '24h') return 24 * 60 * 60 * 1000;
  if (window === '7d')  return 7  * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

function cacheKey(window: TrendingWindow, category?: string): string {
  return `${window}:${category ?? '__all__'}`;
}

// ─── Weight loading ───────────────────────────────────────────────────────────

async function loadWeights(): Promise<ITrendingWeights> {
  if (_weightsCache && Date.now() - _weightsCache.cachedAt < WEIGHTS_CACHE_TTL_MS) {
    return _weightsCache.weights;
  }
  try {
    const TrendingConfig = (await import('./models/TrendingConfig.js')).default;
    const doc = await TrendingConfig.findOne({ key: 'default' }).lean();
    const weights = doc?.weights ?? DEFAULT_WEIGHTS;
    _weightsCache = { weights, cachedAt: Date.now() };
    return weights;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

// ─── Core aggregation ─────────────────────────────────────────────────────────

/**
 * Aggregates signals with per-event recency decay.
 * Uses a separate aggregation that groups by (canonicalId, event, hourBucket)
 * so we can apply exp(-λ * ageHours) per bucket.
 */
async function aggregateWithDecay(
  from: Date,
  category?: string,
): Promise<Map<string, { title: string; platform?: string; decayedSignals: TrendingProduct['signals'] }>> {
  const AnalyticsEvent = (await import('./models/AnalyticsEvent.js')).default;

  const EVENT_SIGNAL_MAP: Record<string, keyof TrendingProduct['signals']> = {
    product_detail_viewed:  'views',
    compare_opened:         'compareClicks',
    wishlist_added:         'wishlistAdds',
    affiliate_link_clicked: 'affiliateClicks',
    alert_created:          'priceAlerts',
  };

  const matchFilter: Record<string, unknown> = {
    event: { $in: Object.keys(EVENT_SIGNAL_MAP) },
    ts:    { $gte: from },
    canonicalId: { $exists: true, $ne: '' },
  };
  if (category?.trim()) matchFilter['query'] = { $regex: category.trim(), $options: 'i' };

  // Group by (canonicalId, event, 1-hour bucket) to compute decay per bucket
  const rows = await AnalyticsEvent.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: {
          canonicalId: '$canonicalId',
          event:       '$event',
          // Truncate to hour bucket for decay calculation
          hourBucket: {
            $subtract: [
              '$ts',
              { $mod: [{ $toLong: '$ts' }, 3600000] },
            ],
          },
        },
        count:        { $sum: 1 },
        productTitle: { $first: '$productTitle' },
        platform:     { $first: '$platform' },
        bucketTs:     { $first: '$ts' },
      },
    },
    {
      $group: {
        _id:          '$_id.canonicalId',
        productTitle: { $first: '$productTitle' },
        platform:     { $first: '$platform' },
        buckets: {
          $push: {
            event:    '$_id.event',
            count:    '$count',
            bucketTs: '$_id.hourBucket',
          },
        },
      },
    },
  ]);

  const now = Date.now();
  const lambda = Math.LN2 / DECAY_HALF_LIFE_HOURS;

  const result = new Map<string, { title: string; platform?: string; decayedSignals: TrendingProduct['signals'] }>();

  for (const row of rows) {
    const decayedSignals: TrendingProduct['signals'] = {
      views: 0, compareClicks: 0, wishlistAdds: 0, affiliateClicks: 0, priceAlerts: 0,
    };

    for (const bucket of row.buckets) {
      const ageHours = (now - Number(bucket.bucketTs)) / 3600000;
      const decay = Math.exp(-lambda * Math.max(0, ageHours));
      const key = EVENT_SIGNAL_MAP[bucket.event];
      if (key) decayedSignals[key] += bucket.count * decay;
    }

    result.set(row._id, {
      title:    row.productTitle ?? '',
      platform: row.platform,
      decayedSignals,
    });
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns trending products for the given window, sorted by weighted score desc.
 *
 * @param window    Rolling window: '24h' | '7d' | '30d'
 * @param category  Optional category filter (regex match on query field)
 * @param limit     Max products to return (default TRENDING_LIMIT)
 */
export async function getTrending(
  window: TrendingWindow = '7d',
  category?: string,
  limit = TRENDING_LIMIT,
): Promise<TrendingResult> {
  const key = cacheKey(window, category);
  const cached = trendingCache.get(key);
  if (cached) return cached;

  const { connectDB } = await import('./db.js');
  await connectDB();

  const [weights, decayMap] = await Promise.all([
    loadWeights(),
    aggregateWithDecay(new Date(Date.now() - windowToMs(window)), category),
  ]);

  const products: TrendingProduct[] = [];

  for (const [canonicalId, data] of decayMap) {
    if (!canonicalId) continue;
    const s = data.decayedSignals;
    const score =
      s.views          * weights.view +
      s.compareClicks  * weights.compareClick +
      s.wishlistAdds   * weights.wishlistAdd +
      s.affiliateClicks * weights.affiliateClick +
      s.priceAlerts    * weights.priceAlert;

    if (score <= 0) continue;

    products.push({
      canonicalId,
      productTitle: data.title,
      platform:     data.platform,
      score,
      signals: {
        views:           Math.round(s.views),
        compareClicks:   Math.round(s.compareClicks),
        wishlistAdds:    Math.round(s.wishlistAdds),
        affiliateClicks: Math.round(s.affiliateClicks),
        priceAlerts:     Math.round(s.priceAlerts),
      },
    });
  }

  products.sort((a, b) => b.score - a.score);

  const result: TrendingResult = {
    window,
    products: products.slice(0, limit),
    cachedAt: Date.now(),
    weights,
  };

  trendingCache.set(key, result);
  return result;
}

/**
 * Returns trending data for all three windows in parallel.
 * Used by the admin analytics endpoint.
 */
export async function getTrendingAllWindows(category?: string): Promise<{
  '24h': TrendingResult;
  '7d':  TrendingResult;
  '30d': TrendingResult;
}> {
  const [h24, d7, d30] = await Promise.all([
    getTrending('24h', category),
    getTrending('7d',  category),
    getTrending('30d', category),
  ]);
  return { '24h': h24, '7d': d7, '30d': d30 };
}

/** Invalidates all trending cache entries (call after admin weight update). */
export function invalidateTrendingCache(): void {
  trendingCache.clear();
  _weightsCache = null;
}

/** Exposed for tests. */
export const _trendingCache = trendingCache;
export function _clearWeightsCache() { _weightsCache = null; }
