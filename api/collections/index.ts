// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import { getUserFromRequest } from '../_lib/auth.js';
import Collection from '../_lib/models/Collection.js';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const collections = await Collection.find({ userId: user.userId })
      .sort({ updatedAt: -1 })
      .lean();

    const summary = collections.map((c) => ({
      id: c._id,
      title: c.title,
      description: c.description,
      productCount: c.products.length,
      previewImages: c.products.slice(0, 4).map((p) => p.imageUrl),
      shareToken: c.shareToken,
      isPublic: c.isPublic,
    }));

    return res.json(summary);
  }

  if (req.method === 'POST') {
    const { title, description } = req.body || {};
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (title.length > 50) {
      return res.status(400).json({ error: 'Title must be 50 characters or less' });
    }

    const shareToken = crypto.randomUUID();

    const collection = await Collection.create({
      userId: user.userId,
      title: title.trim(),
      description: description?.slice(0, 200) || '',
      products: [],
      shareToken,
      isPublic: false,
    });

    return res.status(201).json({
      id: collection._id,
      title: collection.title,
      description: collection.description,
      productCount: 0,
      previewImages: [],
      shareToken: collection.shareToken,
      isPublic: collection.isPublic,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
