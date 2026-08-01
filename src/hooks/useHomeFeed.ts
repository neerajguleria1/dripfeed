import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { SEED_PRODUCTS } from '../../api/_lib/seed-data';
import { mapSeedToHomeFeed } from '../../api/_lib/mappers/homeFeed';
import type { HomeFeedProduct, HomeFeedResponse } from '../types/homeFeed';

/** Timeout in ms — Vercel functions can take up to 10s on hobby plan */
const FEED_TIMEOUT_MS = 15_000;

/** Popular queries to cycle through for homepage content */
const TRENDING_QUERIES = [
  'kurta set', 'sneakers', 'jeans', 'saree', 'hoodie', 'dress', 'ethnic wear', 'lehenga',
];

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

/** Pick a random trending query */
function getRandomQuery(): string {
  return TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
}

/** Map search API results to HomeFeedProduct[] */
function mapSearchResults(results: any[]): HomeFeedProduct[] {
  return results.slice(0, 12).map((p: any) => ({
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
  })).filter((p: HomeFeedProduct) => p.price > 0 && p.title);
}

/**
 * Hook to fetch the home feed products.
 * Strategy:
 * 1. Try /api/feed/home (cached, fast)
 * 2. If it returns seed data or fails → call /api/search/product directly (live scrape)
 * 3. Final fallback → static seed data
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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let settled = false;
    const settle = () => { settled = true; };

    setLoading(true);
    setError(null);

    async function fetchFeed() {
      // ─── Step 1: Try the feed API ─────────────────────────────────────────
      try {
        const params: Record<string, string> = {};
        if (category) params.category = category;

        const { data } = await api.get<HomeFeedResponse>('/feed/home', {
          params,
          signal: controller.signal,
          timeout: FEED_TIMEOUT_MS,
        });

        if (controller.signal.aborted || settled) return;

        // If feed returned real data (not seed), use it
        if (data.source !== 'seed' && data.products.length >= 4) {
          settle();
          setProducts(data.products);
          setSource(data.source);
          setGeo(data.geo);
          setLoading(false);
          return;
        }

        // Feed returned seed data — try live search instead
        setGeo(data.geo);
      } catch {
        // Feed API failed — continue to search fallback
      }

      if (controller.signal.aborted || settled) return;

      // ─── Step 2: Call search API directly (live scrape) ────────────────────
      try {
        const searchQuery = category || getRandomQuery();
        const { data } = await api.post('/search/product', 
          { query: searchQuery },
          { signal: controller.signal, timeout: FEED_TIMEOUT_MS }
        );

        if (controller.signal.aborted || settled) return;

        const results = data?.results || data?.products || [];
        if (results.length >= 4) {
          settle();
          setProducts(mapSearchResults(results));
          setSource('trending');
          setLoading(false);
          return;
        }
      } catch {
        // Search also failed
      }

      if (controller.signal.aborted || settled) return;

      // ─── Step 3: Final fallback — seed data ───────────────────────────────
      settle();
      setProducts(getSeedFallback());
      setSource('seed');
      setError('Using cached product data');
      setLoading(false);
    }

    fetchFeed();

    return () => {
      settle();
      controller.abort();
    };
  }, [category]);

  return { products, loading, source, error, geo };
}
