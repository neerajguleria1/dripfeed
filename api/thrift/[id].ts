import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import { getUserFromRequest } from '../_lib/auth.js';
import ThriftListing from '../_lib/models/ThriftListing.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing ID' });

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
    // Mark as sold
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
