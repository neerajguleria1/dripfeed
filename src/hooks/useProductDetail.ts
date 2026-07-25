import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import type { CanonicalProductData } from '../types/product';

export type ProductDetailStatus = 'idle' | 'loading' | 'success' | 'not-found' | 'error';

export interface UseProductDetailResult {
  product: CanonicalProductData | null;
  similar: CanonicalProductData[];
  query: string;
  status: ProductDetailStatus;
  fetch: (canonicalId: string) => void;
}

// Exported for test reset only
export const _cache = new Map<string, { product: CanonicalProductData; similar: CanonicalProductData[]; query: string }>();

export function useProductDetail(): UseProductDetailResult {
  const [product, setProduct] = useState<CanonicalProductData | null>(null);
  const [similar, setSimilar] = useState<CanonicalProductData[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ProductDetailStatus>('idle');
  const currentId = useRef('');

  const fetch = useCallback(async (canonicalId: string) => {
    if (!canonicalId) return;
    currentId.current = canonicalId;

    const cached = _cache.get(canonicalId);
    if (cached) {
      setProduct(cached.product);
      setSimilar(cached.similar);
      setQuery(cached.query);
      setStatus('success');
      return;
    }

    setStatus('loading');
    setProduct(null);
    setSimilar([]);
    setQuery('');

    try {
      const { data } = await api.get(`/product/${canonicalId}`);
      if (currentId.current !== canonicalId) return;

      if (!data?.product) {
        setStatus('not-found');
        return;
      }

      const result = {
        product: data.product as CanonicalProductData,
        similar: (data.similar ?? []) as CanonicalProductData[],
        query: data.query ?? '',
      };
      _cache.set(canonicalId, result);
      setProduct(result.product);
      setSimilar(result.similar);
      setQuery(result.query);
      setStatus('success');
    } catch (err: any) {
      if (currentId.current !== canonicalId) return;
      if (err?.response?.status === 404) {
        setStatus('not-found');
      } else {
        setStatus('error');
      }
    }
  }, []);

  return { product, similar, query, status, fetch };
}
