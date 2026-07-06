import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db';
import { getUserFromRequest } from '../_lib/auth';
import ThriftListing from '../_lib/models/ThriftListing';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { title, brand, category, size, condition, price, description, images, city, whatsappNumber } = req.body || {};

    if (!title || !category || !size || !condition || !price || !city || !whatsappNumber) {
      return res.status(400).json({ error: 'Missing required fields: title, category, size, condition, price, city, whatsappNumber' });
    }

    if (images && images.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 images allowed' });
    }

    const listing = await ThriftListing.create({
      sellerId: user.userId,
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
