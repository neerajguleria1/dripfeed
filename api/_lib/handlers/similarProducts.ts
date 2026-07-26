// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSimilarProducts } from '../similarProducts.js';

/**
 * GET /api/products/:id/similar
 *
 * Returns up to 8 similar products for a given canonical product id.
 *
 * Response shape:
 * {
 *   success: true,
 *   products: CanonicalProduct[]   // up to 8, ordered by similarity score
 * }
 *
 * Errors:
 *   400  — missing id
 *   404  — product not found in cache
 *   405  — method not allowed
 *   500  — internal error
 */
export async function handleSimilarProducts(
  req: VercelRequest,
  res: VercelResponse,
  canonicalId: string,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const id = canonicalId.replace(/^\//, '').split('/')[0];
  if (!id) {
    res.status(400).json({ success: false, error: 'canonicalId is required' });
    return;
  }

  try {
    const products = await getSimilarProducts(id);

    if (!products.length) {
      // Product not found in any cache doc — treat as 404
      res.status(404).json({ success: false, error: 'Product not found', canonicalId: id });
      return;
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    res.json({ success: true, products });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch similar products', message: e.message });
  }
}
