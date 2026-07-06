import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db';
import { getUserFromRequest } from '../_lib/auth';
import UserPreferences from '../_lib/models/UserPreferences';
import Product from '../_lib/models/Product';
import {
  scoreAndSortProducts,
  productToProductData,
  prefsToUserPrefs,
} from '../_lib/personalization';
import type { ScoredProduct } from '../_lib/personalization';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  // Fetch last 200 products for scoring
  const rawProducts = await Product.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  // Convert to pure ProductData for scoring
  const productDataList = rawProducts.map((p) => productToProductData(p as any));
  const userPrefs = prefsToUserPrefs(preferences as any);
  const searchHistory = (preferences.searchHistory || []).map((entry: any) => ({
    query: entry.query,
    timestamp: new Date(entry.timestamp),
  }));

  // Score, sort, and randomize within bands
  const scored: ScoredProduct[] = scoreAndSortProducts(productDataList, userPrefs, searchHistory);

  // Paginate
  const start = (page - 1) * limit;
  const paginated = scored.slice(start, start + limit);
  const hasMore = start + limit < scored.length;

  return res.json({ products: paginated, hasMore, page });
}
