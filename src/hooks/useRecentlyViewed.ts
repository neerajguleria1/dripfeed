/**
 * useRecentlyViewed.ts
 *
 * Recently Viewed product history.
 *
 * ── Anonymous users ───────────────────────────────────────────────────────────
 * History stored in localStorage under STORAGE_KEY.
 * Items older than TTL_MS are stripped on every read.
 *
 * ── Logged-in users ───────────────────────────────────────────────────────────
 * History is fetched from GET /api/users/recent-products on mount.
 * Each view is persisted via POST /api/users/recent-products.
 * localStorage is kept in sync so the UI is instant (no loading flash).
 *
 * ── Post-login sync ───────────────────────────────────────────────────────────
 * Call syncAfterLogin() after a successful login/register/googleLogin.
 * It merges the anonymous localStorage history into the backend, then
 * replaces localStorage with the merged server state.
 *
 * ── Deduplication ────────────────────────────────────────────────────────────
 * Keyed by canonicalId. Adding an existing id moves it to the front.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';
import type { ProductData } from '../types/product';

// ─── Config ───────────────────────────────────────────────────────────────────

export const STORAGE_KEY = 'tc_recently_viewed';
export const MAX_RECENT  = 20;
export const TTL_MS      = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Stored shape ─────────────────────────────────────────────────────────────

export interface RecentItem extends ProductData {
  /** canonicalId — used as the dedup key */
  id: string;
  viewedAt: number; // Unix ms
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function readStorage(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: RecentItem[] = JSON.parse(raw);
    const cutoff = Date.now() - TTL_MS;
    return parsed.filter(p => p.viewedAt >= cutoff);
  } catch {
    return [];
  }
}

function writeStorage(items: RecentItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch { /* quota exceeded — non-fatal */ }
}

/** Prepend item, dedup by id, trim to MAX_RECENT. */
function upsertFront(list: RecentItem[], item: RecentItem): RecentItem[] {
  const filtered = list.filter(p => p.id !== item.id);
  return [item, ...filtered].slice(0, MAX_RECENT);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseRecentlyViewedResult {
  items: RecentItem[];
  /** Call when a product detail page is viewed. */
  trackView: (product: ProductData) => void;
  /**
   * Call immediately after a successful login/register/googleLogin.
   * Merges anonymous localStorage history into the backend, then
   * replaces local state with the merged server list.
   */
  syncAfterLogin: () => Promise<void>;
  /** True while the initial server fetch is in flight. */
  loading: boolean;
}

export function useRecentlyViewed(isLoggedIn: boolean): UseRecentlyViewedResult {
  const [items, setItems] = useState<RecentItem[]>(() => readStorage());
  const [loading, setLoading] = useState(false);
  const hasFetched = useRef(false);

  // ── Fetch from server when user is logged in ──────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || hasFetched.current) return;
    hasFetched.current = true;

    setLoading(true);
    api.get('/users/recent-products')
      .then(({ data }) => {
        const serverItems: RecentItem[] = (data.products ?? []).map((p: any) => ({
          id:            p.canonicalId,
          title:         p.title,
          brand:         p.brand,
          imageUrl:      p.imageUrl,
          price:         p.price,
          originalPrice: p.originalPrice,
          discount:      p.discount,
          platform:      p.platform,
          url:           p.url,
          viewedAt:      new Date(p.viewedAt).getTime(),
        }));
        setItems(serverItems);
        writeStorage(serverItems);
      })
      .catch(() => { /* keep localStorage state */ })
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  // Reset fetch flag on logout so next login re-fetches
  useEffect(() => {
    if (!isLoggedIn) {
      hasFetched.current = false;
      setItems(readStorage());
    }
  }, [isLoggedIn]);

  // ── Track a product view ──────────────────────────────────────────────────
  const trackView = useCallback((product: ProductData) => {
    if (!product?.id) return;

    const item: RecentItem = { ...product, viewedAt: Date.now() };

    // Optimistic local update — instant, no loading state
    setItems(prev => {
      const next = upsertFront(prev, item);
      writeStorage(next);
      return next;
    });

    // Persist to backend for logged-in users (fire-and-forget)
    if (isLoggedIn) {
      api.post('/users/recent-products', {
        canonicalId:   product.id,
        title:         product.title,
        brand:         product.brand,
        imageUrl:      product.imageUrl,
        price:         product.price,
        originalPrice: product.originalPrice,
        discount:      product.discount,
        platform:      product.platform,
        url:           product.url,
      }).catch(() => { /* non-fatal */ });
    }
  }, [isLoggedIn]);

  // ── Sync anonymous history to backend after login ─────────────────────────
  const syncAfterLogin = useCallback(async () => {
    const anonItems = readStorage();
    if (!anonItems.length) return;

    // Push each anon item to the backend oldest-first so the final server
    // order matches the local order (newest first after all inserts).
    const toSync = [...anonItems].reverse();
    await Promise.allSettled(
      toSync.map(item =>
        api.post('/users/recent-products', {
          canonicalId:   item.id,
          title:         item.title,
          brand:         item.brand,
          imageUrl:      item.imageUrl,
          price:         item.price,
          originalPrice: item.originalPrice,
          discount:      item.discount,
          platform:      item.platform,
          url:           item.url,
        })
      )
    );

    // Fetch the merged server state and replace local
    try {
      const { data } = await api.get('/users/recent-products');
      const merged: RecentItem[] = (data.products ?? []).map((p: any) => ({
        id:            p.canonicalId,
        title:         p.title,
        brand:         p.brand,
        imageUrl:      p.imageUrl,
        price:         p.price,
        originalPrice: p.originalPrice,
        discount:      p.discount,
        platform:      p.platform,
        url:           p.url,
        viewedAt:      new Date(p.viewedAt).getTime(),
      }));
      setItems(merged);
      writeStorage(merged);
      hasFetched.current = true;
    } catch { /* keep local state */ }
  }, []);

  return { items, trackView, syncAfterLogin, loading };
}
