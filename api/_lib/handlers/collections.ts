// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { connectDB } from '../db.js';
import { getUserFromRequest } from '../auth.js';
import Collection from '../models/Collection.js';

// --- List / Create ---

async function index(req: VercelRequest, res: VercelResponse) {
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

// --- Single Collection by ID ---

async function byId(req: VercelRequest, res: VercelResponse, id: string) {
  await connectDB();

  if (!id) return res.status(400).json({ error: 'Missing ID' });

  if (req.method === 'GET') {
    const shareToken = req.query.shareToken as string | undefined;

    if (shareToken) {
      const collection = await Collection.findOne({ _id: id, shareToken, isPublic: true }).lean();
      if (!collection) return res.status(404).json({ error: 'Collection not found' });
      return res.json(collection);
    }

    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const collection = await Collection.findOne({ _id: id, userId: user.userId }).lean();
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    return res.json(collection);
  }

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'PUT') {
    const { title, description, addProduct, removeProductIndex, isPublic } = req.body || {};

    const collection = await Collection.findOne({ _id: id, userId: user.userId });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    if (title !== undefined) collection.title = title.slice(0, 50);
    if (description !== undefined) collection.description = description.slice(0, 200);
    if (isPublic !== undefined) collection.isPublic = Boolean(isPublic);

    if (addProduct) {
      collection.products.push({
        productTitle: addProduct.productTitle || '',
        brand: addProduct.brand || '',
        imageUrl: addProduct.imageUrl || '',
        platform: addProduct.platform || '',
        price: addProduct.price || 0,
        url: addProduct.url || '',
        addedAt: new Date(),
      });
    }

    if (removeProductIndex !== undefined && typeof removeProductIndex === 'number') {
      if (removeProductIndex >= 0 && removeProductIndex < collection.products.length) {
        collection.products.splice(removeProductIndex, 1);
      }
    }

    await collection.save();
    return res.json(collection.toObject());
  }

  if (req.method === 'DELETE') {
    const result = await Collection.findOneAndDelete({ _id: id, userId: user.userId });
    if (!result) return res.status(404).json({ error: 'Collection not found' });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export async function handleCollections(req: VercelRequest, res: VercelResponse, subpath: string) {
  // subpath will be '' for /api/collections, or '/something' for /api/collections/something
  const cleaned = subpath.startsWith('/') ? subpath.slice(1) : subpath;

  if (!cleaned || cleaned === '') {
    return index(req, res);
  }

  // Anything else is treated as an ID
  return byId(req, res, cleaned);
}
