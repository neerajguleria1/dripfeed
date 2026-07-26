/**
 * usePricePrediction.ts
 *
 * Fetches the price prediction for a canonical product.
 * Results cached in module-level memory keyed by `canonicalId::platform`.
 */

import { useState, useCallback, useRef } from 'react';
import api from '../services/api';

export type PredictionVerdict =
  | 'BUY_NOW'
  | 'WAIT'
  | 'LIKELY_TO_DROP'
  | 'LIKELY_TO_INCREASE'
  | 'UNKNOWN';

export interface SignalBreakdown {
  trendPctPerDay:    number;
  volatility:        number;
  meanReversion:     number;
  momentum7d:        number;
  positionInRange:   number;
  daysSinceLastDrop: number | null;
  hasActiveDeal:     boolean;
  dataPoints:        number;
}

export interface PricePrediction {
  verdict:             PredictionVerdict;
  confidence:          number;
  signals:             SignalBreakdown | null;
  reason:              string;
  estimatedChangePct?: number;
  generatedAt:         number;
  cached:              boolean;
}

export type PredictionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UsePricePredictionResult {
  prediction: PricePrediction | null;
  status:     PredictionStatus;
  fetch:      (canonicalId: string, platform?: string) => void;
}

const _moduleCache = new Map<string, PricePrediction>();

export function usePricePrediction(): UsePricePredictionResult {
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [status, setStatus]         = useState<PredictionStatus>('idle');
  const currentKey                  = useRef('');

  const fetch = useCallback(async (canonicalId: string, platform?: string) => {
    if (!canonicalId) return;
    const key = `${canonicalId}::${platform ?? 'all'}`;
    currentKey.current = key;

    const cached = _moduleCache.get(key);
    if (cached) {
      setPrediction({ ...cached, cached: true });
      setStatus('success');
      return;
    }

    setStatus('loading');

    try {
      const params: Record<string, string> = {};
      if (platform) params.platform = platform;

      const { data } = await api.get<PricePrediction>(
        `/price-prediction/${canonicalId}`,
        { params },
      );

      if (currentKey.current !== key) return;

      _moduleCache.set(key, data);
      setPrediction(data);
      setStatus('success');
    } catch {
      if (currentKey.current === key) setStatus('error');
    }
  }, []);

  return { prediction, status, fetch };
}

export { _moduleCache as _predictionModuleCache };
