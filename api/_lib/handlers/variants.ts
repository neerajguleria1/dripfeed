// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchAjioVariants } from '../variantFetcher.js';
import { getVariantCache, setVariantCache } from '../cache/variantCache.js';

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
    res.status(400).json({ error: 'Platform not supported yet' });
    return;
  }

  const cached = getVariantCache(productId);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const variants = await fetchAjioVariants(productId);
    if (!variants) {
      res.status(500).json({ error: 'Unable to fetch variants' });
      return;
    }
    setVariantCache(productId, variants);
    res.status(200).json(variants);
  } catch {
    res.status(500).json({ error: 'Unable to fetch variants' });
  }
}
