/**
 * tests/unit/analyticsEventRoute.test.ts
 *
 * Regression test for the analytics event persistence bug.
 *
 * Bug: the main API router had a short-circuit stub
 *   `if (path.startsWith('analytics/')) return res.status(200).json({ ok: true });`
 * that intercepted every POST /api/analytics/event before it could reach
 * handleAnalytics. Events were silently discarded — never persisted to MongoDB.
 *
 * Fix: removed the stub; handleAnalytics is now called directly.
 *
 * This test verifies:
 *   1. handleAnalytics.trackEvent calls enqueueEvent for valid events.
 *   2. handleAnalytics.trackEvent ignores invalid/unknown event names.
 *   3. handleAnalytics.trackEvent accepts a batch (array) of events.
 *   4. handleAnalytics.dashboard requires admin auth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../api/_lib/analytics', () => ({
  enqueueEvent: vi.fn(),
  getDashboardMetrics: vi.fn().mockResolvedValue({ summary: {}, topSearches: [] }),
}));

vi.mock('../../api/_lib/adminAuth', () => ({
  requireAdmin: vi.fn(),
}));

import { enqueueEvent } from '../../api/_lib/analytics';
import { requireAdmin } from '../../api/_lib/adminAuth';
import { handleAnalytics } from '../../api/_lib/handlers/analytics';

const mockEnqueue = enqueueEvent as ReturnType<typeof vi.fn>;
const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>;

function makeRes(): any {
  const r: any = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json   = vi.fn().mockReturnValue(r);
  r.end    = vi.fn().mockReturnValue(r);
  return r;
}

function makeReq(method: string, body: unknown): any {
  return { method, body, headers: {}, query: {} };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('analytics event route — persistence regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockReturnValue(true);
  });

  it('enqueues a valid single event', async () => {
    const req = makeReq('POST', {
      event: 'search_performed',
      sessionId: 'sess-abc123',
      device: 'web',
      query: 'kurta',
    });
    const res = makeRes();
    await handleAnalytics(req, res, 'event');

    expect(res.status).toHaveBeenCalledWith(204);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'search_performed', sessionId: 'sess-abc123' })
    );
  });

  it('enqueues a valid batch of events', async () => {
    const req = makeReq('POST', [
      { event: 'search_performed',   sessionId: 's1', device: 'web' },
      { event: 'affiliate_link_clicked', sessionId: 's2', device: 'mobile', platform: 'Myntra' },
    ]);
    const res = makeRes();
    await handleAnalytics(req, res, 'event');

    expect(res.status).toHaveBeenCalledWith(204);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
  });

  it('drops events with unknown event names', async () => {
    const req = makeReq('POST', {
      event: 'totally_made_up_event',
      sessionId: 'sess-xyz',
    });
    const res = makeRes();
    await handleAnalytics(req, res, 'event');

    expect(res.status).toHaveBeenCalledWith(204);
    // event was unknown → enqueueEvent must NOT be called
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('drops events with missing sessionId', async () => {
    const req = makeReq('POST', {
      event: 'search_performed',
      // sessionId intentionally omitted
    });
    const res = makeRes();
    await handleAnalytics(req, res, 'event');

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('returns 405 for GET on /analytics/event', async () => {
    const req = { ...makeReq('GET', {}), body: {} };
    const res = makeRes();
    await handleAnalytics(req as any, res, 'event');
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

describe('analytics dashboard route — admin protection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls requireAdmin and returns metrics when admin', async () => {
    mockRequireAdmin.mockReturnValue(true);
    const req = makeReq('GET', {});
    const res = makeRes();
    await handleAnalytics(req, res, 'dashboard');

    expect(mockRequireAdmin).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ summary: expect.any(Object) })
    );
  });

  it('blocks non-admin access to dashboard', async () => {
    mockRequireAdmin.mockImplementation((_req: any, r: any) => {
      r.status(403).json({ error: 'Admin access required' });
      return false;
    });
    const req = makeReq('GET', {});
    const res = makeRes();
    await handleAnalytics(req, res, 'dashboard');

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('analytics router — unknown subpath', () => {
  it('returns 404 for unknown analytics subpath', async () => {
    const req = makeReq('GET', {});
    const res = makeRes();
    await handleAnalytics(req, res, 'nonexistent');
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
