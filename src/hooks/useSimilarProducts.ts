import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import type { CanonicalProductData } from '../types/product';

export type SimilarStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface UseSimilarProductsResult {
  products: CanonicalProductData[];
  status: SimilarStatus;
  fetch: (canonicalId: string) => void;
}

/** Module-level LRU-style cache — mirrors _recCache in useRecommendations. Exported for test reset. */
export const _similarCache = new Map<string, CanonicalProductData[]>();

export function useSimilarProducts(): UseSimilarProductsResult {
  const [products, setProducts] = useState<CanonicalProductData[]>([]);
  const [status, setStatus] = useState<SimilarStatus>('idle');
  const currentId = useRef('');

  const fetch = useCallback(async (canonicalId: string) => {
    if (!canonicalId) return;
    currentId.current = canonicalId;

    const cached = _similarCache.get(canonicalId);
    if (cached) {
      setProducts(cached);
      setStatus(cached.length ? 'success' : 'empty');
      return;
    }

    setStatus('loading');
    setProducts([]);

    try {
      const { data } = await api.get(`/product/${canonicalId}/similar`);
      if (currentId.current !== canonicalId) return;

      const list: CanonicalProductData[] = data.products ?? [];
      _similarCache.set(canonicalId, list);
      setProducts(list);
      setStatus(list.length ? 'success' : 'empty');
    } catch {
      if (currentId.current === canonicalId) setStatus('error');
    }
  }, []);

  return { products, status, fetch };
}
