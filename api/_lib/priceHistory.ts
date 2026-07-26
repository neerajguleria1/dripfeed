/**
 * priceHistory.ts — repository layer for price snapshots.
 *
 * ── Architecture note ─────────────────────────────────────────────────────────
 * All MongoDB access is isolated here. To migrate to Redis, ClickHouse, or
 * TimescaleDB later, only this file changes — the handler and search.ts
 * call the same exported functions unchanged.
 *
 * ── Live-only guarantee ───────────────────────────────────────────────────────
 * saveBulkSnapshots() is called ONLY from the live-scrape path in search.ts,
 * after Promise.all resolves. Cache hits (memory or MongoDB) return before
 * that code path is reached, so cached responses never write history.
 *
 * ── Dedup strategy ───────────────────────────────────────────────────────────
 * One aggregation fetches the latest price for every (productId, platform)
 * pair seen in the last DEDUP_WINDOW_MS. We build an in-memory map, filter
 * out unchanged prices, then do a single insertMany for the remainder.
 * This is always 2 DB round-trips regardless of result-set size.
 *
 *   Same price within window  → skip (no insert)
 *   Price changed             → always insert
 *   No prior entry            → insert
 */

import { connectDB } from './db.js';
import PriceHistory, { type IPriceHistory } from './models/PriceHistory.js';

const DEDUP_WINDOW_MS =
  (parseInt(process.env.PRICE_HISTORY_DEDUP_HOURS ?? '24', 10) || 24) * 60 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SnapshotInput {
  canonicalId:   string;
  platform:      string;
  productId:     string;
  price:         number;
  originalPrice?: number;
  discount?:     number;
  rating?:       number;
  fetchedAt:     Date;
}

export type HistoryPoint = Pick<
  IPriceHistory,
  'platform' | 'price' | 'originalPrice' | 'discount' | 'fetchedAt' | 'rating'
>;

export interface PriceStats {
  lowestPrice:   number;
  highestPrice:  number;
  latestPrice:   number;
  firstSeen:     Date;
  lastUpdated:   Date;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Bulk-persist price snapshots after a live scrape.
 * Fire-and-forget safe — all errors are caught and logged, never thrown.
 */
export async function saveBulkSnapshots(inputs: SnapshotInput[]): Promise<void> {
  if (!inputs.length) return;

  try {
    await connectDB();

    const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS);

    // One aggregation: latest price per (productId, platform) within the dedup window
    const recentDocs = await PriceHistory.aggregate<{
      _id:         { productId: string; platform: string };
      latestPrice: number;
    }>([
      {
        $match: {
          productId: { $in: inputs.map(i => i.productId) },
          fetchedAt: { $gte: windowStart },
        },
      },
      { $sort: { fetchedAt: -1 } },
      {
        $group: {
          _id:         { productId: '$productId', platform: '$platform' },
          latestPrice: { $first: '$price' },
        },
      },
    ]);

    // Build lookup: "productId::platform" → latestPrice
    const seen = new Map<string, number>();
    for (const doc of recentDocs) {
      seen.set(`${doc._id.productId}::${doc._id.platform}`, doc.latestPrice);
    }

    const toInsert = inputs.filter(i => {
      const key   = `${i.productId}::${i.platform.toLowerCase()}`;
      const last  = seen.get(key);
      return last === undefined || last !== i.price;
    });

    if (!toInsert.length) return;

    await PriceHistory.insertMany(
      toInsert.map(i => ({
        canonicalId:   i.canonicalId,
        platform:      i.platform.toLowerCase(),
        productId:     i.productId,
        price:         i.price,
        originalPrice: i.originalPrice,
        discount:      i.discount,
        rating:        i.rating,
        fetchedAt:     i.fetchedAt,
      })),
      { ordered: false }, // partial failure is acceptable
    );

    console.log(`[priceHistory] +${toInsert.length} snapshots (${inputs.length - toInsert.length} deduped)`);
  } catch (e: any) {
    // Non-fatal — history must never break search responses
    console.error('[priceHistory] saveBulkSnapshots error:', e?.message?.slice(0, 120));
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Chronological price history for a canonical product.
 * days must be ≤ PRICE_HISTORY_RETENTION_DAYS (default 90).
 */
export async function getPriceHistory(
  canonicalId: string,
  days: 30 | 90,
  platform?: string,
): Promise<HistoryPoint[]> {
  await connectDB();

  const since: Record<string, unknown> = {
    canonicalId,
    fetchedAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
  };
  if (platform) since.platform = platform.toLowerCase();

  return PriceHistory.find(
    since,
    { platform: 1, price: 1, originalPrice: 1, discount: 1, fetchedAt: 1, rating: 1, _id: 0 },
  )
    .sort({ fetchedAt: 1 })
    .lean();
}

/**
 * Aggregate stats for a canonical product within the retention window.
 * Single aggregation — one DB round-trip.
 */
export async function getPriceStats(
  canonicalId: string,
  platform?: string,
): Promise<PriceStats | null> {
  await connectDB();

  const match: Record<string, unknown> = { canonicalId };
  if (platform) match.platform = platform.toLowerCase();

  const [result] = await PriceHistory.aggregate<PriceStats>([
    { $match: match },
    {
      $group: {
        _id:          null,
        lowestPrice:  { $min: '$price' },
        highestPrice: { $max: '$price' },
        latestPrice:  { $last: '$price' },  // last in fetchedAt-ascending order
        firstSeen:    { $min: '$fetchedAt' },
        lastUpdated:  { $max: '$fetchedAt' },
      },
    },
    { $project: { _id: 0 } },
  ]);

  return result ?? null;
}
