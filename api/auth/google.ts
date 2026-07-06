import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OAuth2Client } from 'google-auth-library';
import { connectDB } from '../_lib/db.js';
import { User } from '../_lib/models/User.js';
import { signToken, signRefreshToken } from '../_lib/auth.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Google token required' });

  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
    const { sub: googleId, email, name } = ticket.getPayload()!;

    await connectDB();

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      user = await User.create({ email, name: name || email!.split('@')[0], googleId });
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const payload = { userId: user._id.toString(), email: user.email, role: user.role };
    const accessToken = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({ accessToken, refreshToken, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
  } catch (e: any) {
    res.status(401).json({ error: 'Invalid Google token' });
  }
}
