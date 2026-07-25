import { useState, useCallback, useRef } from 'react';
import api from '../services/api';

export interface HistoryPoint {
  platform: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  fetchedAt: string;
  rating?: number;
}

export interface PriceStats {
  lowestPrice: number;
  highestPrice: number;
  latestPrice: number;
  firstSeen: string;
  lastUpdated: string;
}

export type HistoryStatus = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export interface UsePriceHistoryResult {
  points: HistoryPoint[];
  stats: PriceStats | null;
  status: HistoryStatus;
  days: 30 | 90;
  setDays: (d: 30 | 90) => void;
  platform: string | undefined;
  setPlatform: (p: string | undefined) => void;
  fetch: (canonicalId: string) => void;
}

/**
 * Lazy price history hook.
 *
 * Does NOT fetch on mount — caller must invoke fetch(canonicalId) explicitly,
 * typically when the user expands a product card or opens the history panel.
 * Results are cached per canonicalId+days+platform so re-expanding is instant.
 */
export function usePriceHistory(): UsePriceHistoryResult {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [status, setStatus] = useState<HistoryStatus>('idle');
  const [days, setDaysState] = useState<30 | 90>(30);
  const [platform, setPlatformState] = useState<string | undefined>(undefined);

  // Cache: "canonicalId::days::platform" → { points, stats }
  const cache = useRef<Map<string, { points: HistoryPoint[]; stats: PriceStats | null }>>(new Map());
  const currentId = useRef<string>('');

  const fetch = useCallback(async (canonicalId: string) => {
    if (!canonicalId) return;
    currentId.current = canonicalId;

    const cacheKey = `${canonicalId}::${days}::${platform ?? 'all'}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setPoints(cached.points);
      setStats(cached.stats);
      setStatus(cached.points.length === 0 ? 'empty' : 'success');
      return;
    }

    setStatus('loading');
    setPoints([]);
    setStats(null);

    try {
      const params: Record<string, string> = { days: String(days) };
      if (platform) params.platform = platform;

      const [historyRes, statsRes] = await Promise.all([
        api.get(`/price-history/${canonicalId}`, { params }),
        api.get(`/price-history/${canonicalId}/stats`, {
          params: platform ? { platform } : {},
        }),
      ]);

      // Guard against stale responses if canonicalId changed mid-flight
      if (currentId.current !== canonicalId) return;

      const fetchedPoints: HistoryPoint[] = historyRes.data?.points ?? [];
      const fetchedStats: PriceStats | null = statsRes.data?.lowestPrice != null
        ? {
            lowestPrice:  statsRes.data.lowestPrice,
            highestPrice: statsRes.data.highestPrice,
            latestPrice:  statsRes.data.latestPrice,
            firstSeen:    statsRes.data.firstSeen,
            lastUpdated:  statsRes.data.lastUpdated,
          }
        : null;

      cache.current.set(cacheKey, { points: fetchedPoints, stats: fetchedStats });
      setPoints(fetchedPoints);
      setStats(fetchedStats);
      setStatus(fetchedPoints.length === 0 ? 'empty' : 'success');
    } catch {
      if (currentId.current === canonicalId) setStatus('error');
    }
  }, [days, platform]);

  function setDays(d: 30 | 90) {
    setDaysState(d);
    // Invalidate displayed data so the next fetch() call re-fetches
    setStatus('idle');
    setPoints([]);
    setStats(null);
  }

  function setPlatform(p: string | undefined) {
    setPlatformState(p);
    setStatus('idle');
    setPoints([]);
    setStats(null);
  }

  return { points, stats, status, days, setDays, platform, setPlatform, fetch };
}
