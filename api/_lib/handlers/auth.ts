// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { connectDB } from '../db.js';
import { User } from '../models/User.js';
import { UserPreferences } from '../models/UserPreferences.js';
import { WishlistItem } from '../models/WishlistItem.js';
import Collection from '../models/Collection.js';
import { signToken, signRefreshToken, verifyToken, getUserFromRequest } from '../auth.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function google(req: VercelRequest, res: VercelResponse) {
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

async function login(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { userId: user._id.toString(), email: user.email, role: user.role };
    const accessToken = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.json({ accessToken, refreshToken, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
  } catch (e: any) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Login failed', message: e.message || 'Internal error' });
  }
}

async function me(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = getUserFromRequest(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });

  await connectDB();
  const user = await User.findById(payload.userId).select('-password');
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ user: { id: user._id, email: user.email, name: user.name, role: user.role } });
}

async function refresh(req: VercelRequest, res: VercelResponse) {
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

async function register(req: VercelRequest, res: VercelResponse) {
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

async function deleteAccount(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const payload = getUserFromRequest(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });

  try {
    await connectDB();
    const userId = payload.userId;

    // Delete all user data in parallel
    await Promise.all([
      User.findByIdAndDelete(userId),
      UserPreferences.deleteMany({ userId }),
      WishlistItem.deleteMany({ userId }),
      Collection.deleteMany({ userId }),
    ]);

    res.json({ success: true, message: 'Account deleted' });
  } catch (e: any) {
    console.error('Delete account error:', e);
    res.status(500).json({ error: 'Failed to delete account', message: e.message || 'Internal error' });
  }
}

export async function handleAuth(req: VercelRequest, res: VercelResponse, subpath: string) {
  switch (subpath) {
    case 'google': return google(req, res);
    case 'login': return login(req, res);
    case 'me': return me(req, res);
    case 'refresh': return refresh(req, res);
    case 'register': return register(req, res);
    case 'delete-account': return deleteAccount(req, res);
    default: return res.status(404).json({ error: 'Not found' });
  }
}
