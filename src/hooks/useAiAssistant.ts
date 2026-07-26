/**
 * useAiAssistant.ts
 *
 * Fetches and caches the AI Shopping Assistant response for a canonical product.
 * Responses are cached in module-level memory — keyed by canonicalId —
 * so navigating back to a product detail page is instant.
 */

import { useState, useCallback, useRef } from 'react';
import api from '../services/api';

export interface AssistantInsight {
  question:   string;
  answer:     string;
  evidence:   string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AssistantBestValue {
  title:    string;
  price:    number;
  platform: string;
  reason:   string;
}

export interface AssistantResponse {
  verdict:      'buy_now' | 'wait' | 'consider_alternative' | 'good_deal' | 'overpriced';
  summary:      string;
  insights:     AssistantInsight[];
  bestRetailer: string;
  bestValue?:   AssistantBestValue;
  generatedAt:  number;
  provider:     string;
  cached:       boolean;
}

export type AssistantStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAiAssistantResult {
  response:  AssistantResponse | null;
  status:    AssistantStatus;
  error:     string | null;
  fetch:     (canonicalId: string) => Promise<void>;
  regenerate:(canonicalId: string) => Promise<void>;
}

// Module-level cache: canonicalId → response
// This persists for the lifetime of the browser tab — prevents re-fetching
// when the user collapses and re-expands the assistant card.
const _moduleCache = new Map<string, AssistantResponse>();

export function useAiAssistant(): UseAiAssistantResult {
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [status, setStatus]     = useState<AssistantStatus>('idle');
  const [error, setError]       = useState<string | null>(null);
  const currentId               = useRef('');

  const doFetch = useCallback(async (canonicalId: string, bust = false) => {
    if (!canonicalId) return;
    currentId.current = canonicalId;

    if (!bust) {
      const cached = _moduleCache.get(canonicalId);
      if (cached) {
        setResponse(cached);
        setStatus('success');
        setError(null);
        return;
      }
    }

    setStatus('loading');
    setError(null);

    try {
      const { data } = await api.post<AssistantResponse>(`/assistant/${canonicalId}`, {});

      if (currentId.current !== canonicalId) return; // stale

      _moduleCache.set(canonicalId, data);
      setResponse(data);
      setStatus('success');
    } catch (e: any) {
      if (currentId.current !== canonicalId) return;
      const msg = e?.response?.data?.error ?? e?.message ?? 'Failed to load assistant';
      setError(msg);
      setStatus('error');
    }
  }, []);

  const fetch      = useCallback((id: string) => doFetch(id, false), [doFetch]);
  const regenerate = useCallback((id: string) => {
    _moduleCache.delete(id);
    return doFetch(id, true);
  }, [doFetch]);

  return { response, status, error, fetch, regenerate };
}

/** Exported for test reset only */
export { _moduleCache };
