// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import { getUserFromRequest } from '../auth.js';
import UserPreferences from '../models/UserPreferences.js';

/** Maximum items kept per user. Oldest entries are dropped beyond this. */
const MAX_RECENT = Number(process.env.RECENT_PRODUCTS_MAX) || 20;

/** Items older than this are stripped on read (ms). Default 30 days. */
const TTL_MS = Number(process.env.RECENT_PRODUCTS_TTL_MS) || 30 * 24 * 60 * 60 * 1000;

/**
 * GET /api/users/recent-products
 * Returns the authenticated user's recently viewed products, most-recent first,
 * filtered to items within TTL_MS.
 */
async function getRecent(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  await connectDB();

  const prefs = await UserPreferences.findOne(
    { userId: user.userId },
    { recentProducts: 1 },
  ).lean();

  const cutoff = new Date(Date.now() - TTL_MS);
  const items = (prefs?.recentProducts ?? [])
    .filter((p: any) => new Date(p.viewedAt) >= cutoff)
    .sort((a: any, b: any) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime())
    .slice(0, MAX_RECENT);

  return res.json({ products: items });
}

/**
 * POST /api/users/recent-products
 * Body: { canonicalId, title, brand?, imageUrl?, price, originalPrice?, discount?, platform, url }
 *
 * Upserts the product at the front of the list (dedup by canonicalId).
 * Trims to MAX_RECENT after insert.
 * Uses $pull + $push with $slice to avoid N+1 reads.
 */
async function addRecent(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const { canonicalId, title, brand, imageUrl, price, originalPrice, discount, platform, url } = req.body || {};
  if (!canonicalId || !title || !price || !platform || !url) {
    return res.status(400).json({ error: 'canonicalId, title, price, platform, url are required' });
  }

  await connectDB();

  const entry = {
    canonicalId,
    title,
    brand: brand ?? undefined,
    imageUrl: imageUrl ?? undefined,
    price: Number(price),
    originalPrice: originalPrice ? Number(originalPrice) : undefined,
    discount: discount ? Number(discount) : undefined,
    platform,
    url,
    viewedAt: new Date(),
  };

  // Atomic: remove existing entry for this canonicalId, then prepend the fresh one,
  // then slice to MAX_RECENT — all in one findOneAndUpdate, no read required.
  await UserPreferences.findOneAndUpdate(
    { userId: user.userId },
    {
      $pull: { recentProducts: { canonicalId } },
      $setOnInsert: { userId: user.userId },
    },
    { upsert: true },
  );

  await UserPreferences.findOneAndUpdate(
    { userId: user.userId },
    {
      $push: {
        recentProducts: {
          $each: [entry],
          $position: 0,
          $slice: MAX_RECENT,
        },
      },
    },
  );

  return res.status(201).json({ success: true });
}

export async function handleUsers(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
) {
  const path = subpath.replace(/^\//, '');
  if (path === 'recent-products') {
    if (req.method === 'GET') return getRecent(req, res);
    if (req.method === 'POST') return addRecent(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(404).json({ error: 'Not found' });
}
