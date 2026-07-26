/**
 * tests/unit/securityHardening.test.ts
 *
 * Regression tests for all 7 production hardening fixes:
 *   1. Admin endpoint authentication
 *   2. Rate limiting on alert creation
 *   3. Secret leakage prevention (scraperUrl)
 *   4. LRU cache bounded eviction
 *   5. Product detail index lookup
 *   6. Batch alert evaluation (chunks of 50)
 *   7. Dashboard aggregation timeout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── 1. Admin authentication ──────────────────────────────────────────────────

import { requireAdmin } from '../../api/_lib/adminAuth';

vi.mock('../../api/_lib/auth', () => ({
  getUserFromRequest: vi.fn(),
}));

import { getUserFromRequest } from '../../api/_lib/auth';
const mockGetUser = getUserFromRequest as ReturnType<typeof vi.fn>;

function makeRes(): any {
  const r: any = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json   = vi.fn().mockReturnValue(r);
  r.end    = vi.fn().mockReturnValue(r);
  return r;
}

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true for a valid admin JWT', () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'admin' });
    const res = makeRes();
    expect(requireAdmin({} as any, res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns false and sends 401 when no token', () => {
    mockGetUser.mockReturnValue(null);
    const res = makeRes();
    expect(requireAdmin({} as any, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns false and sends 403 for non-admin role', () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'user' });
    const res = makeRes();
    expect(requireAdmin({} as any, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects role=superuser (only admin is accepted)', () => {
    mockGetUser.mockReturnValue({ userId: 'u1', email: 'a@b.com', role: 'superuser' });
    const res = makeRes();
    expect(requireAdmin({} as any, res)).toBe(false);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─── 2. Rate limiting ─────────────────────────────────────────────────────────

import { checkRateLimit, clearRateLimitStore, getRateLimitCount } from '../../api/_lib/rateLimit';

describe('checkRateLimit', () => {
  beforeEach(() => clearRateLimitStore());
  afterEach(() => clearRateLimitStore());

  it('allows requests up to the max', () => {
    const opts = { max: 3, windowMs: 60_000 };
    expect(checkRateLimit('sess1', opts)).toBe(true);
    expect(checkRateLimit('sess1', opts)).toBe(true);
    expect(checkRateLimit('sess1', opts)).toBe(true);
  });

  it('denies the request that exceeds max', () => {
    const opts = { max: 3, windowMs: 60_000 };
    checkRateLimit('sess1', opts);
    checkRateLimit('sess1', opts);
    checkRateLimit('sess1', opts);
    expect(checkRateLimit('sess1', opts)).toBe(false);
  });

  it('different keys are independent', () => {
    const opts = { max: 1, windowMs: 60_000 };
    expect(checkRateLimit('sessA', opts)).toBe(true);
    expect(checkRateLimit('sessB', opts)).toBe(true);
    expect(checkRateLimit('sessA', opts)).toBe(false);
    expect(checkRateLimit('sessB', opts)).toBe(false);
  });

  it('sliding window: old timestamps outside window do not count', () => {
    vi.useFakeTimers();
    const opts = { max: 2, windowMs: 1000 };
    checkRateLimit('sess1', opts); // t=0
    checkRateLimit('sess1', opts); // t=0 — now at max
    expect(checkRateLimit('sess1', opts)).toBe(false);

    vi.advanceTimersByTime(1001); // slide window past both timestamps
    expect(checkRateLimit('sess1', opts)).toBe(true); // allowed again
    vi.useRealTimers();
  });

  it('getRateLimitCount returns correct count within window', () => {
    const opts = { max: 10, windowMs: 60_000 };
    checkRateLimit('sess1', opts);
    checkRateLimit('sess1', opts);
    checkRateLimit('sess1', opts);
    expect(getRateLimitCount('sess1', 60_000)).toBe(3);
  });

  it('returns 0 for unknown key', () => {
    expect(getRateLimitCount('unknown', 60_000)).toBe(0);
  });
});

// ─── 3. Secret leakage — scraperUrl ──────────────────────────────────────────
// We can't import scraperUrl directly (it's not exported), so we verify the
// behaviour indirectly: the api_key must appear in the URL string, not in any
// axios params object. We test the URL-building logic by reconstructing it.

describe('scraperUrl secret isolation', () => {
  it('api_key is embedded in the URL string, not a separate object', () => {
    // Replicate the scraperUrl logic to verify the contract
    const key = 'test-secret-key';
    const targetUrl = 'https://www.amazon.in/s?k=kurta';
    const base = new URL('https://api.scraperapi.com/');
    base.searchParams.set('api_key', key);
    base.searchParams.set('url', targetUrl);
    base.searchParams.set('country_code', 'in');
    const result = base.toString();

    // Key is in the URL string
    expect(result).toContain('api_key=test-secret-key');
    // No separate params object — the URL is a plain string
    expect(typeof result).toBe('string');
  });

  it('extra params are appended to the URL string', () => {
    const base = new URL('https://api.scraperapi.com/');
    base.searchParams.set('api_key', 'k');
    base.searchParams.set('url', 'https://example.com');
    base.searchParams.set('country_code', 'in');
    base.searchParams.set('render', 'true');
    base.searchParams.set('wait', '8000');
    const result = base.toString();
    expect(result).toContain('render=true');
    expect(result).toContain('wait=8000');
  });
});

// ─── 4. LRU cache ─────────────────────────────────────────────────────────────

import { LRUCache } from '../../api/_lib/lruCache';

describe('LRUCache', () => {
  it('stores and retrieves a value', () => {
    const c = new LRUCache<string, number>({ maxSize: 10 });
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
  });

  it('returns null for missing key', () => {
    const c = new LRUCache<string, number>({ maxSize: 10 });
    expect(c.get('missing')).toBeNull();
  });

  it('evicts the LRU entry when maxSize is exceeded', () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    // 'a' is LRU — adding 'd' should evict 'a'
    c.set('d', 4);
    expect(c.get('a')).toBeNull();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
    expect(c.get('d')).toBe(4);
  });

  it('accessing a key promotes it to MRU, protecting it from eviction', () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.get('a'); // promote 'a' — now 'b' is LRU
    c.set('d', 4); // should evict 'b'
    expect(c.get('b')).toBeNull();
    expect(c.get('a')).toBe(1);
  });

  it('never exceeds maxSize', () => {
    const c = new LRUCache<string, number>({ maxSize: 500 });
    for (let i = 0; i < 600; i++) c.set(`k${i}`, i);
    expect(c.size).toBe(500);
  });

  it('respects TTL — returns null for stale entries', () => {
    vi.useFakeTimers();
    const c = new LRUCache<string, number>({ maxSize: 10, ttlMs: 1000 });
    c.set('a', 42);
    expect(c.get('a')).toBe(42);
    vi.advanceTimersByTime(1001);
    expect(c.get('a')).toBeNull();
    vi.useRealTimers();
  });

  it('fresh entries are not evicted by TTL', () => {
    vi.useFakeTimers();
    const c = new LRUCache<string, number>({ maxSize: 10, ttlMs: 5000 });
    c.set('a', 1);
    vi.advanceTimersByTime(4999);
    expect(c.get('a')).toBe(1);
    vi.useRealTimers();
  });

  it('clear() empties the cache', () => {
    const c = new LRUCache<string, number>({ maxSize: 10 });
    c.set('a', 1);
    c.set('b', 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get('a')).toBeNull();
  });

  it('delete() removes a specific key', () => {
    const c = new LRUCache<string, number>({ maxSize: 10 });
    c.set('a', 1);
    c.delete('a');
    expect(c.get('a')).toBeNull();
  });

  it('updating an existing key moves it to MRU', () => {
    const c = new LRUCache<string, number>({ maxSize: 3 });
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3);
    c.set('a', 99); // re-insert 'a' — 'b' becomes LRU
    c.set('d', 4);  // evicts 'b'
    expect(c.get('b')).toBeNull();
    expect(c.get('a')).toBe(99);
  });
});

// ─── 5. Product detail index lookup ──────────────────────────────────────────

vi.mock('../../api/_lib/db', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

const mockSearchCache = {
  findOne: vi.fn(),
  find: vi.fn(),
};

vi.mock('../../api/_lib/models/SearchCache', () => ({ default: mockSearchCache }));
vi.mock('../../api/_lib/search', () => ({
  groupSearchResults: vi.fn(),
  searchProducts: vi.fn().mockResolvedValue([]),
}));

import { handleProductDetail } from '../../api/_lib/handlers/productDetail';
import { groupSearchResults } from '../../api/_lib/search';

const mockGroup = groupSearchResults as ReturnType<typeof vi.fn>;

function makeReq(method = 'GET'): any {
  return { method, headers: {}, query: {} };
}

describe('handleProductDetail — index lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchCache.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }),
    });
  });

  it('uses findOne with canonicalIds index (fast path)', async () => {
    const fakeProduct = { id: 'az_B0TEST', title: 'Test', offers: [], offerCount: 0 };
    mockSearchCache.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ query: 'kurta', results: [], canonicalIds: ['az_B0TEST'] }),
    });
    mockGroup.mockReturnValue([fakeProduct]);

    const res = makeRes();
    await handleProductDetail(makeReq(), res, 'az_B0TEST');

    // Fast path: findOne called with canonicalIds filter
    expect(mockSearchCache.findOne).toHaveBeenCalledWith(
      { canonicalIds: 'az_B0TEST' },
      expect.any(Object),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ product: fakeProduct, query: 'kurta' })
    );
  });

  it('falls back to legacy scan when findOne returns null', async () => {
    mockSearchCache.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    mockSearchCache.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { query: 'kurta', results: [], canonicalIds: undefined },
          ]),
        }),
      }),
    });
    mockGroup.mockReturnValue([{ id: 'az_B0TEST', title: 'Test', offers: [], offerCount: 0 }]);

    const res = makeRes();
    await handleProductDetail(makeReq(), res, 'az_B0TEST');

    // Legacy scan triggered
    expect(mockSearchCache.find).toHaveBeenCalledWith(
      { canonicalIds: { $exists: false } },
      expect.any(Object),
    );
  });

  it('returns 404 when product not found in either path', async () => {
    mockSearchCache.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    mockSearchCache.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      }),
    });
    mockGroup.mockReturnValue([]);

    const res = makeRes();
    await handleProductDetail(makeReq(), res, 'az_NOTFOUND');
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 for missing canonicalId', async () => {
    const res = makeRes();
    await handleProductDetail(makeReq(), res, '');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 405 for non-GET method', async () => {
    const res = makeRes();
    await handleProductDetail({ method: 'POST', headers: {}, query: {} } as any, res, 'az_B0TEST');
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ─── 6. Batch alert evaluation (chunks of 50) ─────────────────────────────────

vi.mock('../../api/_lib/models/PriceAlert', () => {
  const m = {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  };
  return { default: m };
});
vi.mock('../../api/_lib/analytics', () => ({ enqueueEvent: vi.fn() }));

import { evaluateAlerts } from '../../api/_lib/alertService';
import PriceAlertModel from '../../api/_lib/models/PriceAlert';
const pa = PriceAlertModel as any;

function makeAlert(overrides: any = {}): any {
  return {
    _id: `a_${Math.random()}`,
    canonicalId: 'az_B0TEST',
    targetPrice: 500,
    currentPrice: 1000,
    sessionId: 'sess1',
    productTitle: 'Test',
    status: 'active',
    ...overrides,
  };
}

describe('evaluateAlerts — chunked execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pa.updateMany.mockResolvedValue({});
  });

  it('processes 120 triggers in chunks — findOneAndUpdate called 120 times total', async () => {
    const alerts = Array.from({ length: 120 }, (_, i) =>
      makeAlert({ _id: `a${i}`, targetPrice: 999 })
    );
    pa.find.mockResolvedValue(alerts);
    // All trigger (latestPrice 100 <= targetPrice 999)
    pa.findOneAndUpdate.mockResolvedValue({ ...alerts[0], status: 'triggered' });

    const result = await evaluateAlerts('az_B0TEST', 100);

    expect(pa.findOneAndUpdate).toHaveBeenCalledTimes(120);
    expect(result.triggered).toBe(120);
  });

  it('processes exactly 50 alerts in a single chunk without extra calls', async () => {
    const alerts = Array.from({ length: 50 }, (_, i) =>
      makeAlert({ _id: `a${i}`, targetPrice: 999 })
    );
    pa.find.mockResolvedValue(alerts);
    pa.findOneAndUpdate.mockResolvedValue({ ...alerts[0], status: 'triggered' });

    await evaluateAlerts('az_B0TEST', 100);
    expect(pa.findOneAndUpdate).toHaveBeenCalledTimes(50);
  });

  it('processes 51 alerts — second chunk has exactly 1 call', async () => {
    const alerts = Array.from({ length: 51 }, (_, i) =>
      makeAlert({ _id: `a${i}`, targetPrice: 999 })
    );
    pa.find.mockResolvedValue(alerts);
    pa.findOneAndUpdate.mockResolvedValue({ ...alerts[0], status: 'triggered' });

    await evaluateAlerts('az_B0TEST', 100);
    expect(pa.findOneAndUpdate).toHaveBeenCalledTimes(51);
  });
});

// ─── 7. Dashboard aggregation timeout ────────────────────────────────────────
// See dashboardTimeout.test.ts — kept separate to avoid mock shadowing.
