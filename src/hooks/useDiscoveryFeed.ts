import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import type { FeedSection, DiscoverFeedResponse } from '../types/homeFeed';

const MAX_PAGES = 5;
const MAX_PRODUCTS = 60;

export interface UseDiscoveryFeedResult {
  sections: FeedSection[];
  loading: boolean;
  hasMore: boolean;
  loadNext: () => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Infinite-scroll hook for the discovery feed.
 * Uses IntersectionObserver (200px rootMargin) to auto-trigger next page loads.
 * Caps at 5 pages / 60 cumulative products.
 *
 * @param category - Active category filter (pass empty string or "all" for unfiltered)
 */
export function useDiscoveryFeed(category: string): UseDiscoveryFeedResult {
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const productCount = useRef(0);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset state when category changes
  useEffect(() => {
    setSections([]);
    setPage(0);
    setHasMore(true);
    productCount.current = 0;
  }, [category]);

  const loadNext = useCallback(async () => {
    const nextPage = page + 1;

    // Guard: don't exceed max pages or max products
    if (nextPage > MAX_PAGES || productCount.current >= MAX_PRODUCTS || loading) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      const params: Record<string, string | number> = { page: nextPage };
      if (category && category.toLowerCase() !== 'all') {
        params.category = category;
      }

      const { data } = await api.get<DiscoverFeedResponse>('/feed/discover', {
        params,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      // Count incoming products
      const incomingCount = data.sections.reduce(
        (sum, section) => sum + section.products.length,
        0
      );
      productCount.current += incomingCount;

      setSections((prev) => [...prev, ...data.sections]);
      setPage(nextPage);

      // Determine if there's more to load
      const reachedPageCap = nextPage >= MAX_PAGES;
      const reachedProductCap = productCount.current >= MAX_PRODUCTS;
      setHasMore(data.hasMore && !reachedPageCap && !reachedProductCap);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      // On error, stop trying to load more
      setHasMore(false);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, category, loading]);

  // IntersectionObserver to auto-trigger loadNext
  useEffect(() => {
    const node = triggerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          loadNext();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadNext]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { sections, loading, hasMore, loadNext, triggerRef };
}
