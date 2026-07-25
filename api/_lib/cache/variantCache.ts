import type { AjioProductVariants } from '../types/productVariant.js';
import { connectDB } from '../db.js';
import VariantCacheModel from '../models/VariantCache.js';

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// L1 — in-memory (same Vercel instance, instant)
const memStore = new Map<string, { data: AjioProductVariants; ts: number }>();

export function cacheKey(productId: string): string {
  return `variants:${productId}`;
}

export function getVariantCache(productId: string): AjioProductVariants | null {
  const entry = memStore.get(cacheKey(productId));
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) { memStore.delete(cacheKey(productId)); return null; }
  return entry.data;
}

export function setVariantCache(productId: string, data: AjioProductVariants): void {
  memStore.set(cacheKey(productId), { data, ts: Date.now() });
}

// L2 — MongoDB (persists across Vercel instances)
export async function getVariantCacheDb(productId: string): Promise<AjioProductVariants | null> {
  try {
    await connectDB();
    const doc = await VariantCacheModel.findOne({ productId }).lean();
    if (!doc) return null;
    if (Date.now() - new Date(doc.cachedAt).getTime() > TTL_MS) return null;
    return doc.data as AjioProductVariants;
  } catch { return null; }
}

export async function setVariantCacheDb(productId: string, data: AjioProductVariants): Promise<void> {
  try {
    await connectDB();
    await VariantCacheModel.findOneAndUpdate(
      { productId },
      { data, cachedAt: new Date() },
      { upsert: true, new: true }
    );
  } catch { /* non-fatal */ }
}
