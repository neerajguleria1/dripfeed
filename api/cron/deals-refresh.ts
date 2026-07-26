import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import Deal from '../_lib/models/Deal.js';

/**
 * GET /api/cron/deals-refresh
 * Called every 6 hours. Deactivates expired deals (older than 48h).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[deals-refresh] starting run at', new Date().toISOString());

  try {
    await connectDB();

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const result = await Deal.updateMany(
      { active: true, detectedAt: { $lt: cutoff } },
      { $set: { active: false } }
    );

    console.log(`[deals-refresh] completed — deactivated ${result.modifiedCount} expired deals`);
    return res.json({ cleaned: result.modifiedCount });
  } catch (e: any) {
    console.error('[deals-refresh] error:', e?.message);
    return res.status(500).json({ error: 'Deals refresh failed', message: e.message });
  }
}
