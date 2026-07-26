/**
 * tests/unit/trending.test.ts
 *
 * Tests for:
 *   - useTrending hook
 *   - handleTrending API handler (GET, admin, weights)
 *
 * Engine tests are in trendingService.test.ts (separate file — vi.mock hoisting).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock trendingEngine for handler tests ────────────────────────────────────
vi.mock('../../api/_lib/trendingEngine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/_lib/trendingEngine.js')>();
  return {
    ...actual,
    getTrending:           vi.fn(),
    getTrendingAllWindows: vi.fn(),
    invalidateTrendingCache: vi.fn(),
  };
});

vi.mock('../../src/services/api', () => ({
  default: { get: vi.fn() },
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useTrending, _trendingCache } from '../../src/hooks/useTrending';
import api from '../../src/services/api';
import { handleTrending } from '../../api/_lib/handlers/trending';
import {
  getTrending as _getTrendingMock,
  getTrendingAllWindows as _getAllWindowsMock,
  invalidateTrendingCache as _invalidateMock,
} from '../../api/_lib/trendingEngine.js';

const mockGet        = (api as any).get as ReturnType<typeof vi.fn>;
const mockGetTrending = _getTrendingMock as ReturnType<typeof vi.fn>;
const mockGetAll      = _getTrendingAllWindows as ReturnType<typeof vi.fn>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTrendingProduct(overrides: Record<string, unknown> = {}) {
  return {
    canonicalId:  `canon_${Math.random().toString(36).slice(2, 8)}`,
    productTitle: 'Nike Air Max 270',
    platform:     'flipkart',
    score:        42.5,
    signals: { views: 10, compareClicks: 3, wishlistAdds: 2, affiliateClicks: 1, priceAlerts: 1 },
    ...overrides,
  };
}

function makeTrendingResult(window = '7d', count = 8) {
  return {
    window,
    products: Array.from({ length: count }, makeTrendingProduct),
    cachedAt: Date.now(),
    weights:  { view: 1, compareClick: 3, wishlistAdd: 4, affiliateClick: 5, priceAlert: 4 },
  };
}

function makeReq(method = 'GET', query: Record<string, string> = {}, body?: Record<string, unknown>) {
  return { method, query, body } as any;
}
function makeRes() {
  const res: any = {};
  res.status    = vi.fn().mockReturnValue(res);
  res.json      = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

// ─── useTrending hook ─────────────────────────────────────────────────────────

describe('useTrending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _trendingCache.clear();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useTrending());
    expect(result.current.status).toBe('idle');
    expect(result.current.products).toEqual([]);
  });

  it('transitions loading → success and populates products', async () => {
    const products = Array.from({ length: 8 }, makeTrendingProduct);
    mockGet.mockResolvedValueOnce({ data: { products, window: '7d', cachedAt: Date.now() } });

    const { result } = renderHook(() => useTrending());
    await act(async () => { result.current.fetch('7d'); });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.products).toHaveLength(8);
  });

  it('sets status to empty when API returns empty products array', async () => {
    mockGet.mockResolvedValueOnce({ data: { products: [], window: '7d', cachedAt: Date.now() } });

    const { result } = renderHook(() => useTrending());
    await act(async () => { result.current.fetch('7d'); });
    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('sets status to error on network failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTrending());
    await act(async () => { result.current.fetch('7d'); });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('serves cached result on second fetch — no extra API calls', async () => {
    mockGet.mockResolvedValueOnce({ data: { products: [makeTrendingProduct()], window: '7d', cachedAt: Date.now() } });

    const { result } = renderHook(() => useTrending());
    await act(async () => { result.current.fetch('7d'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const callsBefore = mockGet.mock.calls.length;
    await act(async () => { result.current.fetch('7d'); });
    expect(mockGet.mock.calls.length).toBe(callsBefore);
  });

  it('different windows use separate cache keys', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { products: [makeTrendingProduct()], window: '24h', cachedAt: Date.now() } })
      .mockResolvedValueOnce({ data: { products: [makeTrendingProduct(), makeTrendingProduct()], window: '30d', cachedAt: Date.now() } });

    const { result } = renderHook(() => useTrending());
    await act(async () => { result.current.fetch('24h'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(async () => { result.current.fetch('30d'); });
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('ignores stale response when window changes mid-flight', async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstPending = new Promise(r => { resolveFirst = r; });
    const secondProduct = makeTrendingProduct({ productTitle: 'Second Window Product' });

    mockGet
      .mockReturnValueOnce(firstPending)
      .mockResolvedValueOnce({ data: { products: [secondProduct], window: '30d', cachedAt: Date.now() } });

    const { result } = renderHook(() => useTrending());
    act(() => { result.current.fetch('24h'); });
    await act(async () => { result.current.fetch('30d'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    resolveFirst({ data: { products: [makeTrendingProduct()], window: '24h', cachedAt: Date.now() } });
    await new Promise(r => setTimeout(r, 50));

    expect(result.current.products[0]?.title).toBe('Second Window Product');
  });

  it('calls correct API endpoint with window param', async () => {
    mockGet.mockResolvedValueOnce({ data: { products: [], window: '24h', cachedAt: Date.now() } });

    const { result } = renderHook(() => useTrending());
    await act(async () => { result.current.fetch('24h'); });
    expect(mockGet).toHaveBeenCalledWith('/products/trending', expect.objectContaining({
      params: expect.objectContaining({ window: '24h' }),
    }));
  });

  it('passes category param when provided', async () => {
    mockGet.mockResolvedValueOnce({ data: { products: [], window: '7d', cachedAt: Date.now() } });

    const { result } = renderHook(() => useTrending());
    await act(async () => { result.current.fetch('7d', 'footwear'); });
    expect(mockGet).toHaveBeenCalledWith('/products/trending', expect.objectContaining({
      params: expect.objectContaining({ category: 'footwear' }),
    }));
  });

  it('category + window combination uses separate cache key', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { products: [makeTrendingProduct()], window: '7d', cachedAt: Date.now() } })
      .mockResolvedValueOnce({ data: { products: [], window: '7d', cachedAt: Date.now() } });

    const { result } = renderHook(() => useTrending());
    await act(async () => { result.current.fetch('7d'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(async () => { result.current.fetch('7d', 'footwear'); });
    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

// ─── handleTrending — GET /api/products/trending ──────────────────────────────

describe('handleTrending — GET', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 405 for non-GET methods', async () => {
    const res = makeRes();
    await handleTrending(makeReq('POST'), res, '');
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns products with window and cachedAt', async () => {
    const result = makeTrendingResult('7d', 5);
    mockGetTrending.mockResolvedValueOnce(result);
    const res = makeRes();
    await handleTrending(makeReq('GET'), res, '');
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('products');
    expect(body).toHaveProperty('window', '7d');
    expect(body).toHaveProperty('cachedAt');
    expect(Array.isArray(body.products)).toBe(true);
  });

  it('sets Cache-Control header on success', async () => {
    mockGetTrending.mockResolvedValueOnce(makeTrendingResult());
    const res = makeRes();
    await handleTrending(makeReq('GET'), res, '');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'));
  });

  it('defaults to 7d window when none provided', async () => {
    mockGetTrending.mockResolvedValueOnce(makeTrendingResult('7d'));
    const res = makeRes();
    await handleTrending(makeReq('GET', {}), res, '');
    expect(mockGetTrending).toHaveBeenCalledWith('7d', undefined, expect.any(Number));
  });

  it('accepts valid window param 24h', async () => {
    mockGetTrending.mockResolvedValueOnce(makeTrendingResult('24h'));
    const res = makeRes();
    await handleTrending(makeReq('GET', { window: '24h' }), res, '');
    expect(mockGetTrending).toHaveBeenCalledWith('24h', undefined, expect.any(Number));
  });

  it('falls back to 7d for invalid window param', async () => {
    mockGetTrending.mockResolvedValueOnce(makeTrendingResult('7d'));
    const res = makeRes();
    await handleTrending(makeReq('GET', { window: 'invalid' }), res, '');
    expect(mockGetTrending).toHaveBeenCalledWith('7d', undefined, expect.any(Number));
  });

  it('passes category param to engine', async () => {
    mockGetTrending.mockResolvedValueOnce(makeTrendingResult('7d'));
    const res = makeRes();
    await handleTrending(makeReq('GET', { category: 'footwear' }), res, '');
    expect(mockGetTrending).toHaveBeenCalledWith('7d', 'footwear', expect.any(Number));
  });

  it('clamps limit to 50 max', async () => {
    mockGetTrending.mockResolvedValueOnce(makeTrendingResult('7d'));
    const res = makeRes();
    await handleTrending(makeReq('GET', { limit: '999' }), res, '');
    expect(mockGetTrending).toHaveBeenCalledWith('7d', undefined, 50);
  });

  it('returns 500 on engine error', async () => {
    mockGetTrending.mockRejectedValueOnce(new Error('DB error'));
    const res = makeRes();
    await handleTrending(makeReq('GET'), res, '');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 404 for unknown subpath', async () => {
    const res = makeRes();
    await handleTrending(makeReq('GET'), res, 'unknown');
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── handleTrending — GET /admin ──────────────────────────────────────────────

vi.mock('../../api/_lib/adminAuth.js', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('../../api/_lib/db.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

import { requireAdmin } from '../../api/_lib/adminAuth.js';
const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>;

// Re-import after mock
import { getTrendingAllWindows as _getTrendingAllWindows } from '../../api/_lib/trendingEngine.js';
const mockGetAllWindows = _getTrendingAllWindows as ReturnType<typeof vi.fn>;

describe('handleTrending — GET /admin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not admin', async () => {
    mockRequireAdmin.mockReturnValue(false);
    const res = makeRes();
    await handleTrending(makeReq('GET'), res, 'admin');
    expect(mockGetAllWindows).not.toHaveBeenCalled();
  });

  it('returns all three windows + weights when admin', async () => {
    mockRequireAdmin.mockReturnValue(true);
    const allWindows = {
      '24h': makeTrendingResult('24h'),
      '7d':  makeTrendingResult('7d'),
      '30d': makeTrendingResult('30d'),
    };
    mockGetAllWindows.mockResolvedValueOnce(allWindows);
    const res = makeRes();
    await handleTrending(makeReq('GET'), res, 'admin');
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('windows');
    expect(body.windows).toHaveProperty('24h');
    expect(body.windows).toHaveProperty('7d');
    expect(body.windows).toHaveProperty('30d');
    expect(body).toHaveProperty('weights');
  });

  it('returns 405 for non-GET on admin endpoint', async () => {
    mockRequireAdmin.mockReturnValue(true);
    const res = makeRes();
    await handleTrending(makeReq('POST'), res, 'admin');
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ─── handleTrending — PUT /weights ────────────────────────────────────────────

const mockFindOneAndUpdate = vi.fn();
vi.mock('../../api/_lib/models/TrendingConfig.js', () => ({
  default: {
    findOneAndUpdate: (...a: any[]) => mockFindOneAndUpdate(...a),
  },
}));

describe('handleTrending — PUT /weights', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not admin', async () => {
    mockRequireAdmin.mockReturnValue(false);
    const res = makeRes();
    await handleTrending(makeReq('PUT', {}, { view: 1, compareClick: 3, wishlistAdd: 4, affiliateClick: 5, priceAlert: 4 }), res, 'weights');
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 405 for non-PUT', async () => {
    mockRequireAdmin.mockReturnValue(true);
    const res = makeRes();
    await handleTrending(makeReq('GET'), res, 'weights');
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 for invalid weight value', async () => {
    mockRequireAdmin.mockReturnValue(true);
    const res = makeRes();
    await handleTrending(
      makeReq('PUT', {}, { view: -1, compareClick: 3, wishlistAdd: 4, affiliateClick: 5, priceAlert: 4 }),
      res, 'weights',
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('saves weights and invalidates cache on success', async () => {
    mockRequireAdmin.mockReturnValue(true);
    mockFindOneAndUpdate.mockResolvedValueOnce({});
    const res = makeRes();
    const weights = { view: 2, compareClick: 4, wishlistAdd: 5, affiliateClick: 6, priceAlert: 3 };
    await handleTrending(makeReq('PUT', {}, weights), res, 'weights');
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(_invalidateMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, weights }));
  });
});
