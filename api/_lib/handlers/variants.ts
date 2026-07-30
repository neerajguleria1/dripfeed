// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchAjioVariants } from '../variantFetcher.js';
import { getVariantCache, setVariantCache, getVariantCacheDb, setVariantCacheDb } from '../cache/variantCache.js';

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

  if (platform !== 'ajio') {
    res.status(400).json({ error: `Platform not supported yet` });
    return;
  }

  // L1 — in-memory
  const memHit = getVariantCache(productId);
  if (memHit) { res.status(200).json(memHit); return; }

  // L2 — MongoDB
  const dbHit = await getVariantCacheDb(productId);
  if (dbHit) { setVariantCache(productId, dbHit); res.status(200).json(dbHit); return; }

  try {
    const variants = await fetchAjioVariants(productId);
    if (!variants) {
      res.status(500).json({ error: 'Unable to fetch variants' });
      return;
    }
    setVariantCache(productId, variants);
    setVariantCacheDb(productId, variants);
    res.status(200).json(variants);
  } catch {
    res.status(500).json({ error: 'Unable to fetch variants' });
  }
}
