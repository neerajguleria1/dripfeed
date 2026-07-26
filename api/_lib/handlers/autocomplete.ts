// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAutocompleteSuggestions, MAX_POPULAR } from '../autocompleteEngine.js';

const STATIC_POPULAR = [
  'kurta', 'sneakers', 'saree', 'lehenga', 'jeans',
  'hoodie', 'dress', 'palazzo', 'kurti set', 'ethnic wear',
];

/**
 * GET /api/search/autocomplete
 *
 * Query params:
 *   q      search query (min 1 char)
 *   limit  1–20 (default 8)
 *
 * Returns:
 *   { popular, products, brands, categories }
 *
 * When q is empty/missing, returns static popular searches with no DB hit.
 * Cache-Control: s-maxage=300 (5 min — matches AUTOCOMPLETE_CACHE_TTL_MS)
 */
export async function handleAutocomplete(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = ((req.query.q as string) || '').trim();
  const rawLimit = Number(req.query.limit);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : MAX_POPULAR, 1), 20);

  // Empty query — return static popular searches instantly, no DB
  if (!q) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.json({
      popular:    STATIC_POPULAR.slice(0, limit).map(query => ({ query, count: 0, matchType: 'popular' })),
      products:   [],
      brands:     [],
      categories: [],
    });
  }

  if (q.length < 1) {
    return res.status(400).json({ error: 'Query too short' });
  }

  try {
    const result = await getAutocompleteSuggestions(q, limit);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: 'Autocomplete failed', message: e.message });
  }
}
