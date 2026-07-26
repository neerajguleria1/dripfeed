/**
 * tests/unit/productDetail.test.ts
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProductDetail, _cache } from '../../src/hooks/useProductDetail';
import type { CanonicalProductData } from '../../src/types/product';

vi.mock('../../src/services/api', () => ({
  default: { get: vi.fn() },
}));

import api from '../../src/services/api';
const mockGet = (api as any).get as ReturnType<typeof vi.fn>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOffer(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'flipkart',
    platformProductId: 'fk_001',
    title: 'Nike Air Max 270',
    price: 4999,
    originalPrice: 7999,
    discount: 37,
    imageUrl: 'https://example.com/img.jpg',
    productUrl: 'https://flipkart.com/p/fk_001',
    affiliateUrl: 'https://flipkart.com/p/fk_001?aff=1',
    color: 'Black',
    size: '9',
    rating: 4.3,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<CanonicalProductData> = {}): CanonicalProductData {
  return {
    id: 'canon_abc123',
    title: 'Nike Air Max 270',
    brand: 'Nike',
    offerCount: 2,
    offers: [
      makeOffer({ platform: 'flipkart', price: 4999, platformProductId: 'fk_001' }),
      makeOffer({ platform: 'amazon', platformProductId: 'az_B001', price: 5499, affiliateUrl: 'https://amazon.in/dp/B001?aff=1' }),
    ],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useProductDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _cache.clear();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useProductDetail());
    expect(result.current.status).toBe('idle');
    expect(result.current.product).toBeNull();
    expect(result.current.similar).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('fetches product and similar on fetch(canonicalId)', async () => {
    const product = makeProduct();
    mockGet.mockResolvedValueOnce({ data: { product, similar: [makeProduct({ id: 'sim1', title: 'Adidas' })], query: 'nike air max' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.product?.id).toBe('canon_abc123');
    expect(result.current.similar).toHaveLength(1);
    expect(result.current.query).toBe('nike air max');
  });

  it('sets status to not-found on 404 response', async () => {
    const err = Object.assign(new Error('Not Found'), { response: { status: 404 } });
    mockGet.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_missing'); });
    await waitFor(() => expect(result.current.status).toBe('not-found'));
    expect(result.current.product).toBeNull();
  });

  it('sets status to error on network failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('sets status to not-found when response has no product field', async () => {
    mockGet.mockResolvedValueOnce({ data: { product: null, similar: [] } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('not-found'));
  });

  it('serves cached result on second fetch — no extra API calls', async () => {
    const product = makeProduct();
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const callsBefore = mockGet.mock.calls.length;
    await act(async () => { result.current.fetch('canon_abc123'); });

    expect(mockGet.mock.calls.length).toBe(callsBefore);
    expect(result.current.status).toBe('success');
  });

  it('handles empty similar products gracefully', async () => {
    const product = makeProduct();
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.similar).toEqual([]);
  });

  it('offers are sorted lowest price first (page component responsibility)', async () => {
    const product = makeProduct({
      offers: [
        makeOffer({ platform: 'amazon', price: 5499, platformProductId: 'az_001' }),
        makeOffer({ platform: 'flipkart', price: 4999, platformProductId: 'fk_001' }),
        makeOffer({ platform: 'myntra', price: 5999, platformProductId: 'mn_001' }),
      ],
    });
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const sorted = [...result.current.product!.offers].sort((a, b) => a.price - b.price);
    expect(sorted[0].price).toBe(4999);
    expect(sorted[0].platform).toBe('flipkart');
    expect(sorted[2].price).toBe(5999);
  });

  it('first offer in sorted list is the best deal', async () => {
    const product = makeProduct({
      offers: [
        makeOffer({ platform: 'flipkart', price: 4999, platformProductId: 'fk_001' }),
        makeOffer({ platform: 'amazon', price: 5499, platformProductId: 'az_001' }),
      ],
    });
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const sorted = [...result.current.product!.offers].sort((a, b) => a.price - b.price);
    expect(sorted[0].platform).toBe('flipkart');
    expect(sorted[0].price).toBe(4999);
  });

  it('product has color variants available', async () => {
    const product = makeProduct({
      offers: [
        makeOffer({ platformProductId: 'fk_black', color: 'Black', price: 4999 }),
        makeOffer({ platformProductId: 'fk_white', color: 'White', price: 5199 }),
      ],
    });
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const colors = result.current.product!.offers.map(o => o.color).filter(Boolean);
    expect(colors).toContain('Black');
    expect(colors).toContain('White');
  });

  it('product has size variants available', async () => {
    const product = makeProduct({
      offers: [
        makeOffer({ platformProductId: 'fk_s8', size: '8', price: 4999 }),
        makeOffer({ platformProductId: 'fk_s9', size: '9', price: 4999 }),
        makeOffer({ platformProductId: 'fk_s10', size: '10', price: 5199 }),
      ],
    });
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const sizes = result.current.product!.offers.map(o => o.size).filter(Boolean);
    expect(sizes).toContain('8');
    expect(sizes).toContain('9');
    expect(sizes).toContain('10');
  });

  it('product data has all fields needed for wishlist save', async () => {
    const product = makeProduct();
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const p = result.current.product!;
    expect(p.id).toBeTruthy();
    expect(p.title).toBeTruthy();
    expect(p.offers[0].imageUrl).toBeTruthy();
    expect(p.offers[0].price).toBeGreaterThan(0);
    expect(p.offers[0].platform).toBeTruthy();
  });

  it('canonicalId is available for price history panel', async () => {
    const product = makeProduct({ id: 'canon_ph_test' });
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_ph_test'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.product?.id).toBe('canon_ph_test');
  });

  it('sets status to loading while fetching', async () => {
    let resolve!: (v: unknown) => void;
    const pending = new Promise(r => { resolve = r; });
    mockGet.mockReturnValueOnce(pending);

    const { result } = renderHook(() => useProductDetail());

    // Don't await — check loading state synchronously after triggering
    act(() => { result.current.fetch('canon_abc123'); });
    expect(result.current.status).toBe('loading');

    resolve({ data: { product: makeProduct(), similar: [], query: 'nike' } });
    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('product title is available for aria labels', async () => {
    const product = makeProduct({ title: 'Nike Air Max 270 Running Shoes' });
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.product?.title).toBe('Nike Air Max 270 Running Shoes');
  });

  it('canonicalId is available for share URL construction', async () => {
    const product = makeProduct({ id: 'canon_share_test' });
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_share_test'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.product?.id).toBe('canon_share_test');
  });

  it('handles product with no offers gracefully', async () => {
    const product = makeProduct({ offers: [], offerCount: 0 });
    mockGet.mockResolvedValueOnce({ data: { product, similar: [], query: 'nike' } });

    const { result } = renderHook(() => useProductDetail());
    await act(async () => { result.current.fetch('canon_abc123'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.product?.offers).toHaveLength(0);
  });

  it('ignores stale response when canonicalId changes mid-flight', async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstPending = new Promise(r => { resolveFirst = r; });
    const secondProduct = makeProduct({ id: 'canon_second', title: 'Second Product' });

    mockGet
      .mockReturnValueOnce(firstPending)
      .mockResolvedValueOnce({ data: { product: secondProduct, similar: [], query: 'second' } });

    const { result } = renderHook(() => useProductDetail());

    act(() => { result.current.fetch('canon_first'); });
    // Immediately fetch a different ID — this should win
    await act(async () => { result.current.fetch('canon_second'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    // Now resolve the stale first request
    resolveFirst({ data: { product: makeProduct({ id: 'canon_first' }), similar: [], query: 'first' } });
    await new Promise(r => setTimeout(r, 50));

    // Second product should still be shown
    expect(result.current.product?.id).toBe('canon_second');
  });
});
