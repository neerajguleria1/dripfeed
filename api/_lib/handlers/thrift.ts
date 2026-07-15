// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import { getUserFromRequest } from '../auth.js';
import ThriftListing from '../models/ThriftListing.js';

// --- List / Create ---

async function index(req: VercelRequest, res: VercelResponse) {
  await connectDB();

  if (req.method === 'GET') {
    const {
      category,
      size,
      city,
      condition,
      minPrice,
      maxPrice,
      page = '1',
      limit = '12',
    } = req.query;

    const filter: Record<string, unknown> = { status: 'active' };
    if (category && typeof category === 'string') filter.category = category;
    if (size && typeof size === 'string') filter.size = size;
    if (city && typeof city === 'string') filter.city = new RegExp(city as string, 'i');
    if (condition && typeof condition === 'string') filter.condition = condition;
    if (req.query.q && typeof req.query.q === 'string') {
      filter.title = new RegExp(req.query.q.trim(), 'i');
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) (filter.price as any).$gte = Number(minPrice);
      if (maxPrice) (filter.price as any).$lte = Number(maxPrice);
    }

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const [listings, total] = await Promise.all([
      ThriftListing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      ThriftListing.countDocuments(filter),
    ]);

    return res.json({
      listings,
      total,
      page: pageNum,
      hasMore: skip + limitNum < total,
    });
  }

  if (req.method === 'POST') {
    const user = getUserFromRequest(req);
    const { title, brand, category, size, condition, price, description, images, city, whatsappNumber } = req.body || {};

    if (!title || !category || !size || !condition || !price || !city || !whatsappNumber) {
      return res.status(400).json({ error: 'Missing required fields: title, category, size, condition, price, city, whatsappNumber' });
    }

    if (images && images.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 images allowed' });
    }

    const mongoose = await import('mongoose');
    const listing = await ThriftListing.create({
      sellerId: user?.userId || new mongoose.Types.ObjectId(),
      title,
      brand,
      category,
      size,
      condition,
      price: Number(price),
      description,
      images: images || [],
      city,
      whatsappNumber,
    });

    return res.status(201).json(listing.toObject());
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// --- Single Listing by ID ---

async function byId(req: VercelRequest, res: VercelResponse, id: string) {
  await connectDB();

  if (!id) return res.status(400).json({ error: 'Missing ID' });

  if (req.method === 'GET') {
    const listing = await ThriftListing.findById(id).lean();
    if (!listing || listing.status === 'removed') {
      return res.status(404).json({ error: 'Listing not found' });
    }
    return res.json(listing);
  }

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'PUT') {
    const listing = await ThriftListing.findOne({ _id: id, sellerId: user.userId });
    if (!listing) return res.status(404).json({ error: 'Listing not found or unauthorized' });

    const { title, brand, category, size, condition, price, description, images, city, whatsappNumber } = req.body || {};

    if (title !== undefined) listing.title = title;
    if (brand !== undefined) listing.brand = brand;
    if (category !== undefined) listing.category = category;
    if (size !== undefined) listing.size = size;
    if (condition !== undefined) listing.condition = condition;
    if (price !== undefined) listing.price = Number(price);
    if (description !== undefined) listing.description = description;
    if (images !== undefined) listing.images = images.slice(0, 5);
    if (city !== undefined) listing.city = city;
    if (whatsappNumber !== undefined) listing.whatsappNumber = whatsappNumber;

    await listing.save();
    return res.json(listing.toObject());
  }

  if (req.method === 'PATCH') {
    const listing = await ThriftListing.findOne({ _id: id, sellerId: user.userId });
    if (!listing) return res.status(404).json({ error: 'Listing not found or unauthorized' });

    listing.status = 'sold';
    await listing.save();
    return res.json(listing.toObject());
  }

  if (req.method === 'DELETE') {
    const listing = await ThriftListing.findOne({ _id: id, sellerId: user.userId });
    if (!listing) return res.status(404).json({ error: 'Listing not found or unauthorized' });

    listing.status = 'removed';
    await listing.save();
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export async function handleThrift(req: VercelRequest, res: VercelResponse, subpath: string) {
  const cleaned = subpath.startsWith('/') ? subpath.slice(1) : subpath;

  if (!cleaned || cleaned === '') {
    return index(req, res);
  }

  return byId(req, res, cleaned);
}
