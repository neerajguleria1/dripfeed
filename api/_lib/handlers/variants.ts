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
  const memHit = getVariantCache(cacheKey);
  if (memHit) { res.status(200).json(memHit); return; }

  // L2 — MongoDB (persists across Vercel instances)
  const dbHit = await getVariantCacheDb(cacheKey);
  if (dbHit) { setVariantCache(cacheKey, dbHit); res.status(200).json(dbHit); return; }

  try {
    const variants = await fetchPlatformVariants(platform, productId);
    if (!variants) {
      res.status(500).json({ error: 'Unable to fetch variants' });
      return;
    }
    setVariantCache(cacheKey, variants);
    setVariantCacheDb(cacheKey, variants);
    res.status(200).json(variants);
  } catch {
    res.status(500).json({ error: 'Unable to fetch variants' });
  }
}
