/**
 * analytics.ts  (backend)
 *
 * Write queue + batch flush + aggregation helpers.
 *
 * Design:
 *   - Events are pushed into an in-memory queue
 *   - A debounced flush writes them in a single insertMany({ordered:false})
 *   - Aggregations are memoized with a 5-minute TTL to avoid hammering MongoDB
 *   - All writes are fire-and-forget — errors are logged but never thrown
 */

import { connectDB } from './db.js';
import AnalyticsEvent from './models/AnalyticsEvent.js';
import type { IAnalyticsEvent } from './models/AnalyticsEvent.js';
import { LRUCache } from './lruCache.js';

// ─── Dashboard aggregation timeout ───────────────────────────────────────────
// 13 parallel aggregations on Atlas M0 can stall under load. Cap the entire
// Promise.all at 8 s so the dashboard never hangs indefinitely.
const DASHBOARD_TIMEOUT_MS = 8000;

function withDashboardTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Dashboard aggregation timed out')), DASHBOARD_TIMEOUT_MS)
    ),
  ]);
}

// ─── Write queue ──────────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 5000;   // flush every 5 seconds
const MAX_QUEUE_SIZE    = 200;    // safety valve — flush early if queue grows large

let queue: Omit<IAnalyticsEvent, '_id'>[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
}

async function flush() {
  flushTimer = null;
  if (!queue.length) return;
  const batch = queue.splice(0, queue.length);
  try {
    await connectDB();
    await AnalyticsEvent.insertMany(batch, { ordered: false });
  } catch {
    // Non-fatal — analytics must never crash the app
  }
}

export function enqueueEvent(event: Omit<IAnalyticsEvent, '_id'>) {
  queue.push(event);
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Don't await — fire and forget
    flush().catch(() => {});
  } else {
    scheduleFlush();
  }
}

// ─── Aggregation cache ────────────────────────────────────────────────────────
// Bounded LRU (max 50 entries — one per unique days value, with headroom).
// Previously an unbounded Map; LRU prevents memory growth if callers pass
// arbitrary `days` values.
const AGG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const aggCache = new LRUCache<string, unknown>({ maxSize: 50, ttlMs: AGG_CACHE_TTL_MS });

function getCached<T>(key: string): T | null {
  return aggCache.get(key) as T | null;
}

function setCached(key: string, data: unknown) {
  aggCache.set(key, data);
}

// ─── Dashboard aggregations ───────────────────────────────────────────────────

/** Rolling window for all dashboard queries */
function since(days: number) {
  return new Date(Date.now() - days * 86400_000);
}

export async function getDashboardMetrics(days = 7) {
  const cacheKey = `dashboard:${days}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return cached;

  await connectDB();
  const from = since(days);

  const [
    topSearches,
    topProducts,
    topPlatforms,
    noResultSearches,
    searchCount,
    affiliateClicks,
    searchResultViews,
    recommendationClicks,
    recommendationViews,
    avgLatencyResult,
    deviceBreakdown,
    _topBrands,
    eventTotals,
  ] = await withDashboardTimeout(Promise.all([

    // Top searches by frequency
    AnalyticsEvent.aggregate([
      { $match: { event: 'search_performed', ts: { $gte: from }, query: { $exists: true, $ne: '' } } },
      { $group: { _id: '$query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // Top products by detail views
    AnalyticsEvent.aggregate([
      { $match: { event: 'product_detail_viewed', ts: { $gte: from }, productTitle: { $exists: true } } },
      { $group: { _id: '$productTitle', views: { $sum: 1 }, canonicalId: { $first: '$canonicalId' } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]),

    // Most clicked retailers
    AnalyticsEvent.aggregate([
      { $match: { event: 'affiliate_link_clicked', ts: { $gte: from }, platform: { $exists: true } } },
      { $group: { _id: '$platform', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 10 },
    ]),

    // No-result searches
    AnalyticsEvent.aggregate([
      { $match: { event: 'no_results_search', ts: { $gte: from }, query: { $exists: true } } },
      { $group: { _id: '$query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // Total searches
    AnalyticsEvent.countDocuments({ event: 'search_performed', ts: { $gte: from } }),

    // Total affiliate clicks
    AnalyticsEvent.countDocuments({ event: 'affiliate_link_clicked', ts: { $gte: from } }),

    // Total search result views (for CTR calc)
    AnalyticsEvent.countDocuments({ event: 'search_result_viewed', ts: { $gte: from } }),

    // Recommendation clicks
    AnalyticsEvent.countDocuments({ event: 'recommendation_clicked', ts: { $gte: from } }),

    // Recommendation section views
    AnalyticsEvent.countDocuments({ event: 'recommendation_section_viewed', ts: { $gte: from } }),

    // Average search latency
    AnalyticsEvent.aggregate([
      { $match: { event: 'search_performed', ts: { $gte: from }, latencyMs: { $exists: true, $gt: 0 } } },
      { $group: { _id: null, avgLatency: { $avg: '$latencyMs' }, count: { $sum: 1 } } },
    ]),

    // Device breakdown
    AnalyticsEvent.aggregate([
      { $match: { ts: { $gte: from } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
    ]),

    // Top brands (from product_detail_viewed — productTitle prefix heuristic)
    AnalyticsEvent.aggregate([
      { $match: { event: 'product_detail_viewed', ts: { $gte: from }, productTitle: { $exists: true } } },
      { $group: { _id: '$productTitle', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 20 },
    ]),

    // Event totals for summary
    AnalyticsEvent.aggregate([
      { $match: { ts: { $gte: from } } },
      { $group: { _id: '$event', count: { $sum: 1 } } },
    ]),
  ]));

  // Derived metrics
  const noResultCount = noResultSearches.reduce((s: number, x: any) => s + x.count, 0);
  const searchSuccessRate = searchCount > 0
    ? Math.round(((searchCount - noResultCount) / searchCount) * 100)
    : 100;

  const ctr = searchResultViews > 0
    ? Math.round((affiliateClicks / searchResultViews) * 100 * 10) / 10
    : 0;

  const recCtr = recommendationViews > 0
    ? Math.round((recommendationClicks / recommendationViews) * 100 * 10) / 10
    : 0;

  const avgLatency = avgLatencyResult[0]?.avgLatency
    ? Math.round(avgLatencyResult[0].avgLatency)
    : null;

  const totalsMap: Record<string, number> = {};
  for (const e of eventTotals) totalsMap[e._id] = e.count;

  const result = {
    period: { days, from: from.toISOString() },
    summary: {
      totalSearches:       searchCount,
      totalAffiliateClicks: affiliateClicks,
      totalProductViews:   totalsMap['product_detail_viewed'] ?? 0,
      totalCompares:       totalsMap['compare_opened'] ?? 0,
      totalWishlistAdds:   totalsMap['wishlist_added'] ?? 0,
      searchSuccessRate,
      ctr,
      recCtr,
      avgSearchLatencyMs:  avgLatency,
      noResultSearchCount: noResultCount,
    },
    topSearches:      topSearches.map((x: any) => ({ query: x._id, count: x.count })),
    topProducts:      topProducts.map((x: any) => ({ title: x._id, views: x.views, canonicalId: x.canonicalId })),
    topPlatforms:     topPlatforms.map((x: any) => ({ platform: x._id, clicks: x.clicks })),
    noResultSearches: noResultSearches.map((x: any) => ({ query: x._id, count: x.count })),
    deviceBreakdown:  deviceBreakdown.map((x: any) => ({ device: x._id, count: x.count })),
    eventTotals:      totalsMap,
  };

  setCached(cacheKey, result);
  return result;
}

/** Flush any remaining queued events — call on process exit / test teardown */
export async function flushAll() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  await flush();
}

/** Exposed for tests */
export function getQueueLength() { return queue.length; }
export function clearQueue() { queue = []; if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; } }
export function clearAggCache() { aggCache.clear(); }
export { DASHBOARD_TIMEOUT_MS };
