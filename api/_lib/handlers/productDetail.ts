// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchProducts } from '../search.js';
import type { CanonicalProduct } from '../types/canonicalProduct.js';

/**
 * GET /api/product/:canonicalId
 *
 * Optimized lookup strategy:
 *   1. Query SearchCache with { canonicalIds: canonicalId } — hits the sparse
 *      array index added in the SearchCache schema. O(1) index scan instead of
 *      loading and scanning up to 200 documents in application code.
 *   2. groupSearchResults() is called once on the single matching document.
 *   3. Falls back to the old full-scan only if the canonicalIds index has no
 *      match (e.g. legacy cache docs written before the index was added).
 *
 * The canonicalIds field is written by setDbCache() in search.ts whenever
 * live results are persisted, so all new cache documents are indexed.
 */
async function getProduct(req: VercelRequest, res: VercelResponse, canonicalId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!canonicalId) return res.status(400).json({ error: 'canonicalId is required' });

  try {
    const { connectDB } = await import('../db.js');
    const SearchCache = (await import('../models/SearchCache.js')).default;
    const { groupSearchResults } = await import('../search.js');

    await connectDB();

    let found: CanonicalProduct | null = null;
    let foundQuery = '';

    // ── Fast path: index lookup ──────────────────────────────────────────────
    // { canonicalIds: canonicalId } uses the sparse array index — single doc
    // returned, no application-level scan loop needed.
    const indexed = await SearchCache.findOne(
      { canonicalIds: canonicalId },
      { query: 1, results: 1 },
    ).lean();

    if (indexed) {
      const canonicals = groupSearchResults(indexed.results as any[]);
      const match = canonicals.find(c => c.id === canonicalId);
      if (match) {
        found = match;
        foundQuery = indexed.query;
      }
    }

    // ── Fallback: legacy scan for docs without canonicalIds ──────────────────
    // Removed once all cache docs have been cycled through (TTL = 24h).
    if (!found) {
      const recentCaches = await SearchCache.find(
        { canonicalIds: { $exists: false } }, // only legacy docs
        { query: 1, results: 1 },
      )
        .sort({ fetchedAt: -1 })
        .limit(200)
        .lean();

      for (const cache of recentCaches) {
        const canonicals = groupSearchResults(cache.results as any[]);
        const match = canonicals.find(c => c.id === canonicalId);
        if (match) {
          found = match;
          foundQuery = cache.query;
          break;
        }
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Product not found', canonicalId });
    }

    // Fetch similar products using the same query, exclude the found product
    let similar: CanonicalProduct[] = [];
    if (foundQuery) {
      try {
        const allResults = await searchProducts(foundQuery);
        similar = allResults.filter(c => c.id !== canonicalId).slice(0, 4);
      } catch {
        // non-fatal — similar products are optional
      }
    }

    return res.json({ product: found, similar, query: foundQuery });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch product', message: e.message });
  }
}

export async function handleProductDetail(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
) {
  const canonicalId = subpath.replace(/^\//, '').split('/')[0];
  return getProduct(req, res, canonicalId);
}
