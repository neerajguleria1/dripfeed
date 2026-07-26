/**
 * tests/unit/similarProducts.test.ts
 *
 * Tests for:
 *   - useSimilarProducts hook
 *   - GET /api/product/:id/similar handler (API contract)
 *
 * Service tests are in similarProductsService.test.ts (separate file to avoid
 * vi.mock hoisting conflicts between the real service and the handler mock).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock similarProducts service for handler tests ───────────────────────────
// Must be declared before any imports that use it (hoisted by Vitest).

vi.mock('../../api/_lib/similarProducts.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/_lib/similarProducts.js')>();
  return { ...actual, getSimilarProducts: vi.fn() };
});

vi.mock('../../src/services/api', () => ({
  default: { get: vi.fn() },
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSimilarProducts, _similarCache } from '../../src/hooks/useSimilarProducts';
import api from '../../src/services/api';
import { handleSimilarProducts } from '../../api/_lib/handlers/similarProducts';
import { getSimilarProducts as _getSimilarProductsMock } from '../../api/_lib/similarProducts.js';

const mockGet = (api as any).get as ReturnType<typeof vi.fn>;
const mockGetSimilar = _getSimilarProductsMock as ReturnType<typeof vi.fn>;

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

function makeApiProduct() {
  return {
    id: `canon_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Nike Air Max 270',
    brand: 'Nike',
    offerCount: 1,
    offers: [makeOffer()],
  };
}

function makeReq(method = 'GET') { return { method } as any; }
function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

// ─── useSimilarProducts hook ──────────────────────────────────────────────────

describe('useSimilarProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _similarCache.clear();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useSimilarProducts());
    expect(result.current.status).toBe('idle');
    expect(result.current.products).toEqual([]);
  });

  it('transitions loading → success and populates products', async () => {
    const products = Array.from({ length: 8 }, makeApiProduct);
    mockGet.mockResolvedValueOnce({ data: { success: true, products } });

    const { result } = renderHook(() => useSimilarProducts());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.products).toHaveLength(8);
  });

  it('sets status to empty when API returns empty products array', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, products: [] } });

    const { result } = renderHook(() => useSimilarProducts());
    await act(async () => { result.current.fetch('canon_empty'); });
    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.products).toHaveLength(0);
  });

  it('sets status to error on network failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSimilarProducts());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('serves cached result on second fetch — no extra API calls', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, products: [makeApiProduct()] } });

    const { result } = renderHook(() => useSimilarProducts());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const callsBefore = mockGet.mock.calls.length;
    await act(async () => { result.current.fetch('canon_abc'); });
    expect(mockGet.mock.calls.length).toBe(callsBefore);
  });

  it('ignores stale response when canonicalId changes mid-flight', async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstPending = new Promise(r => { resolveFirst = r; });
    const secondProduct = { ...makeApiProduct(), title: 'Second Product' };

    mockGet
      .mockReturnValueOnce(firstPending)
      .mockResolvedValueOnce({ data: { success: true, products: [secondProduct] } });

    const { result } = renderHook(() => useSimilarProducts());
    act(() => { result.current.fetch('canon_first'); });
    await act(async () => { result.current.fetch('canon_second'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    resolveFirst({ data: { success: true, products: [makeApiProduct()] } });
    await new Promise(r => setTimeout(r, 50));

    expect(result.current.products[0]?.title).toBe('Second Product');
  });

  it('calls correct API endpoint', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, products: [] } });

    const { result } = renderHook(() => useSimilarProducts());
    await act(async () => { result.current.fetch('canon_xyz'); });
    expect(mockGet).toHaveBeenCalledWith('/product/canon_xyz/similar');
  });

  it('handles missing products field gracefully', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true } });

    const { result } = renderHook(() => useSimilarProducts());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.products).toEqual([]);
  });
});

// ─── handleSimilarProducts API handler ───────────────────────────────────────

describe('handleSimilarProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 405 for non-GET methods', async () => {
    const res = makeRes();
    await handleSimilarProducts(makeReq('POST'), res, 'canon_abc');
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 400 when canonicalId is empty', async () => {
    const res = makeRes();
    await handleSimilarProducts(makeReq('GET'), res, '');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when service returns empty array', async () => {
    mockGetSimilar.mockResolvedValueOnce([]);
    const res = makeRes();
    await handleSimilarProducts(makeReq('GET'), res, 'canon_missing');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('returns 200 with success:true and products array', async () => {
    const products = [makeCanonical()];
    mockGetSimilar.mockResolvedValueOnce(products);
    const res = makeRes();
    await handleSimilarProducts(makeReq('GET'), res, 'canon_abc');
    expect(res.json).toHaveBeenCalledWith({ success: true, products });
  });

  it('sets Cache-Control header on success', async () => {
    mockGetSimilar.mockResolvedValueOnce([makeCanonical()]);
    const res = makeRes();
    await handleSimilarProducts(makeReq('GET'), res, 'canon_abc');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'));
  });

  it('returns 500 on service error', async () => {
    mockGetSimilar.mockRejectedValueOnce(new Error('DB error'));
    const res = makeRes();
    await handleSimilarProducts(makeReq('GET'), res, 'canon_abc');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'DB error' }));
  });

  it('strips leading slash and sub-paths from canonicalId', async () => {
    mockGetSimilar.mockResolvedValueOnce([makeCanonical()]);
    const res = makeRes();
    await handleSimilarProducts(makeReq('GET'), res, '/canon_abc/extra');
    expect(mockGetSimilar).toHaveBeenCalledWith('canon_abc');
  });

  it('response shape has success and products fields', async () => {
    const products = [makeCanonical()];
    mockGetSimilar.mockResolvedValueOnce(products);
    const res = makeRes();
    await handleSimilarProducts(makeReq('GET'), res, 'canon_abc');
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('products');
    expect(Array.isArray(body.products)).toBe(true);
  });

  it('returns exactly 8 products when service returns full set', async () => {
    const products = Array.from({ length: 8 }, makeCanonical);
    mockGetSimilar.mockResolvedValueOnce(products);
    const res = makeRes();
    await handleSimilarProducts(makeReq('GET'), res, 'canon_abc');
    const body = res.json.mock.calls[0][0];
    expect(body.products).toHaveLength(8);
  });
});
