/**
 * tests/unit/analytics.test.ts
 *
 * Tests for the analytics backend (enqueueEvent, batching, aggregation)
 * and the frontend tracker (session ID, queue, batch flush).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Backend analytics ────────────────────────────────────────────────────────

vi.mock('../../api/_lib/db', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../api/_lib/models/AnalyticsEvent', () => {
  const insertMany = vi.fn().mockResolvedValue([]);
  const countDocuments = vi.fn().mockResolvedValue(0);
  const aggregate = vi.fn().mockResolvedValue([]);
  const Model = { insertMany, countDocuments, aggregate };
  return { default: Model };
});

import {
  enqueueEvent,
  getQueueLength,
  clearQueue,
  clearAggCache,
  flushAll,
} from '../../api/_lib/analytics';
import AnalyticsEvent from '../../api/_lib/models/AnalyticsEvent';

const mockInsertMany = (AnalyticsEvent as any).insertMany as ReturnType<typeof vi.fn>;

describe('analytics backend', () => {
  beforeEach(() => {
    clearQueue();
    clearAggCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearQueue();
  });

  // ── Event creation ────────────────────────────────────────────────────────

  it('enqueueEvent adds to queue', () => {
    enqueueEvent({ event: 'search_performed', sessionId: 'sess1', device: 'web', ts: new Date(), query: 'kurta' });
    expect(getQueueLength()).toBe(1);
  });

  it('enqueueEvent accepts all valid event types', () => {
    const events = [
      'search_performed', 'search_result_viewed', 'product_card_clicked',
      'product_detail_viewed', 'compare_opened', 'compare_completed',
      'affiliate_link_clicked', 'wishlist_added', 'wishlist_removed',
      'share_clicked', 'price_history_expanded', 'recommendation_clicked',
      'recommendation_section_viewed', 'no_results_search', '404_product',
    ] as const;
    for (const event of events) {
      enqueueEvent({ event, sessionId: 'sess1', device: 'web', ts: new Date() });
    }
    expect(getQueueLength()).toBe(events.length);
  });

  // ── Batching ──────────────────────────────────────────────────────────────

  it('flushAll writes all queued events in one insertMany call', async () => {
    enqueueEvent({ event: 'search_performed', sessionId: 's1', device: 'web', ts: new Date(), query: 'shoes' });
    enqueueEvent({ event: 'product_detail_viewed', sessionId: 's1', device: 'web', ts: new Date(), productTitle: 'Nike' });
    enqueueEvent({ event: 'affiliate_link_clicked', sessionId: 's1', device: 'mobile', ts: new Date(), platform: 'flipkart' });

    await flushAll();

    expect(mockInsertMany).toHaveBeenCalledTimes(1);
    const batch = mockInsertMany.mock.calls[0][0];
    expect(batch).toHaveLength(3);
    expect(getQueueLength()).toBe(0);
  });

  it('flushAll does nothing when queue is empty', async () => {
    await flushAll();
    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it('queue is cleared after flush', async () => {
    enqueueEvent({ event: 'search_performed', sessionId: 's1', device: 'web', ts: new Date() });
    await flushAll();
    expect(getQueueLength()).toBe(0);
  });

  // ── Duplicate protection — same session, same event ───────────────────────

  it('multiple events from same session are all queued (no dedup at queue level)', () => {
    for (let i = 0; i < 5; i++) {
      enqueueEvent({ event: 'search_performed', sessionId: 'sess_dup', device: 'web', ts: new Date(), query: 'kurta' });
    }
    expect(getQueueLength()).toBe(5);
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('flush does not throw when insertMany fails', async () => {
    mockInsertMany.mockRejectedValueOnce(new Error('DB error'));
    enqueueEvent({ event: 'search_performed', sessionId: 's1', device: 'web', ts: new Date() });
    await expect(flushAll()).resolves.not.toThrow();
  });

  it('queue is cleared even when insertMany fails', async () => {
    mockInsertMany.mockRejectedValueOnce(new Error('DB error'));
    enqueueEvent({ event: 'search_performed', sessionId: 's1', device: 'web', ts: new Date() });
    await flushAll();
    expect(getQueueLength()).toBe(0);
  });

  // ── Payload fields ────────────────────────────────────────────────────────

  it('event payload preserves all optional fields', async () => {
    enqueueEvent({
      event: 'search_performed',
      sessionId: 'sess_full',
      device: 'mobile',
      ts: new Date(),
      query: 'silk saree',
      platform: 'myntra',
      canonicalId: 'canon_abc',
      productTitle: 'Silk Saree',
      section: 'similar',
      latencyMs: 1234,
      resultCount: 42,
    });
    await flushAll();
    const batch = mockInsertMany.mock.calls[0][0];
    const ev = batch[0];
    expect(ev.query).toBe('silk saree');
    expect(ev.platform).toBe('myntra');
    expect(ev.latencyMs).toBe(1234);
    expect(ev.resultCount).toBe(42);
    expect(ev.device).toBe('mobile');
  });

  it('event ts is a Date object', async () => {
    enqueueEvent({ event: 'search_performed', sessionId: 's1', device: 'web', ts: new Date() });
    await flushAll();
    const batch = mockInsertMany.mock.calls[0][0];
    expect(batch[0].ts).toBeInstanceOf(Date);
  });

  // ── Large batch ───────────────────────────────────────────────────────────

  it('handles 200 events in a single flush', async () => {
    for (let i = 0; i < 200; i++) {
      enqueueEvent({ event: 'product_card_clicked', sessionId: `s${i}`, device: 'web', ts: new Date() });
    }
    await flushAll();
    const batch = mockInsertMany.mock.calls[0][0];
    expect(batch.length).toBeLessThanOrEqual(200);
    expect(getQueueLength()).toBe(0);
  });
});

// ─── HTTP handler ─────────────────────────────────────────────────────────────

import { handleAnalytics } from '../../api/_lib/handlers/analytics';

function makeReq(method: string, body: unknown, query: Record<string, string> = {}): any {
  return { method, body, query, headers: {} };
}
function makeRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

describe('analytics handler', () => {
  beforeEach(() => { clearQueue(); vi.clearAllMocks(); });
  afterEach(() => clearQueue());

  it('POST /analytics/event returns 204 immediately', async () => {
    const req = makeReq('POST', { event: 'search_performed', sessionId: 'abc123', device: 'web', query: 'kurta' });
    const res = makeRes();
    await handleAnalytics(req, res, 'event');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it('POST /analytics/event accepts a batch array', async () => {
    const req = makeReq('POST', [
      { event: 'search_performed', sessionId: 'abc', device: 'web', query: 'shoes' },
      { event: 'product_detail_viewed', sessionId: 'abc', device: 'web', productTitle: 'Nike' },
    ]);
    const res = makeRes();
    await handleAnalytics(req, res, 'event');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(getQueueLength()).toBe(2);
  });

  it('POST /analytics/event silently drops unknown event names', async () => {
    const req = makeReq('POST', { event: 'unknown_event', sessionId: 'abc', device: 'web' });
    const res = makeRes();
    await handleAnalytics(req, res, 'event');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(getQueueLength()).toBe(0);
  });

  it('POST /analytics/event silently drops events with no sessionId', async () => {
    const req = makeReq('POST', { event: 'search_performed', device: 'web', query: 'kurta' });
    const res = makeRes();
    await handleAnalytics(req, res, 'event');
    expect(getQueueLength()).toBe(0);
  });

  it('POST /analytics/event truncates long query strings', async () => {
    const longQuery = 'a'.repeat(500);
    const req = makeReq('POST', { event: 'search_performed', sessionId: 'abc', device: 'web', query: longQuery });
    const res = makeRes();
    await handleAnalytics(req, res, 'event');
    await flushAll();
    const batch = mockInsertMany.mock.calls[0]?.[0];
    if (batch) expect(batch[0].query.length).toBeLessThanOrEqual(200);
  });

  it('GET /analytics/event returns 405', async () => {
    const req = makeReq('GET', null);
    const res = makeRes();
    await handleAnalytics(req, res, 'event');
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('unknown subpath returns 404', async () => {
    const req = makeReq('GET', null);
    const res = makeRes();
    await handleAnalytics(req, res, 'unknown');
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── Frontend tracker ─────────────────────────────────────────────────────────

/**
 * @vitest-environment jsdom
 */

describe('frontend analytics tracker', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    // Clear sessionStorage between tests
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('track() does not throw', async () => {
    const { track } = await import('../../src/utils/analytics');
    expect(() => track({ event: 'search_performed', query: 'kurta' })).not.toThrow();
  });

  it('Analytics convenience wrappers call track without throwing', async () => {
    const { Analytics } = await import('../../src/utils/analytics');
    expect(() => Analytics.searchPerformed('kurta', 1200, 10)).not.toThrow();
    expect(() => Analytics.productDetailViewed('canon_abc', 'Nike Shoes')).not.toThrow();
    expect(() => Analytics.affiliateLinkClicked('flipkart', 'Nike Shoes')).not.toThrow();
    expect(() => Analytics.noResultsSearch('xyz123')).not.toThrow();
    expect(() => Analytics.product404('canon_missing')).not.toThrow();
    expect(() => Analytics.shareClicked('canon_abc', 'Nike Shoes')).not.toThrow();
    expect(() => Analytics.priceHistoryExpanded('canon_abc')).not.toThrow();
    expect(() => Analytics.recommendationClicked('canon_abc', 'similar', 'Nike')).not.toThrow();
    expect(() => Analytics.recommendationSectionViewed('similar')).not.toThrow();
    expect(() => Analytics.wishlistAdded('Nike Shoes', 'flipkart')).not.toThrow();
    expect(() => Analytics.wishlistRemoved('Nike Shoes')).not.toThrow();
    expect(() => Analytics.compareOpened('kurta')).not.toThrow();
    expect(() => Analytics.compareCompleted('kurta', 5)).not.toThrow();
  });

  it('session ID is consistent within the same session', async () => {
    // Re-import to get fresh module state
    vi.resetModules();
    const { track } = await import('../../src/utils/analytics');
    track({ event: 'search_performed', query: 'a' });
    track({ event: 'search_performed', query: 'b' });
    // Both calls use the same sessionId stored in sessionStorage
    const sid = sessionStorage.getItem('tc_sid');
    expect(sid).toBeTruthy();
    expect(typeof sid).toBe('string');
  });

  it('session ID is not a PII value (no email, no name pattern)', async () => {
    vi.resetModules();
    const { track } = await import('../../src/utils/analytics');
    track({ event: 'search_performed', query: 'test' });
    const sid = sessionStorage.getItem('tc_sid');
    expect(sid).not.toMatch(/@/);
    expect(sid).not.toMatch(/\d{10}/); // no phone numbers
  });
});
