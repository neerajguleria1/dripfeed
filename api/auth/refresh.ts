import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken, signToken } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const payload = verifyToken(refreshToken);
    const accessToken = signToken({ userId: payload.userId, email: payload.email, role: payload.role });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}
