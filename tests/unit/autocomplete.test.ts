/**
 * tests/unit/autocomplete.test.ts
 *
 * Tests for:
 *   - useAutocomplete hook
 *   - handleAutocomplete API handler
 *
 * Engine tests are in autocompleteService.test.ts (separate file — vi.mock hoisting).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../../api/_lib/autocompleteEngine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/_lib/autocompleteEngine.js')>();
  return {
    ...actual,
    getAutocompleteSuggestions: vi.fn(),
  };
});

import api from '../../src/services/api';
import {
  useAutocomplete,
  _autocompleteCache,
  RECENT_SEARCHES_KEY,
  MAX_RECENT_SEARCHES,
  DEBOUNCE_MS,
} from '../../src/hooks/useAutocomplete';
import { handleAutocomplete } from '../../api/_lib/handlers/autocomplete';
import { getAutocompleteSuggestions as _mockEngine, MAX_POPULAR } from '../../api/_lib/autocompleteEngine.js';

const mockGet    = (api as any).get as ReturnType<typeof vi.fn>;
const mockEngine = _mockEngine as ReturnType<typeof vi.fn>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<ReturnType<typeof makeData>> = {}) {
  return {
    popular:    [{ query: 'kurta', count: 42, matchType: 'prefix' as const }],
    products:   [{ title: 'Nike Air Max', brand: 'Nike', imageUrl: 'https://img.com/1.jpg', platform: 'Flipkart', price: 4999 }],
    brands:     ['Nike', 'Adidas'],
    categories: ['Footwear'],
    ...overrides,
  };
}

function makeReq(method = 'GET', query: Record<string, string> = {}) {
  return { method, query } as any;
}
function makeRes() {
  const res: any = {};
  res.status    = vi.fn().mockReturnValue(res);
  res.json      = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

// ─── useAutocomplete ──────────────────────────────────────────────────────────

describe('useAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    _autocompleteCache.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('starts in idle state with no data', () => {
    const { result } = renderHook(() => useAutocomplete());
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
  });

  it('debounces fetch — does not call API immediately', () => {
    mockGet.mockResolvedValue({ data: makeData() });
    const { result } = renderHook(() => useAutocomplete());
    act(() => { result.current.fetch('kurta'); });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('calls API after debounce delay', async () => {
    mockGet.mockResolvedValue({ data: makeData() });
    const { result } = renderHook(() => useAutocomplete());

    act(() => { result.current.fetch('kurta'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/search/autocomplete', expect.objectContaining({
      params: { q: 'kurta' },
    }));
  });

  it('transitions loading → success and populates data', async () => {
    const data = makeData();
    mockGet.mockResolvedValue({ data });
    const { result } = renderHook(() => useAutocomplete());

    act(() => { result.current.fetch('kurta'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toEqual(data);
  });

  it('sets status to error on network failure', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useAutocomplete());

    act(() => { result.current.fetch('kurta'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.status).toBe('error');
  });

  it('serves cached result on second fetch — no extra API calls', async () => {
    const data = makeData();
    mockGet.mockResolvedValue({ data });
    const { result } = renderHook(() => useAutocomplete());

    act(() => { result.current.fetch('kurta'); });
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.status).toBe('success');

    const callsBefore = mockGet.mock.calls.length;
    act(() => { result.current.fetch('kurta'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(mockGet.mock.calls.length).toBe(callsBefore);
  });

  it('ignores stale response when query changes mid-flight', async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstPending = new Promise(r => { resolveFirst = r; });
    const secondData = makeData({ popular: [{ query: 'sneakers', count: 10, matchType: 'exact' }] });

    mockGet
      .mockReturnValueOnce(firstPending)
      .mockResolvedValueOnce({ data: secondData });

    const { result } = renderHook(() => useAutocomplete());

    // Fire first fetch (kurta)
    act(() => { result.current.fetch('kurta'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    // Fire second fetch (sneakers) — debounce fires immediately since timer already ran
    act(() => { result.current.fetch('sneakers'); });
    await act(async () => { await vi.runAllTimersAsync(); });

    // Resolve the stale first request after second has settled
    await act(async () => { resolveFirst({ data: makeData() }); });

    // Should still show sneakers data
    expect(result.current.data?.popular[0].query).toBe('sneakers');
  });

  it('cancel() clears pending debounce — no API call fires', async () => {
    mockGet.mockResolvedValue({ data: makeData() });
    const { result } = renderHook(() => useAutocomplete());

    act(() => { result.current.fetch('kurta'); });
    act(() => { result.current.cancel(); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('sends empty params when query is empty string', async () => {
    mockGet.mockResolvedValue({ data: makeData() });
    const { result } = renderHook(() => useAutocomplete());

    act(() => { result.current.fetch(''); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/search/autocomplete', expect.objectContaining({
      params: {},
    }));
  });

  it('different queries use separate cache keys', async () => {
    mockGet
      .mockResolvedValueOnce({ data: makeData({ popular: [{ query: 'kurta', count: 5, matchType: 'exact' }] }) })
      .mockResolvedValueOnce({ data: makeData({ popular: [{ query: 'saree', count: 3, matchType: 'exact' }] }) });

    const { result } = renderHook(() => useAutocomplete());

    act(() => { result.current.fetch('kurta'); });
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.status).toBe('success');

    act(() => { result.current.fetch('saree'); });
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.data?.popular[0].query).toBe('saree');

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  // ── Recent searches ────────────────────────────────────────────────────────

  it('starts with empty recent searches when localStorage is empty', () => {
    const { result } = renderHook(() => useAutocomplete());
    expect(result.current.recentSearches).toEqual([]);
  });

  it('addRecentSearch prepends and deduplicates', () => {
    const { result } = renderHook(() => useAutocomplete());

    act(() => { result.current.addRecentSearch('kurta'); });
    act(() => { result.current.addRecentSearch('saree'); });
    act(() => { result.current.addRecentSearch('kurta'); }); // re-add

    expect(result.current.recentSearches[0]).toBe('kurta');
    expect(result.current.recentSearches[1]).toBe('saree');
    expect(result.current.recentSearches).toHaveLength(2);
  });

  it('addRecentSearch persists to localStorage', () => {
    const { result } = renderHook(() => useAutocomplete());
    act(() => { result.current.addRecentSearch('sneakers'); });

    const stored = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)!);
    expect(stored).toContain('sneakers');
  });

  it('respects MAX_RECENT_SEARCHES limit', () => {
    const { result } = renderHook(() => useAutocomplete());
    act(() => {
      for (let i = 0; i < MAX_RECENT_SEARCHES + 3; i++) {
        result.current.addRecentSearch(`query${i}`);
      }
    });
    expect(result.current.recentSearches).toHaveLength(MAX_RECENT_SEARCHES);
  });

  it('clearRecentSearches empties state and localStorage', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['kurta', 'saree']));
    const { result } = renderHook(() => useAutocomplete());

    act(() => { result.current.clearRecentSearches(); });

    expect(result.current.recentSearches).toEqual([]);
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
  });

  it('reads existing recent searches from localStorage on init', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['kurta', 'saree']));
    const { result } = renderHook(() => useAutocomplete());
    expect(result.current.recentSearches).toEqual(['kurta', 'saree']);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, 'not-json{{');
    const { result } = renderHook(() => useAutocomplete());
    expect(result.current.recentSearches).toEqual([]);
  });
});

// ─── handleAutocomplete ───────────────────────────────────────────────────────

describe('handleAutocomplete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 405 for non-GET methods', async () => {
    const res = makeRes();
    await handleAutocomplete(makeReq('POST'), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns static popular searches when q is empty', async () => {
    const res = makeRes();
    await handleAutocomplete(makeReq('GET', {}), res);
    const body = res.json.mock.calls[0][0];
    expect(Array.isArray(body.popular)).toBe(true);
    expect(body.popular.length).toBeGreaterThan(0);
    expect(body.products).toEqual([]);
    expect(body.brands).toEqual([]);
    expect(body.categories).toEqual([]);
    expect(mockEngine).not.toHaveBeenCalled();
  });

  it('sets Cache-Control header on empty query response', async () => {
    const res = makeRes();
    await handleAutocomplete(makeReq('GET', {}), res);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'));
  });

  it('calls engine with query when q is provided', async () => {
    mockEngine.mockResolvedValueOnce(makeData());
    const res = makeRes();
    await handleAutocomplete(makeReq('GET', { q: 'kurta' }), res);
    expect(mockEngine).toHaveBeenCalledWith('kurta', expect.any(Number));
  });

  it('returns engine result with Cache-Control header', async () => {
    const data = makeData();
    mockEngine.mockResolvedValueOnce(data);
    const res = makeRes();
    await handleAutocomplete(makeReq('GET', { q: 'kurta' }), res);
    expect(res.json).toHaveBeenCalledWith(data);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'));
  });

  it('clamps limit to 20 max', async () => {
    mockEngine.mockResolvedValueOnce(makeData());
    const res = makeRes();
    await handleAutocomplete(makeReq('GET', { q: 'kurta', limit: '999' }), res);
    expect(mockEngine).toHaveBeenCalledWith('kurta', 20);
  });

  it('clamps limit to 1 min — non-numeric falls back to MAX_POPULAR', async () => {
    mockEngine.mockResolvedValueOnce(makeData());
    const res = makeRes();
    await handleAutocomplete(makeReq('GET', { q: 'kurta', limit: 'abc' }), res);
    expect(mockEngine).toHaveBeenCalledWith('kurta', MAX_POPULAR);
  });

  it('returns 500 on engine error', async () => {
    mockEngine.mockRejectedValueOnce(new Error('DB error'));
    const res = makeRes();
    await handleAutocomplete(makeReq('GET', { q: 'kurta' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('trims whitespace from query', async () => {
    mockEngine.mockResolvedValueOnce(makeData());
    const res = makeRes();
    await handleAutocomplete(makeReq('GET', { q: '  kurta  ' }), res);
    expect(mockEngine).toHaveBeenCalledWith('kurta', expect.any(Number));
  });

  it('static popular list respects limit param', async () => {
    const res = makeRes();
    await handleAutocomplete(makeReq('GET', { limit: '3' }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.popular).toHaveLength(3);
  });
});
