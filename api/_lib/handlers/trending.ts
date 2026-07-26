// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTrending, getTrendingAllWindows, invalidateTrendingCache, TRENDING_LIMIT } from '../trendingEngine.js';
import type { TrendingWindow } from '../trendingEngine.js';
import { requireAdmin } from '../adminAuth.js';
import { connectDB } from '../db.js';

const VALID_WINDOWS = new Set<TrendingWindow>(['24h', '7d', '30d']);

/**
 * GET /api/products/trending
 *
 * Query params:
 *   window   '24h' | '7d' | '30d'  (default '7d')
 *   category  optional string filter
 *   limit     1–50 (default 20)
 *
 * Returns: { products: TrendingProduct[], window, cachedAt }
 * Cache-Control: s-maxage=600 (10 min — matches TRENDING_CACHE_TTL_MS)
 */
async function getTrendingHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rawWindow = (req.query.window as string) || '7d';
  const window: TrendingWindow = VALID_WINDOWS.has(rawWindow as TrendingWindow)
    ? (rawWindow as TrendingWindow)
    : '7d';

  const category = typeof req.query.category === 'string' ? req.query.category.trim() : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || TRENDING_LIMIT, 1), 50);

  try {
    const result = await getTrending(window, category || undefined, limit);

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=60');
    return res.json({
      products: result.products,
      window:   result.window,
      cachedAt: result.cachedAt,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch trending products', message: e.message });
  }
}

/**
 * GET /api/products/trending/admin
 *
 * Admin-only. Returns trending data for all three windows + current weights.
 * Used by the admin dashboard trending tab.
 */
async function getTrendingAdmin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const category = typeof req.query.category === 'string' ? req.query.category.trim() : undefined;

  try {
    const all = await getTrendingAllWindows(category || undefined);
    return res.json({
      windows: all,
      weights: all['7d'].weights,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch trending admin data', message: e.message });
  }
}

/**
 * PUT /api/products/trending/weights
 *
 * Admin-only. Updates signal weights and busts the trending cache.
 * Body: { view, compareClick, wishlistAdd, affiliateClick, priceAlert }
 */
async function updateWeights(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { view, compareClick, wishlistAdd, affiliateClick, priceAlert } = req.body || {};

  const weights: Record<string, number> = {};
  for (const [k, v] of Object.entries({ view, compareClick, wishlistAdd, affiliateClick, priceAlert })) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({ error: `Invalid weight for '${k}': must be a non-negative number` });
    }
    weights[k] = n;
  }

  try {
    await connectDB();
    const TrendingConfig = (await import('../models/TrendingConfig.js')).default;
    await TrendingConfig.findOneAndUpdate(
      { key: 'default' },
      { $set: { weights, updatedAt: new Date() } },
      { upsert: true },
    );
    invalidateTrendingCache();
    return res.json({ success: true, weights });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to update weights', message: e.message });
  }
}

export async function handleTrending(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
) {
  const path = subpath.replace(/^\//, '');
  if (path === '' || path === 'trending') return getTrendingHandler(req, res);
  if (path === 'admin')   return getTrendingAdmin(req, res);
  if (path === 'weights') return updateWeights(req, res);
  return res.status(404).json({ error: 'Not found' });
}
