import { useState, useEffect, useRef, useCallback } from 'react';
import { validateProduct } from '../utils/validateProduct';
import type { ValidatedProduct } from '../utils/validateProduct';

// ─── Constants ───────────────────────────────────────────────────────────────

const FEED_ENDPOINT = '/api/home/feed';
const TIMEOUT_MS = 10_000;
const EMPTY_STATE_MESSAGE =
  'No products available for this category. Results are being indexed.';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface UseHomeFeedResult {
  products: ValidatedProduct[];
  loading: boolean;
  error: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Fetches validated products from `/api/home/feed` for the given category.
 *
 * Guarantees:
 * - Every product in the returned array passes `validateProduct()` (no seed data)
 * - Loading state is capped at 10 seconds; after timeout, products are set to []
 *   and error is set to the empty-state message
 * - Request is cancelled on category change or unmount via AbortController
 *
 * Requirements: 1.1, 1.2, 1.3, 1.7
 */
export function useHomeFeed(category: string): UseHomeFeedResult {
  const [products, setProducts] = useState<ValidatedProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Abort any in-flight request from a previous category
    abortRef.current?.abort();
    clearTimer();

    const controller = new AbortController();
    abortRef.current = controller;

    // Reset state for new fetch
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional state reset when category changes
    setLoading(true);
    setProducts([]);
    setError(null);

    let settled = false;

    // ── 10-second timeout ──────────────────────────────────────────────────
    timeoutRef.current = setTimeout(() => {
      if (!settled) {
        settled = true;
        controller.abort();
        setProducts([]);
        setLoading(false);
        setError(EMPTY_STATE_MESSAGE);
      }
    }, TIMEOUT_MS);

    // ── Fetch from /api/home/feed ──────────────────────────────────────────
    const url = `${FEED_ENDPOINT}?category=${encodeURIComponent(category || 'all')}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Feed request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (settled || controller.signal.aborted) return;
        settled = true;
        clearTimer();

        const rawProducts: unknown[] = data?.products ?? [];

        // Apply validateProduct() to every item — guarantees no seed data
        const validated: ValidatedProduct[] = [];
        for (const raw of rawProducts) {
          const product = validateProduct(raw);
          if (product !== null) {
            validated.push(product);
          }
        }

        setProducts(validated);
        setLoading(false);

        if (validated.length === 0) {
          setError(EMPTY_STATE_MESSAGE);
        }
      })
      .catch((err) => {
        if (settled || controller.signal.aborted) return;
        settled = true;
        clearTimer();

        setProducts([]);
        setLoading(false);
        setError(
          err?.message || 'Failed to load products. Please try again later.',
        );
      });

    // Cleanup on unmount or category change
    return () => {
      settled = true;
      clearTimer();
      controller.abort();
    };
  }, [category, clearTimer]);

  return { products, loading, error };
}
