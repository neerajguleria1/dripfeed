/**
 * DiscoveryFeed — Infinite scroll discovery section that progressively loads
 * themed product batches below the fold.
 *
 * Uses IntersectionObserver-based `useInfiniteScroll` hook to fetch batches
 * of 20 products from `/api/home/feed` with offset pagination. All products
 * are validated via `validateProduct()` before rendering.
 *
 * Displays SkeletonLoader placeholders while loading, end-of-feed indicator
 * when no more content, and a retry button on error while preserving
 * previously loaded content.
 *
 * @validates Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8
 */

import { useState, useCallback } from 'react';
import { ProductCard } from '../product/ProductCard';
import { MasonryGrid } from '../layout/MasonryGrid';
import { SkeletonLoader } from '../ui/SkeletonLoader';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { validateProduct, type ValidatedProduct } from '../../utils/validateProduct';

// ─── Props ───

export interface InfiniteScrollFeedProps {
  category: string;
  initialOffset?: number;
}

// ─── Constants ───

const BATCH_SIZE = 20;
const SCROLL_THRESHOLD = 500;
const MAX_RETRIES = 3;
const FETCH_TIMEOUT = 10000;

// ─── Component ───

export function DiscoveryFeed({ category, initialOffset = 0 }: InfiniteScrollFeedProps) {
  const [products, setProducts] = useState<ValidatedProduct[]>([]);

  /**
   * Fetch function passed to useInfiniteScroll.
   * Calls /api/home/feed with category and offset, validates all products,
   * and accumulates valid ones into state.
   */
  const fetchFn = useCallback(
    async (offset: number): Promise<{ products: unknown[]; hasMore: boolean }> => {
      const effectiveOffset = offset + initialOffset;
      const url = `/api/home/feed?category=${encodeURIComponent(category)}&offset=${effectiveOffset}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Feed fetch failed with status ${response.status}`);
      }

      const data = await response.json();
      const rawProducts: unknown[] = Array.isArray(data.products) ? data.products : Array.isArray(data) ? data : [];

      // Validate all products before accepting them
      const validProducts: ValidatedProduct[] = [];
      for (const raw of rawProducts) {
        const validated = validateProduct(raw);
        if (validated) {
          validProducts.push(validated);
        }
      }

      // Accumulate validated products into state (preserve existing content)
      if (validProducts.length > 0) {
        setProducts((prev) => [...prev, ...validProducts]);
      }

      // Determine if there's more content available
      const hasMore = rawProducts.length >= BATCH_SIZE;

      return { products: validProducts, hasMore };
    },
    [category, initialOffset]
  );

  const { triggerRef, loading, hasMore, error, retry } = useInfiniteScroll({
    threshold: SCROLL_THRESHOLD,
    batchSize: BATCH_SIZE,
    maxRetries: MAX_RETRIES,
    timeout: FETCH_TIMEOUT,
    fetchFn,
  });

  return (
    <section className="mt-8" aria-label="Discovery feed">
      {/* ─── Rendered Products ─── */}
      {products.length > 0 && (
        <MasonryGrid>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </MasonryGrid>
      )}

      {/* ─── Loading State: 4 skeleton placeholders ─── */}
      {loading && (
        <div className="mt-4">
          <SkeletonLoader count={4} variant="discovery" />
        </div>
      )}

      {/* ─── Error State: retry button, previously loaded content preserved above ─── */}
      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-neutral-500">{error}</p>
          <button
            onClick={retry}
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── End of Feed Indicator ─── */}
      {!hasMore && !loading && !error && products.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-neutral-400">You've seen it all!</p>
        </div>
      )}

      {/* ─── Sentinel Element for IntersectionObserver ─── */}
      <div ref={triggerRef} aria-hidden="true" className="h-1" />
    </section>
  );
}

export default DiscoveryFeed;
