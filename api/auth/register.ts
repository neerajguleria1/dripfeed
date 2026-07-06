import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { connectDB } from '../_lib/db.js';
import { User } from '../_lib/models/User.js';
import { signToken, signRefreshToken } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ email: email.toLowerCase(), password: hashed, name });

  const payload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = signToken(payload);
  const refreshToken = signRefreshToken(payload);

  res.status(201).json({ accessToken, refreshToken, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
}
