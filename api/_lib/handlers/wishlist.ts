// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import { WishlistItem } from '../models/WishlistItem.js';
import { getUserFromRequest } from '../auth.js';

// --- List / Create ---

async function index(req: VercelRequest, res: VercelResponse) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  await connectDB();

  if (req.method === 'GET') {
    const items = await WishlistItem.find({ userId: user.userId }).sort({ createdAt: -1 });
    return res.json({ items });
  }

  if (req.method === 'POST') {
    const { productTitle, sourceUrl, platform, savedPrice, imageUrl, brand, notifyOnDrop } = req.body || {};
    if (!productTitle || !sourceUrl || !platform || !savedPrice) {
      return res.status(400).json({ error: 'productTitle, sourceUrl, platform, savedPrice required' });
    }

    const existing = await WishlistItem.findOne({ userId: user.userId, sourceUrl });
    if (existing) return res.json({ item: existing, message: 'Already saved' });

    const item = await WishlistItem.create({
      userId: user.userId,
      userEmail: user.email,
      productTitle,
      sourceUrl,
      platform,
      savedPrice,
      imageUrl,
      brand,
      notifyOnDrop: notifyOnDrop ?? false,
    });

    return res.status(201).json({ item });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

// --- Delete by ID ---

async function byId(req: VercelRequest, res: VercelResponse, id: string) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  if (!id) return res.status(400).json({ error: 'ID required' });

  await connectDB();

  if (req.method === 'DELETE') {
    const item = await WishlistItem.findOneAndDelete({ _id: id, userId: user.userId });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json({ success: true });
  }

  if (req.method === 'PATCH') {
    const { notifyOnDrop } = req.body || {};
    if (typeof notifyOnDrop !== 'boolean') return res.status(400).json({ error: 'notifyOnDrop (boolean) required' });
    const item = await WishlistItem.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { notifyOnDrop },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json({ item });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

export async function handleWishlist(req: VercelRequest, res: VercelResponse, subpath: string) {
  const cleaned = subpath.startsWith('/') ? subpath.slice(1) : subpath;

  if (!cleaned || cleaned === '') {
    return index(req, res);
  }

  return byId(req, res, cleaned);
}
