import { useState, useCallback } from 'react';
import api from '../services/api';
import type { ProductVariants } from '../../api/_lib/types/productVariant';

type Status = 'idle' | 'loading' | 'done' | 'error';

interface UseProductVariantsResult {
  variants: ProductVariants | null;
  status: Status;
  fetch: (platform: string, productId: string) => void;
}

export function useProductVariants(): UseProductVariantsResult {
  const [variants, setVariants] = useState<ProductVariants | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const fetch = useCallback((platform: string, productId: string) => {
    if (!platform || !productId) return;
    setStatus('loading');
    setVariants(null);
    api
      .get('/variants', { params: { platform, productId } })
      .then(({ data }) => {
        setVariants(data as ProductVariants);
        setStatus('done');
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  return { variants, status, fetch };
}
