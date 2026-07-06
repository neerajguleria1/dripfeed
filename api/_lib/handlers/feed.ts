// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import { getUserFromRequest } from '../auth.js';
import UserPreferences from '../models/UserPreferences.js';
import Product from '../models/Product.js';
import {
  scoreAndSortProducts,
  productToProductData,
  prefsToUserPrefs,
} from '../personalization.js';
import type { ScoredProduct } from '../personalization.js';

async function personalized(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await connectDB();

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));

  const preferences = await UserPreferences.findOne({ userId: user.userId }).lean();
  if (!preferences) {
    return res.json({ products: [], hasMore: false, page, noPreferences: true });
  }

  const rawProducts = await Product.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const productDataList = rawProducts.map((p) => productToProductData(p as any));
  const userPrefs = prefsToUserPrefs(preferences as any);
  const searchHistory = (preferences.searchHistory || []).map((entry: any) => ({
    query: entry.query,
    timestamp: new Date(entry.timestamp),
  }));

  const scored: ScoredProduct[] = scoreAndSortProducts(productDataList, userPrefs, searchHistory);

  const start = (page - 1) * limit;
  const paginated = scored.slice(start, start + limit);
  const hasMore = start + limit < scored.length;

  return res.json({ products: paginated, hasMore, page });
}

export async function handleFeed(req: VercelRequest, res: VercelResponse, subpath: string) {
  switch (subpath) {
    case 'personalized': return personalized(req, res);
    default: return res.status(404).json({ error: 'Not found' });
  }
}
