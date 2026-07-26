import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import type { ProductData } from '../types/product';

export type TrendingWindow = '24h' | '7d' | '30d';
export type TrendingStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface UseTrendingResult {
  products: ProductData[];
  status: TrendingStatus;
  window: TrendingWindow;
  fetch: (window?: TrendingWindow, category?: string) => void;
}

/** Module-level cache: key = `${window}:${category}` */
const _trendingCache = new Map<string, ProductData[]>();

/** Exported for test reset. */
export { _trendingCache };

/**
 * Maps a TrendingProduct (API shape) to ProductData (UI shape).
 * The trending endpoint returns canonicalId + productTitle + platform.
 * We synthesise a minimal ProductData so existing ProductCard works.
 */
function mapTrendingItem(item: any): ProductData {
  return {
    id:       item.canonicalId,
    title:    item.productTitle ?? '',
    brand:    item.brand,
    imageUrl: item.imageUrl,
    price:    item.price ?? 0,
    originalPrice: item.originalPrice,
    discount: item.discount,
    platform: item.platform ?? '',
    url:      item.url ?? '',
  };
}

export function useTrending(): UseTrendingResult {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [status, setStatus] = useState<TrendingStatus>('idle');
  const [currentWindow, setCurrentWindow] = useState<TrendingWindow>('7d');
  const currentKey = useRef('');

  const fetch = useCallback(async (window: TrendingWindow = '7d', category?: string) => {
    const key = `${window}:${category ?? ''}`;
    currentKey.current = key;
    setCurrentWindow(window);

    const cached = _trendingCache.get(key);
    if (cached) {
      setProducts(cached);
      setStatus(cached.length ? 'success' : 'empty');
      return;
    }

    setStatus('loading');
    setProducts([]);

    try {
      const params: Record<string, string> = { window };
      if (category) params.category = category;
      const { data } = await api.get('/products/trending', { params });

      if (currentKey.current !== key) return; // stale response guard

      const list: ProductData[] = (data.products ?? []).map(mapTrendingItem);
      _trendingCache.set(key, list);
      setProducts(list);
      setStatus(list.length ? 'success' : 'empty');
    } catch {
      if (currentKey.current === key) setStatus('error');
    }
  }, []);

  return { products, status, window: currentWindow, fetch };
}
