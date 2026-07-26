import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  paramsToFilters,
  filtersToParams,
  type FilterState,
} from '../types/filters';

export interface UseFilterStateResult {
  filters: FilterState;
  query: string;
  setFilters: (next: FilterState, opts?: { replace?: boolean }) => void;
  setSort: (sort: FilterState['sort']) => void;
  resetFilters: () => void;
  setQuery: (q: string) => void;
}

/**
 * Single hook that owns all URL state for the search page.
 *
 * Filter changes use `replace: true` so toggling a chip doesn't pollute
 * browser history. A new search query uses `replace: false` (default) so
 * the user can press Back to return to the previous query.
 */
export function useFilterState(): UseFilterStateResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') || '';

  const filters = useMemo(
    () => paramsToFilters(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.toString()],
  );

  const setFilters = useCallback(
    (next: FilterState, opts: { replace?: boolean } = {}) => {
      setSearchParams(
        params => {
          const updated = new URLSearchParams(params);
          // Remove all filter keys first
          for (const key of [
            'platforms', 'brands', 'colors', 'sizes',
            'pricePreset', 'priceMin', 'priceMax',
            'minDiscount', 'minRating', 'inStock', 'sort',
          ]) {
            updated.delete(key);
          }
          // Write non-default values
          const serialised = filtersToParams(next);
          for (const [k, v] of Object.entries(serialised)) {
            updated.set(k, v);
          }
          return updated;
        },
        { replace: opts.replace ?? true },
      );
    },
    [setSearchParams],
  );

  const setSort = useCallback(
    (sort: FilterState['sort']) => {
      setFilters({ ...filters, sort }, { replace: true });
    },
    [filters, setFilters],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      params => {
        const updated = new URLSearchParams();
        if (params.get('q')) updated.set('q', params.get('q')!);
        return updated;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const setQuery = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setSearchParams(
        params => {
          // New query: keep sort if set, drop all other filters
          const updated = new URLSearchParams();
          updated.set('q', trimmed);
          const sort = params.get('sort');
          if (sort) updated.set('sort', sort);
          return updated;
        },
        { replace: false }, // push — user can go Back to previous query
      );
    },
    [setSearchParams],
  );

  return { filters, query, setFilters, setSort, resetFilters, setQuery };
}
