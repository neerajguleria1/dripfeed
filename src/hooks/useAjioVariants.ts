import { useState, useCallback } from 'react';
import api from '../services/api';
import type { AjioProductVariants } from '../../api/_lib/types/productVariant';

type Status = 'idle' | 'loading' | 'done' | 'error';

interface UseAjioVariantsResult {
  variants: AjioProductVariants | null;
  status: Status;
  fetch: (productId: string) => void;
}

export function useAjioVariants(): UseAjioVariantsResult {
  const [variants, setVariants] = useState<AjioProductVariants | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const fetch = useCallback((productId: string) => {
    if (!productId) return;
    setStatus('loading');
    setVariants(null);
    api
      .get('/variants', { params: { platform: 'ajio', productId } })
      .then(({ data }) => {
        setVariants(data as AjioProductVariants);
        setStatus('done');
      })
      .catch(() => {
        setStatus('error');
      });
  }, []);

  return { variants, status, fetch };
}
