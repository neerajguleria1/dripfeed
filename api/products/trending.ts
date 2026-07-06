import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import Product from '../_lib/models/Product.js';

/**
 * GET /api/products/trending
 * Returns trending products sorted by most recently updated.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectDB();

    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const category = req.query.category as string | undefined;

    const filter: Record<string, unknown> = {};
    if (category?.trim()) filter.category = category.trim();

    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const formatted = products.map((p: any) => ({
      id: p._id,
      title: p.title,
      brand: p.brand,
      imageUrl: p.imageUrl,
      price: p.price || 0,
      originalPrice: p.originalPrice,
      discount: p.discount,
      platform: p.platform || '',
      url: p.url || '',
    }));

    return res.json({ products: formatted });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch trending', message: e.message });
  }
}
