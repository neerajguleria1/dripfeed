/**
 * tests/unit/trendingService.test.ts
 *
 * Tests for trendingEngine.ts — scoring, decay, caching, weight loading.
 * Kept separate from trending.test.ts to avoid vi.mock hoisting conflicts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB + models ─────────────────────────────────────────────────────────

vi.mock('../../api/_lib/db.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

const mockAggregate = vi.fn();
vi.mock('../../api/_lib/models/AnalyticsEvent.js', () => ({
  default: { aggregate: (...a: any[]) => mockAggregate(...a) },
}));

const mockFindOne = vi.fn();
vi.mock('../../api/_lib/models/TrendingConfig.js', () => ({
  default: { findOne: (...a: any[]) => mockFindOne(...a) },
  DEFAULT_WEIGHTS: { view: 1, compareClick: 3, wishlistAdd: 4, affiliateClick: 5, priceAlert: 4 },
}));

import {
  getTrending,
  getTrendingAllWindows,
  invalidateTrendingCache,
  _trendingCache,
  _clearWeightsCache,
  TRENDING_LIMIT,
} from '../../api/_lib/trendingEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAggRow(canonicalId: string, events: { event: string; count: number }[], title = 'Test Product') {
  const now = Date.now();
  return {
    _id:          canonicalId,
    productTitle: title,
    platform:     'flipkart',
    buckets: events.map(e => ({
      event:    e.event,
      count:    e.count,
      bucketTs: now - 1000, // 1 second ago — near-zero decay
    })),
  };
}

function setupAggMock(rows: ReturnType<typeof makeAggRow>[]) {
  mockAggregate.mockResolvedValue(rows);
}

function setupWeightsMock(weights = { view: 1, compareClick: 3, wishlistAdd: 4, affiliateClick: 5, priceAlert: 4 }) {
  mockFindOne.mockReturnValue({ lean: () => Promise.resolve({ weights }) });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('trendingEngine — getTrending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTrendingCache();
    _clearWeightsCache();
  });

  it('returns empty products when no analytics events exist', async () => {
    setupAggMock([]);
    setupWeightsMock();
    const result = await getTrending('7d');
    expect(result.products).toEqual([]);
    expect(result.window).toBe('7d');
  });

  it('scores products using signal weights', async () => {
    setupWeightsMock({ view: 1, compareClick: 3, wishlistAdd: 4, affiliateClick: 5, priceAlert: 4 });
    setupAggMock([
      makeAggRow('canon_a', [
        { event: 'product_detail_viewed', count: 10 },   // 10 * 1 = 10
        { event: 'affiliate_link_clicked', count: 2 },   // 2 * 5 = 10
      ], 'Product A'),
      makeAggRow('canon_b', [
        { event: 'wishlist_added', count: 5 },           // 5 * 4 = 20
      ], 'Product B'),
    ]);

    const result = await getTrending('7d');
    // Product B (score ~20) should rank above Product A (score ~20 too, but B has pure wishlist)
    expect(result.products.length).toBe(2);
    // Both products present
    const ids = result.products.map(p => p.canonicalId);
    expect(ids).toContain('canon_a');
    expect(ids).toContain('canon_b');
  });

  it('sorts products by score descending', async () => {
    setupWeightsMock({ view: 1, compareClick: 3, wishlistAdd: 4, affiliateClick: 5, priceAlert: 4 });
    setupAggMock([
      makeAggRow('low_score',  [{ event: 'product_detail_viewed', count: 1 }]),
      makeAggRow('high_score', [{ event: 'affiliate_link_clicked', count: 10 }]),
      makeAggRow('mid_score',  [{ event: 'wishlist_added', count: 3 }]),
    ]);

    const result = await getTrending('7d');
    expect(result.products[0].canonicalId).toBe('high_score');
    expect(result.products[result.products.length - 1].canonicalId).toBe('low_score');
  });

  it('respects TRENDING_LIMIT', async () => {
    setupWeightsMock();
    const rows = Array.from({ length: TRENDING_LIMIT + 10 }, (_, i) =>
      makeAggRow(`canon_${i}`, [{ event: 'product_detail_viewed', count: i + 1 }])
    );
    setupAggMock(rows);

    const result = await getTrending('7d');
    expect(result.products.length).toBeLessThanOrEqual(TRENDING_LIMIT);
  });

  it('respects custom limit param', async () => {
    setupWeightsMock();
    const rows = Array.from({ length: 15 }, (_, i) =>
      makeAggRow(`canon_${i}`, [{ event: 'product_detail_viewed', count: i + 1 }])
    );
    setupAggMock(rows);

    const result = await getTrending('7d', undefined, 5);
    expect(result.products.length).toBeLessThanOrEqual(5);
  });

  it('caches result — second call does not hit DB', async () => {
    setupWeightsMock();
    setupAggMock([makeAggRow('canon_a', [{ event: 'product_detail_viewed', count: 5 }])]);

    await getTrending('7d');
    const callsAfterFirst = mockAggregate.mock.calls.length;

    await getTrending('7d');
    expect(mockAggregate.mock.calls.length).toBe(callsAfterFirst); // no new DB calls
  });

  it('invalidateTrendingCache busts the cache', async () => {
    setupWeightsMock();
    setupAggMock([makeAggRow('canon_a', [{ event: 'product_detail_viewed', count: 5 }])]);

    await getTrending('7d');
    invalidateTrendingCache();

    setupAggMock([makeAggRow('canon_b', [{ event: 'product_detail_viewed', count: 5 }])]);
    const result = await getTrending('7d');
    expect(result.products[0].canonicalId).toBe('canon_b');
  });

  it('different windows use separate cache keys', async () => {
    setupWeightsMock();
    mockAggregate
      .mockResolvedValueOnce([makeAggRow('canon_24h', [{ event: 'product_detail_viewed', count: 5 }])])
      .mockResolvedValueOnce([makeAggRow('canon_7d',  [{ event: 'product_detail_viewed', count: 5 }])]);

    const r24h = await getTrending('24h');
    const r7d  = await getTrending('7d');
    expect(r24h.products[0].canonicalId).toBe('canon_24h');
    expect(r7d.products[0].canonicalId).toBe('canon_7d');
  });

  it('falls back to DEFAULT_WEIGHTS when TrendingConfig doc missing', async () => {
    mockFindOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    setupAggMock([makeAggRow('canon_a', [{ event: 'product_detail_viewed', count: 5 }])]);

    const result = await getTrending('7d');
    expect(result.weights).toEqual(expect.objectContaining({ view: 1 }));
  });

  it('falls back to DEFAULT_WEIGHTS when DB throws', async () => {
    mockFindOne.mockReturnValue({ lean: () => Promise.reject(new Error('DB error')) });
    setupAggMock([makeAggRow('canon_a', [{ event: 'product_detail_viewed', count: 5 }])]);

    const result = await getTrending('7d');
    expect(result.weights).toEqual(expect.objectContaining({ view: 1 }));
  });

  it('result includes weights field', async () => {
    setupWeightsMock({ view: 2, compareClick: 4, wishlistAdd: 5, affiliateClick: 6, priceAlert: 3 });
    setupAggMock([]);

    const result = await getTrending('7d');
    expect(result.weights).toEqual({ view: 2, compareClick: 4, wishlistAdd: 5, affiliateClick: 6, priceAlert: 3 });
  });

  it('result includes cachedAt timestamp', async () => {
    setupWeightsMock();
    setupAggMock([]);
    const before = Date.now();
    const result = await getTrending('7d');
    expect(result.cachedAt).toBeGreaterThanOrEqual(before);
  });

  it('products have signals breakdown', async () => {
    setupWeightsMock();
    setupAggMock([
      makeAggRow('canon_a', [
        { event: 'product_detail_viewed', count: 5 },
        { event: 'compare_opened', count: 2 },
      ]),
    ]);

    const result = await getTrending('7d');
    const p = result.products[0];
    expect(p.signals).toHaveProperty('views');
    expect(p.signals).toHaveProperty('compareClicks');
    expect(p.signals).toHaveProperty('wishlistAdds');
    expect(p.signals).toHaveProperty('affiliateClicks');
    expect(p.signals).toHaveProperty('priceAlerts');
  });

  it('skips rows with empty canonicalId', async () => {
    setupWeightsMock();
    setupAggMock([
      makeAggRow('', [{ event: 'product_detail_viewed', count: 5 }]),
      makeAggRow('canon_valid', [{ event: 'product_detail_viewed', count: 3 }]),
    ]);

    const result = await getTrending('7d');
    expect(result.products.every(p => p.canonicalId !== '')).toBe(true);
  });
});

describe('trendingEngine — getTrendingAllWindows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTrendingCache();
    _clearWeightsCache();
  });

  it('returns an object with 24h, 7d, and 30d keys', async () => {
    // Pre-populate cache for all three windows so connectDB is never called
    const make = (w: string) => ({
      window: w,
      products: [],
      cachedAt: Date.now(),
      weights: { view: 1, compareClick: 3, wishlistAdd: 4, affiliateClick: 5, priceAlert: 4 },
    });
    _trendingCache.set('24h:__all__', make('24h') as any);
    _trendingCache.set('7d:__all__',  make('7d')  as any);
    _trendingCache.set('30d:__all__', make('30d') as any);

    const all = await getTrendingAllWindows();
    expect(all).toHaveProperty('24h');
    expect(all).toHaveProperty('7d');
    expect(all).toHaveProperty('30d');
    expect(all['24h'].window).toBe('24h');
    expect(all['7d'].window).toBe('7d');
    expect(all['30d'].window).toBe('30d');
  });
});
