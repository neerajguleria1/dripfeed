/**
 * tests/unit/similarProductsService.test.ts
 *
 * Unit tests for getSimilarProducts service.
 * DB/cache dependencies are mocked; the real service module is imported.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB dependencies ─────────────────────────────────────────────────────

vi.mock('../../api/_lib/db.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

const mockFindOne = vi.fn();
const mockFind = vi.fn();

vi.mock('../../api/_lib/models/SearchCache.js', () => ({
  default: {
    findOne: (...args: any[]) => mockFindOne(...args),
    find: (...args: any[]) => mockFind(...args),
  },
}));

vi.mock('../../api/_lib/search.js', () => ({
  groupSearchResults: vi.fn((results: any[]) => results),
}));

import { getSimilarProducts, _similarCache, SIMILAR_LIMIT, SIMILAR_CACHE_TTL_MS } from '../../api/_lib/similarProducts';
import { groupSearchResults } from '../../api/_lib/search.js';

const mockGroup = groupSearchResults as ReturnType<typeof vi.fn>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOffer(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'flipkart',
    platformProductId: `fk_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Nike Air Max 270 Men Running Shoes',
    price: 5000,
    originalPrice: 8000,
    discount: 37,
    imageUrl: 'https://example.com/img.jpg',
    productUrl: 'https://flipkart.com/p/001',
    affiliateUrl: 'https://flipkart.com/p/001?aff=1',
    color: 'black',
    size: '9',
    rating: 4.2,
    originalProduct: {} as any,
    ...overrides,
  };
}

function makeCanonical(overrides: Record<string, unknown> = {}) {
  return {
    id: `canon_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Nike Air Max 270 Men Running Shoes',
    brand: 'Nike',
    offerCount: 1,
    confidence: 0.9,
    offers: [makeOffer()],
    ...overrides,
  };
}

function makeLeanChain(result: unknown) {
  return { lean: () => Promise.resolve(result) };
}

function makeFindChain(docs: unknown[]) {
  return {
    sort: () => ({
      limit: () => ({ lean: () => Promise.resolve(docs) }),
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getSimilarProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _similarCache.clear();
  });

  it('returns empty array when source product not found in any cache doc', async () => {
    mockFindOne.mockReturnValue(makeLeanChain(null));
    const result = await getSimilarProducts('canon_missing');
    expect(result).toEqual([]);
  });

  it('returns empty array when source canonical not in grouped results', async () => {
    const other = makeCanonical({ id: 'canon_other' });
    mockFindOne.mockReturnValue(makeLeanChain({ results: [other] }));
    mockGroup.mockReturnValueOnce([other]);
    const result = await getSimilarProducts('canon_source');
    expect(result).toEqual([]);
  });

  it('returns up to SIMILAR_LIMIT products', async () => {
    const source = makeCanonical({ id: 'canon_src' });
    const pool = Array.from({ length: 20 }, () =>
      makeCanonical({ brand: 'Nike', title: 'Nike Air Max 270 Men Running Shoes' }),
    );
    mockFindOne.mockReturnValue(makeLeanChain({ results: [source] }));
    mockFind.mockReturnValue(makeFindChain([{ results: pool }]));
    mockGroup.mockReturnValueOnce([source]).mockReturnValue(pool);

    const result = await getSimilarProducts('canon_src');
    expect(result.length).toBeLessThanOrEqual(SIMILAR_LIMIT);
  });

  it('excludes the source product from results', async () => {
    const source = makeCanonical({ id: 'canon_src' });
    const sim = makeCanonical({ id: 'canon_sim', brand: 'Nike', title: 'Nike Air Max 270 Men Running Shoes' });
    mockFindOne.mockReturnValue(makeLeanChain({ results: [source] }));
    mockFind.mockReturnValue(makeFindChain([{ results: [source, sim] }]));
    mockGroup.mockReturnValueOnce([source]).mockReturnValue([source, sim]);

    const result = await getSimilarProducts('canon_src');
    expect(result.map(p => p.id)).not.toContain('canon_src');
  });

  it('deduplicates candidates across multiple cache docs', async () => {
    const source = makeCanonical({ id: 'canon_src' });
    const dup = makeCanonical({ id: 'canon_dup', brand: 'Nike', title: 'Nike Air Max 270 Men Running Shoes' });
    mockFindOne.mockReturnValue(makeLeanChain({ results: [source] }));
    mockFind.mockReturnValue(makeFindChain([{ results: [dup] }, { results: [dup] }]));
    mockGroup
      .mockReturnValueOnce([source])
      .mockReturnValueOnce([dup])
      .mockReturnValueOnce([dup]);

    const result = await getSimilarProducts('canon_src');
    const ids = result.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('serves cached result on second call — no extra DB queries', async () => {
    const source = makeCanonical({ id: 'canon_cached' });
    const sim = makeCanonical({ id: 'canon_sim', brand: 'Nike', title: 'Nike Air Max 270 Men Running Shoes' });
    mockFindOne.mockReturnValue(makeLeanChain({ results: [source] }));
    mockFind.mockReturnValue(makeFindChain([{ results: [sim] }]));
    mockGroup.mockReturnValueOnce([source]).mockReturnValue([sim]);

    await getSimilarProducts('canon_cached');
    const callsBefore = mockFindOne.mock.calls.length;
    await getSimilarProducts('canon_cached');
    expect(mockFindOne.mock.calls.length).toBe(callsBefore);
  });

  it('graceful relaxation: returns an array even with a thin pool', async () => {
    const source = makeCanonical({ id: 'canon_src' });
    const budget = makeCanonical({
      id: 'canon_budget',
      title: 'Generic Running Shoes',
      brand: 'Unknown',
      offers: [makeOffer({ price: 1000, originalPrice: 2000, discount: 50 })],
    });
    mockFindOne.mockReturnValue(makeLeanChain({ results: [source] }));
    mockFind.mockReturnValue(makeFindChain([{ results: [budget] }]));
    mockGroup.mockReturnValueOnce([source]).mockReturnValue([budget]);

    const result = await getSimilarProducts('canon_src');
    expect(Array.isArray(result)).toBe(true);
  });

  it('pool scan is bounded — find().limit() is called with ≤50', async () => {
    const source = makeCanonical({ id: 'canon_src' });
    mockFindOne.mockReturnValue(makeLeanChain({ results: [source] }));

    let capturedLimit: number | undefined;
    mockFind.mockReturnValue({
      sort: () => ({
        limit: (n: number) => {
          capturedLimit = n;
          return { lean: () => Promise.resolve([]) };
        },
      }),
    });
    mockGroup.mockReturnValueOnce([source]).mockReturnValue([]);

    await getSimilarProducts('canon_src');
    expect(capturedLimit).toBeDefined();
    expect(capturedLimit!).toBeLessThanOrEqual(50);
  });

  it('SIMILAR_CACHE_TTL_MS is a positive number', () => {
    expect(typeof SIMILAR_CACHE_TTL_MS).toBe('number');
    expect(SIMILAR_CACHE_TTL_MS).toBeGreaterThan(0);
  });

  it('SIMILAR_LIMIT is 8', () => {
    expect(SIMILAR_LIMIT).toBe(8);
  });
});
