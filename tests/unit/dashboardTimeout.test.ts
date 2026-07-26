/**
 * tests/unit/dashboardTimeout.test.ts
 *
 * Isolated test for the dashboard aggregation timeout fix.
 * Kept separate from securityHardening.test.ts because that file mocks
 * the entire analytics module (needed for alert service tests), which would
 * shadow the real getDashboardMetrics/clearAggCache/DASHBOARD_TIMEOUT_MS.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/_lib/db', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../api/_lib/models/AnalyticsEvent', () => {
  const m = {
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
    insertMany: vi.fn().mockResolvedValue([]),
  };
  return { default: m };
});

import { getDashboardMetrics, clearAggCache, DASHBOARD_TIMEOUT_MS } from '../../api/_lib/analytics';
import AnalyticsEvent from '../../api/_lib/models/AnalyticsEvent';

const ae = AnalyticsEvent as any;

describe('getDashboardMetrics — timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAggCache();
  });

  it('DASHBOARD_TIMEOUT_MS is exported and equals 8000', () => {
    expect(DASHBOARD_TIMEOUT_MS).toBe(8000);
  });

  it('rejects with timeout error when aggregations stall beyond 8s', async () => {
    vi.useFakeTimers();

    const hanging = new Promise<never>(() => {});
    ae.aggregate.mockReturnValue(hanging);
    ae.countDocuments.mockReturnValue(hanging);

    // Attach catch immediately so neither race branch is ever unhandled
    const promise = getDashboardMetrics(7);
    const caught = promise.catch((e: Error) => e);

    await vi.advanceTimersByTimeAsync(DASHBOARD_TIMEOUT_MS + 100);

    const result = await caught;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch('timed out');
    vi.useRealTimers();
  }, 15_000);

  it('resolves normally when aggregations complete within 8s', async () => {
    ae.aggregate.mockResolvedValue([]);
    ae.countDocuments.mockResolvedValue(0);

    await expect(getDashboardMetrics(7)).resolves.toMatchObject({
      summary: expect.any(Object),
    });
  });

  it('uses cached result on second call — no extra DB queries', async () => {
    ae.aggregate.mockResolvedValue([]);
    ae.countDocuments.mockResolvedValue(0);

    await getDashboardMetrics(7);
    const callCount = ae.aggregate.mock.calls.length;

    await getDashboardMetrics(7); // should hit cache
    expect(ae.aggregate.mock.calls.length).toBe(callCount); // no new calls
  });
});
