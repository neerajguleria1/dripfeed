import type { AjioProductVariants } from '../types/productVariant.js';

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const store = new Map<string, { data: AjioProductVariants; ts: number }>();

export function cacheKey(productId: string): string {
  return `variants:${productId}`;
}

export function getVariantCache(productId: string): AjioProductVariants | null {
  const entry = store.get(cacheKey(productId));
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) { store.delete(cacheKey(productId)); return null; }
  return entry.data;
}

export function setVariantCache(productId: string, data: AjioProductVariants): void {
  store.set(cacheKey(productId), { data, ts: Date.now() });
}
