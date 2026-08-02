import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import type { HomeFeedProduct } from '../types/homeFeed';

/** Popular queries to show on homepage — rotated randomly */
const TRENDING_QUERIES = [
  'kurta set', 'sneakers', 'jeans', 'saree', 'hoodie', 'dress', 'lehenga', 'shirt',
];

export interface UseHomeFeedResult {
  products: HomeFeedProduct[];
  loading: boolean;
  source: 'deals' | 'trending' | 'seed';
  error: string | null;
  geo: { country: string; isIndia: boolean };
}

/** Pick a random trending query */
function getRandomQuery(): string {
  return TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
}

/**
 * Hook to fetch real products for the homepage.
 * 
 * Strategy: Directly calls POST /api/search/product (which scrapes live or returns cached results).
 * This is the SAME endpoint that works when users search manually.
 * No intermediate feed API, no cron dependency, no seed data.
 */
export function useHomeFeed(category: string): UseHomeFeedResult {
  const [products, setProducts] = useState<HomeFeedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'deals' | 'trending' | 'seed'>('trending');
  const [error, setError] = useState<string | null>(null);
  const [geo] = useState<{ country: string; isIndia: boolean }>({
    country: 'IN',
    isIndia: true,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    // Use category as search query, or pick a random trending term
    const searchQuery = category || getRandomQuery();

    api.post('/search/product', 
      { query: searchQuery },
      { signal: controller.signal, timeout: 30000 }
    )
    .then(({ data }) => {
      if (controller.signal.aborted) return;

      // The search API returns results in various shapes depending on version
      const rawResults = data?.results || data?.products || data?.canonicals || [];
      
      if (rawResults.length === 0) {
        setProducts([]);
        setSource('seed');
        setError('No products found');
        setLoading(false);
        return;
      }

      // Map search results to HomeFeedProduct format
      // Handle both flat SearchProduct[] and CanonicalProduct[] (with .offers)
      const mapped: HomeFeedProduct[] = rawResults.slice(0, 24).map((item: any, i: number) => {
        // If it's a CanonicalProduct (has .offers array)
        if (item.offers && item.offers.length > 0) {
          const cheapest = item.offers.reduce((min: any, o: any) => 
            (o.price > 0 && o.price < (min.price || Infinity)) ? o : min, item.offers[0]);
          const price = cheapest.price || 0;
          const originalPrice = cheapest.originalPrice || 0;
          const discount = originalPrice > price
            ? Math.round((originalPrice - price) / originalPrice * 100)
            : (cheapest.discount || 0);
          return {
            id: item.id || `hp_${i}`,
            title: item.title || cheapest.title || '',
            brand: item.brand || undefined,
            imageUrl: cheapest.imageUrl || '',
            price,
            originalPrice: originalPrice > price ? originalPrice : undefined,
            discount,
            savings: originalPrice - price > 200 ? originalPrice - price : undefined,
            platform: cheapest.platform || 'Unknown',
            url: cheapest.affiliateUrl || cheapest.productUrl || '',
          };
        }

        // If it's a flat SearchProduct (direct fields)
        const price = item.price || 0;
        const originalPrice = item.originalPrice || 0;
        const discount = item.discount || (originalPrice > price
          ? Math.round((originalPrice - price) / originalPrice * 100) : 0);
        return {
          id: item.id || `hp_${i}`,
          title: item.title || '',
          brand: item.brand || undefined,
          imageUrl: item.imageUrl || '',
          price,
          originalPrice: originalPrice > price ? originalPrice : undefined,
          discount,
          savings: originalPrice - price > 200 ? originalPrice - price : undefined,
          platform: item.platform || 'Unknown',
          url: item.url || '',
        };
      }).filter((p: HomeFeedProduct) => p.price > 0 && p.title && p.imageUrl);

      setProducts(mapped);
      setSource('trending');
      setLoading(false);
    })
    .catch((err) => {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      setProducts([]);
      setSource('seed');
      setError(err?.message || 'Failed to load');
      setLoading(false);
    });

    return () => { controller.abort(); };
  }, [category]);

  return { products, loading, source, error, geo };
}
