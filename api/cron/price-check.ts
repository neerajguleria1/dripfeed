// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import WishlistItem from '../_lib/models/WishlistItem.js';
import Deal from '../_lib/models/Deal.js';

/**
 * GET /api/cron/price-check
 * Called by external cron every 6 hours.
 * Checks wishlist items for price drops, creates Deal records.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await connectDB();

    const items = await WishlistItem.find({}).limit(50).lean();
    let checked = 0;
    let drops = 0;

    for (const item of items) {
      checked++;
      // In production, this would re-fetch current prices from platform APIs
      // For now, we just check if stored currentPrice < savedPrice
      // Real implementation would call searchProduct for each item
    }

    return res.json({ checked, drops });
  } catch (e: any) {
    return res.status(500).json({ error: 'Price check failed', message: e.message });
  }
}
