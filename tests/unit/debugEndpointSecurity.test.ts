/**
 * tests/unit/debugEndpointSecurity.test.ts
 *
 * Regression test for debug endpoint authentication.
 *
 * Bug: /api/debug/* endpoints (search, search-old, live) were reachable without
 * any authentication, exposing ScraperAPI keys, internal scraper diagnostics,
 * and raw product data.
 *
 * Fix: requireAdmin() guard added as the first line of handleDebug.
 *
 * This test verifies:
 *   1. handleDebug returns 401 when no JWT is provided.
 *   2. handleDebug returns 403 when a non-admin JWT is provided.
 *   3. handleDebug proceeds to the actual subpath handler when admin auth passes.
 *   4. handleDebug returns 404 for unknown subpaths (after auth).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../api/_lib/adminAuth', () => ({
  requireAdmin: vi.fn(),
}));

// Mock out the internal debug functions so we don't actually hit ScraperAPI
vi.mock('axios', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn().mockResolvedValue({ data: {} }) },
}));

import { requireAdmin } from '../../api/_lib/adminAuth';
import { handleDebug } from '../../api/_lib/handlers/debug';

const mockRequireAdmin = requireAdmin as ReturnType<typeof vi.fn>;

function makeRes(): any {
  const r: any = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json   = vi.fn().mockReturnValue(r);
  r.end    = vi.fn().mockReturnValue(r);
  return r;
}

function makeReq(method = 'GET'): any {
  return { method, headers: {}, query: { q: 'kurta' } };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleDebug — authentication guard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 for unauthenticated requests', async () => {
    mockRequireAdmin.mockImplementation((_req: any, r: any) => {
      r.status(401).json({ error: 'Authentication required' });
      return false;
    });

    const res = makeRes();
    await handleDebug(makeReq(), res, 'search');

    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 for authenticated non-admin users', async () => {
    mockRequireAdmin.mockImplementation((_req: any, r: any) => {
      r.status(403).json({ error: 'Admin access required' });
      return false;
    });

    const res = makeRes();
    await handleDebug(makeReq(), res, 'search');

    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('proceeds past the guard when user is admin', async () => {
    // Admin passes — handleDebug will continue to try the actual subpath
    mockRequireAdmin.mockReturnValue(true);

    const res = makeRes();
    // 'unknown-subpath' returns 404 — that means auth was accepted and routing happened
    await handleDebug(makeReq(), res, 'unknown-subpath');

    expect(mockRequireAdmin).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('returns 404 for unknown subpaths (after successful auth)', async () => {
    mockRequireAdmin.mockReturnValue(true);
    const res = makeRes();
    await handleDebug(makeReq(), res, 'nonexistent');
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('checks auth on every subpath — not just "search"', async () => {
    mockRequireAdmin.mockImplementation((_req: any, r: any) => {
      r.status(401).json({ error: 'Authentication required' });
      return false;
    });

    for (const subpath of ['search', 'search-old', 'live']) {
      const res = makeRes();
      await handleDebug(makeReq(), res, subpath);
      expect(res.status).toHaveBeenCalledWith(401);
      vi.clearAllMocks();
      mockRequireAdmin.mockImplementation((_req: any, r: any) => {
        r.status(401).json({ error: 'Authentication required' });
        return false;
      });
    }
  });
});
