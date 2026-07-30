// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchPlatformVariants } from '../variantFetcher.js';
import { getVariantCache, setVariantCache, getVariantCacheDb, setVariantCacheDb } from '../cache/variantCache.js';

const SUPPORTED_PLATFORMS = new Set(['ajio', 'amazon india', 'amazon', 'flipkart', 'myntra', 'meesho', 'tata cliq', 'tata_cliq']);

export async function handleVariants(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const platform  = (req.query.platform  as string | undefined)?.toLowerCase().trim();
  const productId = (req.query.productId as string | undefined)?.trim();

  if (!platform || !productId) {
    res.status(400).json({ error: 'platform and productId are required' });
    return;
  }

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    res.status(400).json({ error: `Platform not supported. Supported: ${[...SUPPORTED_PLATFORMS].join(', ')}` });
    return;
  }

  const cacheKey = `${platform}::${productId}`;

  // L1 — in-memory
  try {
    const memHit = getVariantCache(cacheKey);
    if (memHit) { res.status(200).json(memHit); return; }
  } catch { /* */ }

  // L2 — MongoDB
  try {
    const dbHit = await getVariantCacheDb(cacheKey);
    if (dbHit) { setVariantCache(cacheKey, dbHit); res.status(200).json(dbHit); return; }
  } catch { /* */ }

  try {
    console.log(`[Variants] fetching platform=${platform} productId=${productId.slice(0, 60)}...`);
    const variants = await fetchPlatformVariants(platform, productId);
    if (!variants) {
      console.warn(`[Variants] null result for platform=${platform}`);
      res.status(500).json({ error: 'Unable to fetch variants' });
      return;
    }
    console.log(`[Variants] success platform=${platform} colors=${variants.colors?.length ?? 0} sizes=${variants.sizes?.length ?? 0}`);
    try { setVariantCache(cacheKey, variants); } catch { /* */ }
    try { setVariantCacheDb(cacheKey, variants); } catch { /* */ }
    res.status(200).json(variants);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120);
    console.error(`[Variants] exception platform=${platform}:`, msg);
    res.status(500).json({ error: 'Unable to fetch variants' });
  }
}
