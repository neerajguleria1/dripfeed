import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import { User } from '../_lib/models/User.js';
import { getUserFromRequest } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = getUserFromRequest(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });

  await connectDB();
  const user = await User.findById(payload.userId).select('-password');
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ user: { id: user._id, email: user.email, name: user.name, role: user.role } });
}
