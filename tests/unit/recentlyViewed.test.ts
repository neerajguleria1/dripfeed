/**
 * tests/unit/recentlyViewed.test.ts
 *
 * Tests for:
 *   - useRecentlyViewed hook (localStorage, API, sync, dedup, TTL)
 *   - handleUsers API handler (GET + POST /api/users/recent-products)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: `canon_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Nike Air Max 270',
    brand: 'Nike',
    imageUrl: 'https://example.com/img.jpg',
    price: 4999,
    originalPrice: 7999,
    discount: 37,
    platform: 'Flipkart',
    url: 'https://flipkart.com/p/001',
    ...overrides,
  };
}

// ─── useRecentlyViewed ────────────────────────────────────────────────────────

vi.mock('../../src/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import { useRecentlyViewed, STORAGE_KEY, MAX_RECENT, TTL_MS } from '../../src/hooks/useRecentlyViewed';
import api from '../../src/services/api';

const mockGet  = (api as any).get  as ReturnType<typeof vi.fn>;
const mockPost = (api as any).post as ReturnType<typeof vi.fn>;

function serverProducts(items: ReturnType<typeof makeProduct>[]) {
  return {
    data: {
      products: items.map(p => ({
        canonicalId:   p.id,
        title:         p.title,
        brand:         p.brand,
        imageUrl:      p.imageUrl,
        price:         p.price,
        originalPrice: p.originalPrice,
        discount:      p.discount,
        platform:      p.platform,
        url:           p.url,
        viewedAt:      new Date().toISOString(),
      })),
    },
  };
}

describe('useRecentlyViewed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── Anonymous (not logged in) ─────────────────────────────────────────────

  it('starts with empty items when localStorage is empty', () => {
    const { result } = renderHook(() => useRecentlyViewed(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('trackView adds item to localStorage and state', () => {
    const { result } = renderHook(() => useRecentlyViewed(false));
    const p = makeProduct();

    act(() => { result.current.trackView(p); });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe(p.id);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(p.id);
  });

  it('trackView deduplicates — same id moves to front', () => {
    const { result } = renderHook(() => useRecentlyViewed(false));
    const p1 = makeProduct({ id: 'a' });
    const p2 = makeProduct({ id: 'b' });

    act(() => { result.current.trackView(p1); });
    act(() => { result.current.trackView(p2); });
    act(() => { result.current.trackView(p1); }); // re-view p1

    expect(result.current.items[0].id).toBe('a');
    expect(result.current.items[1].id).toBe('b');
    expect(result.current.items).toHaveLength(2);
  });

  it('trackView does NOT call API when anonymous', () => {
    const { result } = renderHook(() => useRecentlyViewed(false));
    act(() => { result.current.trackView(makeProduct()); });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('respects MAX_RECENT limit', () => {
    const { result } = renderHook(() => useRecentlyViewed(false));
    act(() => {
      for (let i = 0; i < MAX_RECENT + 5; i++) {
        result.current.trackView(makeProduct({ id: `p${i}` }));
      }
    });
    expect(result.current.items).toHaveLength(MAX_RECENT);
  });

  it('strips expired items from localStorage on init', () => {
    const expired = { ...makeProduct({ id: 'old' }), viewedAt: Date.now() - TTL_MS - 1000 };
    const fresh   = { ...makeProduct({ id: 'new' }), viewedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([expired, fresh]));

    const { result } = renderHook(() => useRecentlyViewed(false));
    expect(result.current.items.map(p => p.id)).toEqual(['new']);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{');
    const { result } = renderHook(() => useRecentlyViewed(false));
    expect(result.current.items).toEqual([]);
  });

  // ── Logged-in user ────────────────────────────────────────────────────────

  it('fetches from API on mount when logged in', async () => {
    const p = makeProduct();
    mockGet.mockResolvedValueOnce(serverProducts([p]));

    const { result } = renderHook(() => useRecentlyViewed(true));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe(p.id);
    expect(mockGet).toHaveBeenCalledWith('/users/recent-products');
  });

  it('does NOT fetch again on re-render when already fetched', async () => {
    mockGet.mockResolvedValueOnce(serverProducts([]));
    const { result, rerender } = renderHook(() => useRecentlyViewed(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('trackView calls POST API when logged in', async () => {
    mockGet.mockResolvedValueOnce(serverProducts([]));
    mockPost.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() => useRecentlyViewed(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const p = makeProduct();
    act(() => { result.current.trackView(p); });

    expect(mockPost).toHaveBeenCalledWith('/users/recent-products', expect.objectContaining({
      canonicalId: p.id,
      title:       p.title,
      price:       p.price,
      platform:    p.platform,
      url:         p.url,
    }));
  });

  it('trackView is optimistic — state updates before API resolves', async () => {
    mockGet.mockResolvedValueOnce(serverProducts([]));
    let resolvePost!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise(r => { resolvePost = r; }));

    const { result } = renderHook(() => useRecentlyViewed(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const p = makeProduct();
    act(() => { result.current.trackView(p); });

    // State updated immediately, before POST resolves
    expect(result.current.items[0].id).toBe(p.id);
    resolvePost({ data: { success: true } });
  });

  it('keeps localStorage state when API fetch fails', async () => {
    const stored = { ...makeProduct({ id: 'local' }), viewedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([stored]));
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRecentlyViewed(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items[0].id).toBe('local');
  });

  // ── syncAfterLogin ────────────────────────────────────────────────────────

  it('syncAfterLogin pushes anon items to backend then fetches merged list', async () => {
    const anonItem = { ...makeProduct({ id: 'anon1' }), viewedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([anonItem]));

    mockPost.mockResolvedValue({ data: { success: true } });
    mockGet.mockResolvedValueOnce(serverProducts([anonItem]));

    const { result } = renderHook(() => useRecentlyViewed(false));

    await act(async () => { await result.current.syncAfterLogin(); });

    expect(mockPost).toHaveBeenCalledWith('/users/recent-products', expect.objectContaining({
      canonicalId: 'anon1',
    }));
    expect(mockGet).toHaveBeenCalledWith('/users/recent-products');
    expect(result.current.items[0].id).toBe('anon1');
  });

  it('syncAfterLogin is a no-op when localStorage is empty', async () => {
    const { result } = renderHook(() => useRecentlyViewed(false));
    await act(async () => { await result.current.syncAfterLogin(); });
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });
});

// ─── handleUsers API handler ──────────────────────────────────────────────────

vi.mock('../../api/_lib/db.js', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../api/_lib/auth.js', () => ({
  getUserFromRequest: vi.fn(),
}));

const mockFindOne        = vi.fn();
const mockFindOneAndUpdate = vi.fn();

vi.mock('../../api/_lib/models/UserPreferences.js', () => ({
  default: {
    findOne:          (...a: any[]) => mockFindOne(...a),
    findOneAndUpdate: (...a: any[]) => mockFindOneAndUpdate(...a),
  },
}));

import { handleUsers } from '../../api/_lib/handlers/users';
import { getUserFromRequest } from '../../api/_lib/auth.js';

const mockGetUser = getUserFromRequest as ReturnType<typeof vi.fn>;

function makeReq(method: string, body?: Record<string, unknown>) {
  return { method, body } as any;
}
function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json   = vi.fn().mockReturnValue(res);
  return res;
}

describe('handleUsers — GET /api/users/recent-products', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockReturnValue(null);
    const res = makeRes();
    await handleUsers(makeReq('GET'), res, 'recent-products');
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns empty array when user has no preferences doc', async () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'user' });
    mockFindOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    const res = makeRes();
    await handleUsers(makeReq('GET'), res, 'recent-products');
    expect(res.json).toHaveBeenCalledWith({ products: [] });
  });

  it('returns products sorted most-recent first', async () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'user' });
    const now = Date.now();
    mockFindOne.mockReturnValue({
      lean: () => Promise.resolve({
        recentProducts: [
          { canonicalId: 'old', title: 'Old', price: 100, platform: 'Amazon', url: 'u', viewedAt: new Date(now - 5000) },
          { canonicalId: 'new', title: 'New', price: 200, platform: 'Flipkart', url: 'u', viewedAt: new Date(now) },
        ],
      }),
    });
    const res = makeRes();
    await handleUsers(makeReq('GET'), res, 'recent-products');
    const { products } = res.json.mock.calls[0][0];
    expect(products[0].canonicalId).toBe('new');
    expect(products[1].canonicalId).toBe('old');
  });

  it('strips items older than TTL', async () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'user' });
    const now = Date.now();
    mockFindOne.mockReturnValue({
      lean: () => Promise.resolve({
        recentProducts: [
          { canonicalId: 'expired', title: 'X', price: 100, platform: 'Amazon', url: 'u', viewedAt: new Date(now - TTL_MS - 1000) },
          { canonicalId: 'fresh',   title: 'Y', price: 200, platform: 'Flipkart', url: 'u', viewedAt: new Date(now) },
        ],
      }),
    });
    const res = makeRes();
    await handleUsers(makeReq('GET'), res, 'recent-products');
    const { products } = res.json.mock.calls[0][0];
    expect(products.map((p: any) => p.canonicalId)).toEqual(['fresh']);
  });

  it('returns 405 for non-GET/POST methods', async () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'user' });
    const res = makeRes();
    await handleUsers(makeReq('DELETE'), res, 'recent-products');
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

describe('handleUsers — POST /api/users/recent-products', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockReturnValue(null);
    const res = makeRes();
    await handleUsers(makeReq('POST', { canonicalId: 'x', title: 'T', price: 100, platform: 'Amazon', url: 'u' }), res, 'recent-products');
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when required fields are missing', async () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'user' });
    const res = makeRes();
    await handleUsers(makeReq('POST', { canonicalId: 'x' }), res, 'recent-products');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls findOneAndUpdate twice (pull then push) and returns 201', async () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'user' });
    mockFindOneAndUpdate.mockResolvedValue({});
    const res = makeRes();
    await handleUsers(
      makeReq('POST', { canonicalId: 'c1', title: 'T', price: 999, platform: 'Myntra', url: 'https://myntra.com/p/1' }),
      res,
      'recent-products',
    );
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('push operation uses $position:0 and $slice for dedup+trim', async () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'user' });
    mockFindOneAndUpdate.mockResolvedValue({});
    const res = makeRes();
    await handleUsers(
      makeReq('POST', { canonicalId: 'c1', title: 'T', price: 999, platform: 'Myntra', url: 'https://myntra.com/p/1' }),
      res,
      'recent-products',
    );
    const secondCall = mockFindOneAndUpdate.mock.calls[1][1];
    expect(secondCall.$push.recentProducts.$position).toBe(0);
    expect(secondCall.$push.recentProducts.$slice).toBeGreaterThan(0);
  });

  it('returns 404 for unknown subpaths', async () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'user' });
    const res = makeRes();
    await handleUsers(makeReq('GET'), res, 'unknown-path');
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
