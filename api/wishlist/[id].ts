import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import { WishlistItem } from '../_lib/models/WishlistItem.js';
import { getUserFromRequest } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID required' });

  await connectDB();

  if (req.method === 'DELETE') {
    const item = await WishlistItem.findOneAndDelete({ _id: id, userId: user.userId });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
