import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db';
import Product from '../_lib/models/Product';

const TRENDING_SEARCHES = [
  'kurta',
  'sneakers',
  'saree',
  'lehenga',
  'jeans',
  'hoodie',
  'dress',
  'palazzo',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = (req.query.q as string) || '';
  // userId reserved for future UserPreferences.searchHistory lookup
  const _userId = req.query.userId as string | undefined;

  try {
    const trending = TRENDING_SEARCHES;

    // Recent searches: placeholder for UserPreferences.searchHistory
    // Will be wired once preferences collection is available
    const recent: string[] = [];

    // Product suggestions: search if query is at least 2 chars
    let products: Array<{ title: string; brand?: string; imageUrl?: string }> = [];

    if (q.trim().length >= 2) {
      await connectDB();
      const regex = new RegExp(q.trim(), 'i');
      const matches = await Product.find({ title: regex })
        .select('title brand imageUrl')
        .limit(5)
        .lean();

      products = matches.map((p) => ({
        title: p.title,
        brand: p.brand || undefined,
        imageUrl: p.imageUrl || undefined,
      }));
    }

    return res.status(200).json({ recent, trending, products });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch suggestions', message: e.message });
  }
}
