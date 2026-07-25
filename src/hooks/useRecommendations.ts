import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import type { CanonicalProductData } from '../types/product';

export type RecommendationType =
  | 'similar'
  | 'better_deal'
  | 'popular'
  | 'price_dropped'
  | 'premium'
  | 'budget';

export interface ScoredProduct {
  product: CanonicalProductData;
  score: number;
  type: RecommendationType;
  reason: string;
}

export interface RecommendationSet {
  similar:      ScoredProduct[];
  betterDeal:   ScoredProduct[];
  popular:      ScoredProduct[];
  priceDropped: ScoredProduct[];
  premium:      ScoredProduct[];
  budget:       ScoredProduct[];
}

export type RecommendationStatus = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export interface UseRecommendationsResult {
  data: RecommendationSet | null;
  status: RecommendationStatus;
  fetch: (canonicalId: string) => void;
}

const EMPTY_SET: RecommendationSet = {
  similar: [], betterDeal: [], popular: [], priceDropped: [], premium: [], budget: [],
};

function isEmpty(set: RecommendationSet): boolean {
  return Object.values(set).every(arr => arr.length === 0);
}

// Exported for test reset
export const _recCache = new Map<string, RecommendationSet>();

export function useRecommendations(): UseRecommendationsResult {
  const [data, setData] = useState<RecommendationSet | null>(null);
  const [status, setStatus] = useState<RecommendationStatus>('idle');
  const currentId = useRef('');

  const fetch = useCallback(async (canonicalId: string) => {
    if (!canonicalId) return;
    currentId.current = canonicalId;

    const cached = _recCache.get(canonicalId);
    if (cached) {
      setData(cached);
      setStatus(isEmpty(cached) ? 'empty' : 'success');
      return;
    }

    setStatus('loading');
    setData(null);

    try {
      const { data: res } = await api.get(`/recommendations/${canonicalId}`);
      if (currentId.current !== canonicalId) return;

      const set: RecommendationSet = {
        similar:      res.similar      ?? [],
        betterDeal:   res.betterDeal   ?? [],
        popular:      res.popular      ?? [],
        priceDropped: res.priceDropped ?? [],
        premium:      res.premium      ?? [],
        budget:       res.budget       ?? [],
      };

      _recCache.set(canonicalId, set);
      setData(set);
      setStatus(isEmpty(set) ? 'empty' : 'success');
    } catch {
      if (currentId.current === canonicalId) setStatus('error');
    }
  }, []);

  return { data, status, fetch };
}
