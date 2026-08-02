import { useState, useEffect, useRef, useCallback } from 'react';
import { validateProduct, type ValidatedProduct } from '../utils/validateProduct';

/** Platforms tracked by the progressive search */
const PLATFORMS = ['flipkart', 'myntra', 'amazon', 'meesho', 'ajio'] as const;

export interface PlatformStatus {
  name: string;
  status: 'pending' | 'loaded' | 'error';
}

export interface UseProgressiveSearchResult {
  results: ValidatedProduct[];
  loading: boolean;
  platforms: PlatformStatus[];
  isStale: boolean;
}

/**
 * Progressive search hook that opens an SSE (EventSource) connection
 * to `/api/search/product/stream?q=...` and incrementally populates
 * results as each platform responds.
 *
 * Key behaviors:
 * - Debounces query changes by 300ms
 * - Only triggers when query length >= 2 characters
 * - Deduplicates products by id
 * - Validates all incoming products via validateProduct()
 * - Tracks per-platform loading status
 * - Sets isStale when serving cached data older than 30 minutes
 * - Cleans up EventSource on unmount or query change
 */
export function useProgressiveSearch(query: string): UseProgressiveSearchResult {
  const [results, setResults] = useState<ValidatedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [platforms, setPlatforms] = useState<PlatformStatus[]>(
    PLATFORMS.map((name) => ({ name, status: 'pending' }))
  );
  const [isStale, setIsStale] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  /** Close existing EventSource connection and clean up */
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  /** Reset state for a new search */
  const resetState = useCallback(() => {
    setResults([]);
    setIsStale(false);
    seenIdsRef.current = new Set();
    setPlatforms(PLATFORMS.map((name) => ({ name, status: 'pending' })));
  }, []);

  useEffect(() => {
    // Clear previous debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // Close existing connection on query change
    closeConnection();

    // If query is too short, return empty results
    if (!query || query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state on invalid input is intentional
      setResults([]);
      setLoading(false);
      setIsStale(false);
      setPlatforms(PLATFORMS.map((name) => ({ name, status: 'pending' })));
      return;
    }

    // Set loading immediately for UI feedback
    setLoading(true);

    // Debounce by 300ms before opening connection
    debounceRef.current = setTimeout(() => {
      resetState();
      setLoading(true);

      const encodedQuery = encodeURIComponent(query.trim());
      const url = `/api/search/product/stream?q=${encodedQuery}`;

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Handle platform_products events
      eventSource.addEventListener('platform_products', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const platformName: string = data.platform || '';
          const rawProducts: unknown[] = data.products || [];

          // Check if this is stale cached data
          if (platformName.toLowerCase() === 'cache') {
            setIsStale(true);
          }

          // Validate and deduplicate incoming products
          const validProducts: ValidatedProduct[] = [];
          for (const raw of rawProducts) {
            const validated = validateProduct(raw);
            if (validated && !seenIdsRef.current.has(validated.id)) {
              seenIdsRef.current.add(validated.id);
              validProducts.push(validated);
            }
          }

          // Append new valid products to results
          if (validProducts.length > 0) {
            setResults((prev) => [...prev, ...validProducts]);
          }

          // Update platform status to 'loaded'
          if (platformName && platformName.toLowerCase() !== 'cache') {
            setPlatforms((prev) =>
              prev.map((p) =>
                p.name.toLowerCase() === platformName.toLowerCase()
                  ? { ...p, status: 'loaded' }
                  : p
              )
            );
          }
        } catch {
          // Silently ignore malformed events
        }
      });

      // Handle done event — all platforms finished
      eventSource.addEventListener('done', () => {
        setLoading(false);
        // Mark any remaining pending platforms as loaded
        setPlatforms((prev) =>
          prev.map((p) => (p.status === 'pending' ? { ...p, status: 'loaded' } : p))
        );
        closeConnection();
      });

      // Handle error events
      eventSource.addEventListener('error', () => {
        setLoading(false);
        // Mark remaining pending platforms as error
        setPlatforms((prev) =>
          prev.map((p) => (p.status === 'pending' ? { ...p, status: 'error' } : p))
        );
        closeConnection();
      });

      // Handle native EventSource error (connection failure)
      eventSource.onerror = () => {
        setLoading(false);
        setPlatforms((prev) =>
          prev.map((p) => (p.status === 'pending' ? { ...p, status: 'error' } : p))
        );
        closeConnection();
      };
    }, 300);

    // Cleanup on unmount or query change
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      closeConnection();
    };
  }, [query, closeConnection, resetState]);

  return { results, loading, platforms, isStale };
}
