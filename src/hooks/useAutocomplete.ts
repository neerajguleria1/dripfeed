import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';

export const RECENT_SEARCHES_KEY = 'tc_recent_searches';
export const MAX_RECENT_SEARCHES = 8;
export const DEBOUNCE_MS = 200;

export interface PopularSuggestion {
  query: string;
  count: number;
  matchType: 'exact' | 'prefix' | 'popular';
}

export interface ProductSuggestion {
  title: string;
  brand?: string;
  imageUrl?: string;
  platform: string;
  price: number;
}

export interface AutocompleteData {
  popular: PopularSuggestion[];
  products: ProductSuggestion[];
  brands: string[];
  categories: string[];
}

export type AutocompleteStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseAutocompleteResult {
  data: AutocompleteData | null;
  status: AutocompleteStatus;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  fetch: (q: string) => void;
  cancel: () => void;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRecentSearches(items: string[]): void {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES)));
  } catch { /* quota exceeded — non-fatal */ }
}

// ─── Module-level cache: key = normalised query ───────────────────────────────
const _autocompleteCache = new Map<string, AutocompleteData>();

/** Exported for test reset. */
export { _autocompleteCache };

export function useAutocomplete(): UseAutocompleteResult {
  const [data, setData] = useState<AutocompleteData | null>(null);
  const [status, setStatus] = useState<AutocompleteStatus>('idle');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());

  const currentQuery = useRef('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

  const fetchImmediate = useCallback(async (q: string) => {
    const norm = q.trim().toLowerCase();
    currentQuery.current = norm;

    const cached = _autocompleteCache.get(norm);
    if (cached) {
      setData(cached);
      setStatus('success');
      return;
    }

    setStatus('loading');

    try {
      const { data: result } = await api.get('/search/autocomplete', {
        params: q.trim() ? { q: q.trim() } : {},
      });

      if (currentQuery.current !== norm) return; // stale-response guard

      _autocompleteCache.set(norm, result);
      setData(result);
      setStatus('success');
    } catch {
      if (currentQuery.current === norm) setStatus('error');
    }
  }, []);

  const fetch = useCallback((q: string) => {
    cancel();
    debounceTimer.current = setTimeout(() => {
      fetchImmediate(q);
    }, DEBOUNCE_MS);
  }, [cancel, fetchImmediate]);

  const addRecentSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const deduped = [trimmed, ...prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase())];
      const next = deduped.slice(0, MAX_RECENT_SEARCHES);
      writeRecentSearches(next);
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch { /* non-fatal */ }
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  return { data, status, recentSearches, addRecentSearch, clearRecentSearches, fetch, cancel };
}
