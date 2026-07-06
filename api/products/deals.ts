import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import Deal from '../_lib/models/Deal.js';

/**
 * GET /api/products/deals
 * Returns active deals sorted by discount percentage (default).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectDB();

    const sort = (req.query.sort as string) || 'discount';
    const platform = req.query.platform as string | undefined;
    const minDiscount = Number(req.query.minDiscount) || 0;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { active: true };
    if (platform?.trim()) filter.platform = { $regex: platform.trim(), $options: 'i' };
    if (minDiscount > 0) filter.dropPercentage = { $gte: minDiscount };

    const sortOption: Record<string, 1 | -1> =
      sort === 'recent' ? { detectedAt: -1 } :
      sort === 'price' ? { currentPrice: 1 } :
      { dropPercentage: -1 };

    const [deals, total] = await Promise.all([
      Deal.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      Deal.countDocuments(filter),
    ]);

    return res.json({
      deals: deals.map(d => ({
        id: d._id,
        productTitle: d.productTitle,
        brand: d.brand,
        imageUrl: d.imageUrl,
        platform: d.platform,
        currentPrice: d.currentPrice,
        previousPrice: d.previousPrice,
        dropPercentage: d.dropPercentage,
        url: d.url,
        detectedAt: d.detectedAt,
        trackersCount: d.trackersCount,
      })),
      total,
      page,
      hasMore: skip + deals.length < total,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch deals', message: e.message });
  }
}
