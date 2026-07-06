// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import { WishlistItem } from '../_lib/models/WishlistItem.js';
import { getUserFromRequest } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  await connectDB();

  if (req.method === 'GET') {
    const items = await WishlistItem.find({ userId: user.userId }).sort({ createdAt: -1 });
    return res.json({ items });
  }

  if (req.method === 'POST') {
    const { productTitle, sourceUrl, platform, savedPrice, imageUrl, brand } = req.body || {};
    if (!productTitle || !sourceUrl || !platform || !savedPrice) {
      return res.status(400).json({ error: 'productTitle, sourceUrl, platform, savedPrice required' });
    }

    // Check if already saved
    const existing = await WishlistItem.findOne({ userId: user.userId, sourceUrl });
    if (existing) return res.json({ item: existing, message: 'Already saved' });

    const item = await WishlistItem.create({
      userId: user.userId,
      productTitle,
      sourceUrl,
      platform,
      savedPrice,
      imageUrl,
      brand,
    });

    return res.status(201).json({ item });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
