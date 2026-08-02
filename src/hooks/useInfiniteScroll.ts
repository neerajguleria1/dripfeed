import { useState, useRef, useEffect, useCallback, type RefObject } from 'react';

/**
 * Options for the useInfiniteScroll hook.
 */
export interface UseInfiniteScrollOptions {
  /** Pixels from bottom to trigger prefetch (default: 500) */
  threshold: number;
  /** Number of products to fetch per batch (default: 20) */
  batchSize: number;
  /** Maximum consecutive retry attempts before persistent error (default: 3) */
  maxRetries: number;
  /** Timeout in milliseconds per batch fetch (default: 10000) */
  timeout: number;
  /** Fetch function that receives the current offset and returns products + hasMore flag */
  fetchFn: (offset: number) => Promise<{ products: unknown[]; hasMore: boolean }>;
}

/**
 * Return type for the useInfiniteScroll hook.
 */
export interface UseInfiniteScrollResult {
  /** Ref to attach to the sentinel element at the bottom of the list */
  triggerRef: RefObject<HTMLDivElement>;
  /** Whether a batch fetch is currently in progress */
  loading: boolean;
  /** Whether more content is available to load */
  hasMore: boolean;
  /** Error message if a fetch failed, null otherwise */
  error: string | null;
  /** Number of consecutive failed fetch attempts */
  retryCount: number;
  /** Manually retry the last failed fetch — resets error and retries */
  retry: () => void;
}

/**
 * Infinite scroll hook using IntersectionObserver with prefetch support.
 *
 * Triggers fetching when the sentinel element comes within `threshold` pixels
 * of the viewport. Implements timeout, retry logic, and persistent error state.
 *
 * Requirements: 5.2 (500px trigger), 5.5 (scroll position preserved),
 *              5.6 (max 3 retries), 5.8 (10s timeout)
 */
export function useInfiniteScroll(options: UseInfiniteScrollOptions): UseInfiniteScrollResult {
  const { threshold, maxRetries, timeout, fetchFn } = options;

  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const triggerRef = useRef<HTMLDivElement>(null!);
  const offsetRef = useRef(0);
  const fetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const persistentErrorRef = useRef(false);

  /**
   * Core fetch logic — fetches the next batch at the current offset.
   * Applies timeout and updates state accordingly.
   */
  const fetchBatch = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchingRef.current || persistentErrorRef.current) return;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    // Abort any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Create a timeout race
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const result = await Promise.race<{ products: unknown[]; hasMore: boolean }>([
        fetchFn(offsetRef.current),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('TIMEOUT'));
          });
        }),
      ]);

      clearTimeout(timeoutId);

      // If aborted externally (e.g., unmount), bail out
      if (controller.signal.aborted) return;

      // Success — reset retry count, advance offset
      setRetryCount(0);
      offsetRef.current += result.products.length;
      setHasMore(result.hasMore);
      setError(null);
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      const errMsg = err instanceof Error ? err.message : '';

      // Don't update state if aborted externally (unmount)
      if (controller.signal.aborted && errMsg !== 'TIMEOUT') return;

      const isTimeout = errMsg === 'TIMEOUT';
      const errorMessage = isTimeout
        ? 'Request timed out. Please check your connection and try again.'
        : 'Network error occurred. Please try again.';

      setRetryCount((prev) => {
        const next = prev + 1;
        if (next >= maxRetries) {
          persistentErrorRef.current = true;
          setHasMore(false);
        }
        return next;
      });

      setError(errorMessage);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [fetchFn, timeout, maxRetries]);

  /**
   * Manual retry — resets error state and retries the last failed fetch.
   * Does NOT reset offset (preserves scroll position / existing content).
   */
  const retry = useCallback(() => {
    if (persistentErrorRef.current) {
      // Allow retry from persistent error — reset persistent flag but keep retryCount
      persistentErrorRef.current = false;
      setRetryCount(0);
      setHasMore(true);
    }
    setError(null);
    fetchBatch();
  }, [fetchBatch]);

  // IntersectionObserver setup — triggers fetch when sentinel is within rootMargin
  useEffect(() => {
    const node = triggerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry?.isIntersecting &&
          hasMore &&
          !fetchingRef.current &&
          !persistentErrorRef.current &&
          !error
        ) {
          fetchBatch();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, error, threshold, fetchBatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    triggerRef,
    loading,
    hasMore,
    error,
    retryCount,
    retry,
  };
}
