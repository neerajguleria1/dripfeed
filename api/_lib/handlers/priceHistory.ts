// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPriceHistory, getPriceStats } from '../priceHistory.js';

// Max days is capped at retention window (default 90)
const MAX_DAYS = parseInt(process.env.PRICE_HISTORY_RETENTION_DAYS ?? '90', 10) || 90;
const VALID_DAYS = new Set([30, 90].filter(d => d <= MAX_DAYS));

/**
 * GET /api/price-history/:canonicalId?days=30&platform=amazon
 *
 * Returns chronological price history points.
 * days: 30 | 90  (capped at PRICE_HISTORY_RETENTION_DAYS)
 * platform: optional lowercase filter
 */
async function history(req: VercelRequest, res: VercelResponse, canonicalId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rawDays = parseInt((req.query.days as string) || '30', 10);
  const days    = (VALID_DAYS.has(rawDays) ? rawDays : 30) as 30 | 90;
  const platform = (req.query.platform as string | undefined)?.toLowerCase();

  try {
    const points = await getPriceHistory(canonicalId, days, platform);
    return res.json({ canonicalId, days, platform: platform ?? 'all', points });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch price history', message: e.message });
  }
}

/**
 * GET /api/price-history/:canonicalId/stats?platform=amazon
 *
 * Returns aggregate stats: lowestPrice, highestPrice, latestPrice,
 * firstSeen, lastUpdated.
 */
async function stats(req: VercelRequest, res: VercelResponse, canonicalId: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const platform = (req.query.platform as string | undefined)?.toLowerCase();

  try {
    const result = await getPriceStats(canonicalId, platform);
    if (!result) return res.status(404).json({ error: 'No history found for this product' });
    return res.json({ canonicalId, platform: platform ?? 'all', ...result });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch price stats', message: e.message });
  }
}

/**
 * Route dispatcher — mounted at /api/price-history/ in [[...route]].ts
 *
 * /api/price-history/:canonicalId          → history
 * /api/price-history/:canonicalId/stats    → stats
 */
export async function handlePriceHistory(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
) {
  const parts       = subpath.replace(/^\//, '').split('/');
  const canonicalId = parts[0];
  const action      = parts[1] ?? '';

  if (!canonicalId) return res.status(400).json({ error: 'canonicalId is required' });

  switch (action) {
    case '':
    case 'history': return history(req, res, canonicalId);
    case 'stats':   return stats(req, res, canonicalId);
    default:        return res.status(404).json({ error: 'Not found' });
  }
}
