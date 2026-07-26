/**
 * handlers/pricePrediction.ts
 *
 * GET /api/price-prediction/:canonicalId?platform=amazon
 *
 * Fetches price history and active deal data from existing DB collections,
 * then calls the deterministic prediction engine.
 * No external ML — pure statistical computation.
 */

// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPriceHistory } from '../priceHistory.js';
import { getPricePrediction } from '../pricePrediction.js';

export async function handlePricePrediction(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const canonicalId = subpath.replace(/^\//, '').split('/')[0];
  if (!canonicalId || canonicalId.length < 3) {
    res.status(400).json({ error: 'canonicalId is required' });
    return;
  }

  const platform = typeof req.query.platform === 'string'
    ? req.query.platform.trim().toLowerCase()
    : undefined;

  try {
    const { connectDB } = await import('../db.js');
    await connectDB();

    // ── Fetch price history (reuse existing function) ─────────────────────
    const points = await getPriceHistory(canonicalId, 90, platform);

    // ── Current price — latest snapshot ──────────────────────────────────
    const currentPrice = points.length > 0
      ? points[points.length - 1].price
      : 0;

    // ── Check for active deal (uses Deal model, non-fatal if absent) ──────
    let hasActiveDeal = false;
    try {
      const Deal = (await import('../models/Deal.js')).default;
      // We don't store canonicalId on deals — match by checking if any active
      // deal's dropPercentage > 5 was detected in last 14 days. This is a
      // platform-level heuristic since the Deal collection doesn't have canonicalId.
      // For now, assume no deal signal (we can't reliably match without canonicalId).
      // The prediction engine still uses trend/momentum which is more reliable.
      hasActiveDeal = false; // conservative — avoid false positives
    } catch {
      // non-fatal
    }

    if (points.length === 0) {
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
      res.json({
        verdict:      'UNKNOWN',
        confidence:   0,
        reason:       'No price history available for this product yet.',
        signals:      null,
        generatedAt:  Date.now(),
        cached:       false,
      });
      return;
    }

    const prediction = getPricePrediction({
      canonicalId,
      platform,
      points,
      currentPrice,
      hasActiveDeal,
    });

    // Cache at CDN layer for 1h (prediction TTL is 4h in the LRU cache)
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    res.json(prediction);
  } catch (e: any) {
    console.error('[pricePrediction handler] error:', e?.message?.slice(0, 100));
    res.status(500).json({
      error:   'Failed to compute price prediction',
      message: e?.message,
    });
  }
}
