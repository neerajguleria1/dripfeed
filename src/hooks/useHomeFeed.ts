import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { SEED_PRODUCTS } from '../../api/_lib/seed-data';
import { mapSeedToHomeFeed } from '../../api/_lib/mappers/homeFeed';
import type { HomeFeedProduct, HomeFeedResponse } from '../types/homeFeed';

/** Timeout in ms before showing error state (increased for live scraper which can take 10-15s) */
const FEED_TIMEOUT_MS = 20_000;

export interface UseHomeFeedResult {
  products: HomeFeedProduct[];
  loading: boolean;
  source: 'deals' | 'trending' | 'seed';
  error: string | null;
  geo: { country: string; isIndia: boolean };
}

/** Maps seed products to HomeFeedProduct[] for client-side fallback */
function getSeedFallback(): HomeFeedProduct[] {
  return SEED_PRODUCTS.map(mapSeedToHomeFeed);
}

/**
 * Hook to fetch the home feed products for a given category.
 * Falls back to seed products on error or if the request takes longer than 5 seconds.
 *
 * @param category - Category filter string (e.g. "trending", "kurta-sets", or "" for all)
 * @returns Object with products, loading state, source indicator, error, and geo info
 *
 * Requirements validated: 2.4, 2.5, 2.6, 5.6, 8.2
 */
export function useHomeFeed(category: string): UseHomeFeedResult {
  const [products, setProducts] = useState<HomeFeedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'deals' | 'trending' | 'seed'>('seed');
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ country: string; isIndia: boolean }>({
    country: 'IN',
    isIndia: true,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Abort any in-flight request from a previous render
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const settle = () => {
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const fallbackToSeed = async (errorMsg: string) => {
      if (settled) return;
      // Try live search API as client-side fallback before using seed data
      try {
        const searchQuery = category || 'trending fashion';
        const { data } = await api.post('/search/product', { query: searchQuery });
        const results = data?.results || data?.products || [];
        if (results.length >= 4) {
          settle();
          const mapped: HomeFeedProduct[] = results.slice(0, 12).map((p: any) => ({
            id: p.id || `search_${Math.random().toString(36).slice(2, 8)}`,
            title: p.title || '',
            brand: p.brand,
            imageUrl: p.imageUrl,
            price: p.price || 0,
            originalPrice: p.originalPrice,
            discount: p.discount || (p.originalPrice && p.originalPrice > p.price
              ? Math.round((p.originalPrice - p.price) / p.originalPrice * 100)
              : 0),
            savings: p.originalPrice && p.originalPrice - p.price > 200
              ? p.originalPrice - p.price : undefined,
            platform: p.platform || 'Unknown',
            url: p.url,
          }));
          setProducts(mapped);
          setSource('trending');
          setError(null);
          setLoading(false);
          return;
        }
      } catch {
        // Fall through to seed
      }
      settle();
      setProducts(getSeedFallback());
      setSource('seed');
      setError(errorMsg);
      setLoading(false);
    };

    // Start timeout: if request hasn't completed in 5s, use seed fallback
    timeoutId = setTimeout(() => {
      if (!settled) {
        controller.abort();
        fallbackToSeed('Request timed out');
      }
    }, FEED_TIMEOUT_MS);

    setLoading(true);
    setError(null);

    const params: Record<string, string> = {};
    if (category) params.category = category;

    api
      .get<HomeFeedResponse>('/feed/home', {
        params,
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (settled || controller.signal.aborted) return;
        settle();
        setProducts(data.products);
        setSource(data.source);
        setGeo(data.geo);
        setLoading(false);
      })
      .catch((err) => {
        // Ignore aborts triggered by cleanup or timeout (already handled)
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') {
          if (!settled) fallbackToSeed('Request aborted');
          return;
        }
        fallbackToSeed(err?.message || 'Failed to fetch home feed');
      });

    // Cleanup: abort on unmount or category change
    return () => {
      settle();
      controller.abort();
    };
  }, [category]);

  return { products, loading, source, error, geo };
}
