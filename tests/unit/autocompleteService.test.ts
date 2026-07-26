/**
 * tests/unit/autocompleteService.test.ts
 *
 * Tests for autocompleteEngine.ts directly with mocked DB.
 * Kept separate from autocomplete.test.ts because both files need to
 * import autocompleteEngine — one mocking it, one using it real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB and models ───────────────────────────────────────────────────────

vi.mock('../../api/_lib/db.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

const mockAnalyticsAggregate = vi.fn();
const mockSearchCacheFind    = vi.fn();

vi.mock('../../api/_lib/models/AnalyticsEvent.js', () => ({
  default: {
    aggregate: (...a: any[]) => mockAnalyticsAggregate(...a),
  },
}));

vi.mock('../../api/_lib/models/SearchCache.js', () => ({
  default: {
    find: (...a: any[]) => mockSearchCacheFind(...a),
  },
}));

import {
  getAutocompleteSuggestions,
  _clearAutocompleteCache,
  _autocompleteCache,
  MAX_POPULAR,
  MAX_PRODUCTS,
  MAX_BRANDS,
  MAX_CATEGORIES,
} from '../../api/_lib/autocompleteEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAnalyticsRows(queries: Array<{ _id: string; count: number }>) {
  return queries;
}

function makeSearchCacheDocs(products: Array<{ title: string; brand?: string; platform: string; price: number; imageUrl?: string }>) {
  return [
    {
      results: products.map(p => ({
        title:    p.title,
        brand:    p.brand,
        platform: p.platform,
        price:    p.price,
        imageUrl: p.imageUrl ?? 'https://img.com/1.jpg',
      })),
    },
  ];
}

function mockFindChain(docs: object[]) {
  return {
    select: vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnThis(),
    lean:   vi.fn().mockResolvedValue(docs),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getAutocompleteSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearAutocompleteCache();
  });

  it('returns empty arrays when DB has no data', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce([]);
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    const result = await getAutocompleteSuggestions('kurta');
    expect(result.popular).toEqual([]);
    expect(result.products).toEqual([]);
    expect(result.brands).toEqual([]);
    expect(result.categories).toEqual([]);
  });

  it('returns popular queries sorted by count desc', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce(makeAnalyticsRows([
      { _id: 'kurta set', count: 50 },
      { _id: 'kurta men', count: 30 },
      { _id: 'kurta women', count: 20 },
    ]));
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    const result = await getAutocompleteSuggestions('kurta');
    expect(result.popular[0].query).toBe('kurta set');
    expect(result.popular[0].count).toBe(50);
  });

  it('ranks exact match first, then prefix, then rest', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce(makeAnalyticsRows([
      { _id: 'kurta men', count: 100 },   // prefix
      { _id: 'kurta', count: 5 },          // exact
      { _id: 'silk kurta', count: 80 },    // rest (contains but not prefix)
    ]));
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    const result = await getAutocompleteSuggestions('kurta');
    expect(result.popular[0].matchType).toBe('exact');
    expect(result.popular[0].query).toBe('kurta');
    expect(result.popular[1].matchType).toBe('prefix');
  });

  it('respects MAX_POPULAR limit', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ _id: `query${i}`, count: 20 - i }));
    mockAnalyticsAggregate.mockResolvedValueOnce(rows);
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    const result = await getAutocompleteSuggestions('query', MAX_POPULAR);
    expect(result.popular.length).toBeLessThanOrEqual(MAX_POPULAR);
  });

  it('returns product suggestions from SearchCache', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce([]);
    mockSearchCacheFind.mockReturnValue(mockFindChain(makeSearchCacheDocs([
      { title: 'Nike Air Max kurta', brand: 'Nike', platform: 'Flipkart', price: 4999 },
    ])));

    const result = await getAutocompleteSuggestions('kurta');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].title).toBe('Nike Air Max kurta');
    expect(result.products[0].platform).toBe('Flipkart');
    expect(result.products[0].price).toBe(4999);
  });

  it('deduplicates product titles', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce([]);
    mockSearchCacheFind.mockReturnValue(mockFindChain(makeSearchCacheDocs([
      { title: 'Nike kurta', platform: 'Flipkart', price: 4999 },
      { title: 'Nike kurta', platform: 'Amazon', price: 4500 }, // duplicate title
    ])));

    const result = await getAutocompleteSuggestions('kurta');
    expect(result.products).toHaveLength(1);
  });

  it('respects MAX_PRODUCTS limit', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce([]);
    const products = Array.from({ length: 20 }, (_, i) => ({
      title: `kurta product ${i}`,
      platform: 'Flipkart',
      price: 1000 + i,
    }));
    mockSearchCacheFind.mockReturnValue(mockFindChain(makeSearchCacheDocs(products)));

    const result = await getAutocompleteSuggestions('kurta');
    expect(result.products.length).toBeLessThanOrEqual(MAX_PRODUCTS);
  });

  it('extracts brand suggestions from matching products', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce([]);
    mockSearchCacheFind.mockReturnValue(mockFindChain(makeSearchCacheDocs([
      { title: 'some product', brand: 'Nike', platform: 'Flipkart', price: 4999 },
    ])));

    const result = await getAutocompleteSuggestions('nike');
    expect(result.brands).toContain('Nike');
  });

  it('respects MAX_BRANDS limit', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce([]);
    const products = Array.from({ length: 10 }, (_, i) => ({
      title: `product ${i}`,
      brand: `Brand${i}`,
      platform: 'Flipkart',
      price: 1000,
    }));
    mockSearchCacheFind.mockReturnValue(mockFindChain(makeSearchCacheDocs(products)));

    const result = await getAutocompleteSuggestions('brand');
    expect(result.brands.length).toBeLessThanOrEqual(MAX_BRANDS);
  });

  it('returns cached result on second call — no extra DB queries', async () => {
    mockAnalyticsAggregate.mockResolvedValue([]);
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    await getAutocompleteSuggestions('kurta');
    await getAutocompleteSuggestions('kurta');

    expect(mockAnalyticsAggregate).toHaveBeenCalledTimes(1);
  });

  it('different queries use separate cache entries', async () => {
    mockAnalyticsAggregate.mockResolvedValue([]);
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    await getAutocompleteSuggestions('kurta');
    await getAutocompleteSuggestions('saree');

    expect(mockAnalyticsAggregate).toHaveBeenCalledTimes(2);
  });

  it('_clearAutocompleteCache busts the cache', async () => {
    mockAnalyticsAggregate.mockResolvedValue([]);
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    await getAutocompleteSuggestions('kurta');
    _clearAutocompleteCache();
    await getAutocompleteSuggestions('kurta');

    expect(mockAnalyticsAggregate).toHaveBeenCalledTimes(2);
  });

  it('handles analytics aggregate failure gracefully — returns empty popular', async () => {
    mockAnalyticsAggregate.mockRejectedValueOnce(new Error('DB error'));
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    const result = await getAutocompleteSuggestions('kurta');
    expect(result.popular).toEqual([]);
    expect(result.products).toEqual([]);
  });

  it('handles SearchCache find failure gracefully — returns empty products', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce([{ _id: 'kurta', count: 5 }]);
    mockSearchCacheFind.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      limit:  vi.fn().mockReturnThis(),
      lean:   vi.fn().mockRejectedValue(new Error('DB error')),
    });

    const result = await getAutocompleteSuggestions('kurta');
    expect(result.popular).toHaveLength(1);
    expect(result.products).toEqual([]);
  });

  it('skips empty _id rows from analytics', async () => {
    mockAnalyticsAggregate.mockResolvedValueOnce([
      { _id: '', count: 10 },
      { _id: null, count: 5 },
      { _id: 'kurta', count: 3 },
    ]);
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    const result = await getAutocompleteSuggestions('kurta');
    expect(result.popular).toHaveLength(1);
    expect(result.popular[0].query).toBe('kurta');
  });

  it('normalises query to lowercase before cache key', async () => {
    mockAnalyticsAggregate.mockResolvedValue([]);
    mockSearchCacheFind.mockReturnValue(mockFindChain([]));

    await getAutocompleteSuggestions('Kurta');
    await getAutocompleteSuggestions('kurta'); // same normalised key

    expect(mockAnalyticsAggregate).toHaveBeenCalledTimes(1);
  });
});
