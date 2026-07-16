import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { getUserFromRequest } from '../auth.js';

/**
 * GET  /api/push/vapid-key         -> { publicKey } (no auth required, needed before subscribing)
 * POST /api/push/subscribe         -> save/update a browser push subscription for the logged-in user
 * POST /api/push/unsubscribe       -> remove a subscription (by endpoint)
 */
export async function handlePush(req: VercelRequest, res: VercelResponse, subpath: string) {
  const cleaned = subpath.startsWith('/') ? subpath.slice(1) : subpath;

  if (cleaned === 'vapid-key' && req.method === 'GET') {
    const publicKey = process.env.VAPID_PUBLIC_KEY || null;
    return res.json({ publicKey });
  }

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  await connectDB();

  if (cleaned === 'subscribe' && req.method === 'POST') {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'endpoint and keys (p256dh, auth) required' });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: user.userId, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      { upsert: true, new: true }
    );
    return res.json({ success: true });
  }

  if (cleaned === 'unsubscribe' && req.method === 'POST') {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await PushSubscription.deleteOne({ endpoint, userId: user.userId });
    return res.json({ success: true });
  }

  return res.status(404).json({ error: 'Not found' });
}
