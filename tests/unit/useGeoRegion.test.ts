/**
 * tests/unit/useGeoRegion.test.ts
 *
 * Tests for useGeoRegion hook:
 *   - Reading geo data from API response
 *   - Fallback heuristic via navigator.language
 *   - localStorage dismiss persistence
 *   - Graceful handling of missing localStorage
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeoRegion } from '../../src/hooks/useGeoRegion';

// ─── Setup ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tagcheck_geo_dismissed';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── API geo data (primary source) ───────────────────────────────────────────

describe('useGeoRegion – API geo data', () => {
  it('returns India when geo.isIndia is true', () => {
    const { result } = renderHook(() =>
      useGeoRegion({ country: 'IN', isIndia: true })
    );
    expect(result.current.countryCode).toBe('IN');
    expect(result.current.isIndia).toBe(true);
  });

  it('returns non-India when geo.isIndia is false', () => {
    const { result } = renderHook(() =>
      useGeoRegion({ country: 'US', isIndia: false })
    );
    expect(result.current.countryCode).toBe('US');
    expect(result.current.isIndia).toBe(false);
  });

  it('handles empty country string from API', () => {
    const { result } = renderHook(() =>
      useGeoRegion({ country: '', isIndia: true })
    );
    expect(result.current.countryCode).toBeNull();
    expect(result.current.isIndia).toBe(true);
  });
});

// ─── Fallback heuristic (navigator.language) ─────────────────────────────────

describe('useGeoRegion – navigator.language fallback', () => {
  it('detects India from "en-IN" locale', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-IN');
    const { result } = renderHook(() => useGeoRegion());
    expect(result.current.countryCode).toBe('IN');
    expect(result.current.isIndia).toBe(true);
  });

  it('detects India from "hi-IN" locale', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('hi-IN');
    const { result } = renderHook(() => useGeoRegion());
    expect(result.current.countryCode).toBe('IN');
    expect(result.current.isIndia).toBe(true);
  });

  it('detects India from "hi" locale (no region subtag)', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('hi');
    const { result } = renderHook(() => useGeoRegion());
    expect(result.current.countryCode).toBe('IN');
    expect(result.current.isIndia).toBe(true);
  });

  it('detects non-India from "en-US" locale', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    const { result } = renderHook(() => useGeoRegion());
    expect(result.current.countryCode).toBe('US');
    expect(result.current.isIndia).toBe(false);
  });

  it('detects non-India from "fr-FR" locale', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
    const { result } = renderHook(() => useGeoRegion());
    expect(result.current.countryCode).toBe('FR');
    expect(result.current.isIndia).toBe(false);
  });

  it('handles locale with no region subtag (non-Hindi)', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en');
    const { result } = renderHook(() => useGeoRegion());
    expect(result.current.countryCode).toBeNull();
    expect(result.current.isIndia).toBe(false);
  });
});

// ─── Dismiss state (localStorage) ────────────────────────────────────────────

describe('useGeoRegion – dismiss persistence', () => {
  it('starts not dismissed when localStorage is empty', () => {
    const { result } = renderHook(() =>
      useGeoRegion({ country: 'US', isIndia: false })
    );
    expect(result.current.dismissed).toBe(false);
  });

  it('reads existing dismissed state from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() =>
      useGeoRegion({ country: 'US', isIndia: false })
    );
    expect(result.current.dismissed).toBe(true);
  });

  it('dismiss() updates state and persists to localStorage', () => {
    const { result } = renderHook(() =>
      useGeoRegion({ country: 'US', isIndia: false })
    );
    expect(result.current.dismissed).toBe(false);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.dismissed).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('handles localStorage.getItem throwing (private browsing)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied');
    });

    const { result } = renderHook(() =>
      useGeoRegion({ country: 'GB', isIndia: false })
    );
    // Should default to not dismissed
    expect(result.current.dismissed).toBe(false);
  });

  it('handles localStorage.setItem throwing (quota exceeded)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const { result } = renderHook(() =>
      useGeoRegion({ country: 'GB', isIndia: false })
    );

    // dismiss() should not throw
    act(() => {
      result.current.dismiss();
    });

    // State still updates in memory
    expect(result.current.dismissed).toBe(true);
  });
});

// ─── Null / undefined geo argument ───────────────────────────────────────────

describe('useGeoRegion – null/undefined geo', () => {
  it('uses fallback when geo is null', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    const { result } = renderHook(() => useGeoRegion(null));
    expect(result.current.countryCode).toBe('US');
    expect(result.current.isIndia).toBe(false);
  });

  it('uses fallback when geo is undefined', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('hi-IN');
    const { result } = renderHook(() => useGeoRegion(undefined));
    expect(result.current.countryCode).toBe('IN');
    expect(result.current.isIndia).toBe(true);
  });
});
