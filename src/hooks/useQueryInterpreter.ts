/**
 * useQueryInterpreter.ts
 *
 * Calls POST /api/search/interpret and returns structured filter data.
 * Module-level LRU-style cache (Map) to avoid re-interpreting the same query
 * within a session.
 *
 * Usage:
 *   const { result, status, interpret } = useQueryInterpreter();
 *   interpret('black oversized hoodie under 2000');
 */

import { useState, useCallback } from 'react';
import api from '../services/api';
import type { FilterChip, ParsedQuery } from '../types/queryInterpreter';

export type InterpretStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseQueryInterpreterResult {
  result:    (ParsedQuery & { chips: FilterChip[] }) | null;
  status:    InterpretStatus;
  interpret: (query: string) => Promise<void>;
  reset:     () => void;
}

// Module-level session cache (survives component re-mounts)
const _sessionCache = new Map<string, ParsedQuery & { chips: FilterChip[] }>();

export function _clearInterpreterSessionCache() { _sessionCache.clear(); }
export { _sessionCache };

export function useQueryInterpreter(): UseQueryInterpreterResult {
  const [result, setResult]   = useState<(ParsedQuery & { chips: FilterChip[] }) | null>(null);
  const [status, setStatus]   = useState<InterpretStatus>('idle');

  const interpret = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResult(null);
      setStatus('idle');
      return;
    }

    // Cache hit
    const cached = _sessionCache.get(trimmed.toLowerCase());
    if (cached) {
      setResult({ ...cached, cached: true });
      setStatus('success');
      return;
    }

    setStatus('loading');
    try {
      const { data } = await api.post<ParsedQuery & { chips: FilterChip[] }>(
        '/search/interpret',
        { query: trimmed },
      );
      _sessionCache.set(trimmed.toLowerCase(), data);
      setResult(data);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setStatus('idle');
  }, []);

  return { result, status, interpret, reset };
}
