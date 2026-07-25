// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enqueueEvent, getDashboardMetrics } from '../analytics.js';
import type { EventName } from '../models/AnalyticsEvent.js';
import { requireAdmin } from '../adminAuth.js';
import { requireAdmin } from '../adminAuth.js';

const VALID_EVENTS = new Set<EventName>([
  'search_performed', 'search_result_viewed', 'product_card_clicked',
  'product_detail_viewed', 'compare_opened', 'compare_completed',
  'affiliate_link_clicked', 'wishlist_added', 'wishlist_removed',
  'share_clicked', 'price_history_expanded', 'recommendation_clicked',
  'recommendation_section_viewed', 'no_results_search', '404_product',
  'alert_created', 'alert_cancelled', 'alert_triggered', 'alert_opened', 'alert_conversion',
]);

function sanitizeString(v: unknown, maxLen = 200): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.trim().slice(0, maxLen) || undefined;
}

function sanitizeNumber(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * POST /api/analytics/event
 *
 * Accepts a single event or an array of events (batch).
 * Body: { event, sessionId, device?, query?, platform?, canonicalId?,
 *         productTitle?, section?, latencyMs?, resultCount? }
 *       OR array of the above.
 *
 * Always returns 204 — never blocks the client.
 */
async function trackEvent(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Respond immediately — analytics must never slow the user
  res.status(204).end();

  try {
    const body = req.body;
    const events = Array.isArray(body) ? body : [body];

    for (const raw of events) {
      if (!raw || typeof raw !== 'object') continue;
      const eventName = raw.event as EventName;
      if (!VALID_EVENTS.has(eventName)) continue;

      const sessionId = sanitizeString(raw.sessionId, 64);
      if (!sessionId) continue;

      enqueueEvent({
        event:        eventName,
        sessionId,
        device:       raw.device === 'mobile' ? 'mobile' : 'web',
        ts:           new Date(),
        query:        sanitizeString(raw.query, 200),
        platform:     sanitizeString(raw.platform, 50),
        canonicalId:  sanitizeString(raw.canonicalId, 100),
        productTitle: sanitizeString(raw.productTitle, 200),
        section:      sanitizeString(raw.section, 50),
        latencyMs:    sanitizeNumber(raw.latencyMs),
        resultCount:  sanitizeNumber(raw.resultCount),
      });
    }
  } catch {
    // Never throw — analytics is fire-and-forget
  }
}

/**
 * GET /api/analytics/dashboard?days=7
 *
 * Returns aggregated dashboard metrics.
 * Protected by admin check in the route layer.
 */
async function dashboard(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;
  if (!requireAdmin(req, res)) return;

  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);

  try {
    const metrics = await getDashboardMetrics(days);
    return res.json(metrics);
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch analytics', message: e.message });
  }
}

export async function handleAnalytics(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
) {
  switch (subpath.replace(/^\//, '')) {
    case 'event':     return trackEvent(req, res);
    case 'dashboard': return dashboard(req, res);
    default:          return res.status(404).json({ error: 'Not found' });
  }
}
