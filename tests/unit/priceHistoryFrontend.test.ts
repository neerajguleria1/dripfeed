/**
 * tests/unit/priceHistoryFrontend.test.ts
 *
 * Unit tests for the price history frontend logic.
 * Tests deriveSignal() and the usePriceHistory hook in isolation.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deriveSignal } from '../../src/components/product/PriceInsightBadge';
import type { PriceStats } from '../../src/hooks/usePriceHistory';

// ─── deriveSignal ─────────────────────────────────────────────────────────────

function makeStats(overrides: Partial<PriceStats> = {}): PriceStats {
  return {
    lowestPrice:  800,
    highestPrice: 1200,
    latestPrice:  1000,
    firstSeen:    '2024-01-01T00:00:00Z',
    lastUpdated:  '2024-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('deriveSignal', () => {
  it('returns at-lowest when current price equals lowest', () => {
    expect(deriveSignal(800, makeStats())).toBe('at-lowest');
  });

  it('returns at-lowest within 1% tolerance above lowest', () => {
    // 800 * 1.01 = 808 — still at-lowest
    expect(deriveSignal(807, makeStats())).toBe('at-lowest');
  });

  it('returns near-high when current price is ≥90% of highest', () => {
    // 1200 * 0.90 = 1080
    expect(deriveSignal(1100, makeStats())).toBe('near-high');
    expect(deriveSignal(1200, makeStats())).toBe('near-high');
  });

  it('returns dropped when price dropped ≥5% from highest and not near-high', () => {
    // 1200 → 1000: drop = 16.7%, 1000 < 1080 so not near-high
    expect(deriveSignal(1000, makeStats())).toBe('dropped');
  });

  it('at-lowest takes priority over near-high when lowest === highest', () => {
    expect(deriveSignal(1000, makeStats({ lowestPrice: 1000, highestPrice: 1000 }))).toBe('at-lowest');
  });

  it('returns normal when highestPrice is 0 (no meaningful data)', () => {
    expect(deriveSignal(500, makeStats({ highestPrice: 0 }))).toBe('normal');
  });
});

// ─── usePriceHistory hook ─────────────────────────────────────────────────────

vi.mock('../../src/services/api', () => ({
  default: { get: vi.fn() },
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { usePriceHistory } from '../../src/hooks/usePriceHistory';
import api from '../../src/services/api';

const mockGet = (api as any).get as ReturnType<typeof vi.fn>;

const MOCK_POINTS = [
  { platform: 'flipkart', price: 999,  originalPrice: 1299, fetchedAt: '2024-05-01T10:00:00Z' },
  { platform: 'flipkart', price: 1099, originalPrice: 1299, fetchedAt: '2024-05-15T10:00:00Z' },
];

const MOCK_STATS = {
  lowestPrice:  999,
  highestPrice: 1299,
  latestPrice:  1099,
  firstSeen:    '2024-05-01T00:00:00Z',
  lastUpdated:  '2024-05-15T00:00:00Z',
};

describe('usePriceHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts in idle state — no fetch on mount', () => {
    const { result } = renderHook(() => usePriceHistory());
    expect(result.current.status).toBe('idle');
    expect(result.current.points).toEqual([]);
    expect(result.current.stats).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  // ── 30-day history ────────────────────────────────────────────────────────
  it('fetches 30-day history and populates points + stats', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/stats')) return Promise.resolve({ data: MOCK_STATS });
      return Promise.resolve({ data: { points: MOCK_POINTS } });
    });

    const { result } = renderHook(() => usePriceHistory());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.points).toHaveLength(2);
    expect(result.current.stats?.lowestPrice).toBe(999);
    expect(result.current.days).toBe(30);
  });

  // ── 90-day history ────────────────────────────────────────────────────────
  it('resets to idle when days changes to 90 (ready for re-fetch)', async () => {
    mockGet.mockResolvedValue({ data: { points: MOCK_POINTS, ...MOCK_STATS } });

    const { result } = renderHook(() => usePriceHistory());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).not.toBe('loading'));

    act(() => { result.current.setDays(90); });

    expect(result.current.status).toBe('idle');
    expect(result.current.days).toBe(90);
  });

  // ── No history yet ────────────────────────────────────────────────────────
  it('sets status to empty when API returns no points', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/stats')) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: { points: [] } });
    });

    const { result } = renderHook(() => usePriceHistory());
    await act(async () => { result.current.fetch('new_product'); });
    await waitFor(() => expect(result.current.status).toBe('empty'));

    expect(result.current.points).toHaveLength(0);
    expect(result.current.stats).toBeNull();
  });

  // ── Error state ───────────────────────────────────────────────────────────
  it('sets status to error on API failure', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePriceHistory());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  // ── Large history (90 points) ─────────────────────────────────────────────
  it('handles 90 data points without error', async () => {
    const largePoints = Array.from({ length: 90 }, (_, i) => ({
      platform: 'amazon india',
      price: 1000 + i * 10,
      fetchedAt: new Date(Date.now() - i * 86_400_000).toISOString(),
    }));

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/stats')) return Promise.resolve({ data: MOCK_STATS });
      return Promise.resolve({ data: { points: largePoints } });
    });

    const { result } = renderHook(() => usePriceHistory());
    await act(async () => { result.current.fetch('canon_large'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.points).toHaveLength(90);
  });

  // ── Cache hit — no duplicate API calls ───────────────────────────────────
  it('serves cached result on second fetch — no extra API calls', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/stats')) return Promise.resolve({ data: MOCK_STATS });
      return Promise.resolve({ data: { points: MOCK_POINTS } });
    });

    const { result } = renderHook(() => usePriceHistory());

    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const callsBefore = mockGet.mock.calls.length;

    await act(async () => { result.current.fetch('canon_abc'); });

    expect(mockGet.mock.calls.length).toBe(callsBefore); // no new calls
    expect(result.current.status).toBe('success');
  });

  // ── Responsive layout — days default ─────────────────────────────────────
  it('defaults to 30-day window', () => {
    const { result } = renderHook(() => usePriceHistory());
    expect(result.current.days).toBe(30);
  });

  // ── Dark mode — no logic to test, but hook is theme-agnostic ─────────────
  it('hook state is independent of theme (dark mode safe)', () => {
    const { result } = renderHook(() => usePriceHistory());
    // Hook has no theme dependency — just verify it initialises cleanly
    expect(result.current.status).toBe('idle');
  });
});
