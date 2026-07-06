import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db';
import { getUserFromRequest } from '../_lib/auth';
import Collection from '../_lib/models/Collection';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing ID' });

  if (req.method === 'GET') {
    const shareToken = req.query.shareToken as string | undefined;

    // Public access via share token
    if (shareToken) {
      const collection = await Collection.findOne({ _id: id, shareToken, isPublic: true }).lean();
      if (!collection) return res.status(404).json({ error: 'Collection not found' });
      return res.json(collection);
    }

    // Authenticated owner access
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
