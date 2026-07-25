// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildRecommendations } from '../recommendations.js';

// In-memory cache: canonicalId → { data, cachedAt }
const recCache = new Map<string, { data: unknown; cachedAt: number }>();
const REC_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours — matches QUERY_CACHE_TTL_MS

/**
 * GET /api/recommendations/:canonicalId
 *
 * Returns recommendation sections for a canonical product.
 * Reuses the existing search cache — no new DB queries.
 *
 * Response:
 * {
 *   similar:      ScoredProduct[],
 *   betterDeal:   ScoredProduct[],
 *   popular:      ScoredProduct[],
 *   priceDropped: ScoredProduct[],
 *   premium:      ScoredProduct[],
 *   budget:       ScoredProduct[],
 * }
 */
async function getRecommendations(
  req: VercelRequest,
  res: VercelResponse,
  canonicalId: string,
) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!canonicalId) return res.status(400).json({ error: 'canonicalId is required' });

  // In-memory cache hit
  const cached = recCache.get(canonicalId);
  if (cached && Date.now() - cached.cachedAt < REC_CACHE_TTL_MS) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached.data);
  }

  try {
    const { connectDB } = await import('../db.js');
    const SearchCache = (await import('../models/SearchCache.js')).default;
    const { groupSearchResults } = await import('../search.js');

    await connectDB();

    // Scan recent cache entries to find the source product and its pool
    const recentCaches = await SearchCache.find({})
      .sort({ fetchedAt: -1 })
      .limit(200)
      .lean();

    let source = null;
    let pool: any[] = [];

    for (const entry of recentCaches) {
      const canonicals = groupSearchResults(entry.results as any[]);
      const match = canonicals.find((c: any) => c.id === canonicalId);
      if (match) {
        source = match;
        pool = canonicals;
        break;
      }
    }

    if (!source) {
      return res.status(404).json({ error: 'Product not found', canonicalId });
    }

    const recommendations = buildRecommendations(source, pool);

    recCache.set(canonicalId, { data: recommendations, cachedAt: Date.now() });
    res.setHeader('X-Cache', 'MISS');
    return res.json(recommendations);
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to build recommendations', message: e.message });
  }
}

export async function handleRecommendations(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
) {
  const canonicalId = subpath.replace(/^\//, '').split('/')[0];
  return getRecommendations(req, res, canonicalId);
}
