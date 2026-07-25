/**
 * alertService.ts
 *
 * Pure alert evaluation engine.
 *
 * Design:
 *   - evaluateAlerts() is the single entry point — called from the price
 *     refresh flow (search.ts) after live prices are fetched.
 *   - Batch-fetches all active alerts for a canonicalId in one query.
 *   - Uses findOneAndUpdate with { status: 'active' } filter to prevent
 *     double-trigger even under concurrent calls.
 *   - Never throws — errors are logged and swallowed so the search
 *     response is never blocked.
 *   - Optional email notification via Resend (same pattern as price-check.ts).
 */

import { connectDB } from './db.js';
import PriceAlert from './models/PriceAlert.js';
import type { IPriceAlert } from './models/PriceAlert.js';
import { enqueueEvent } from './analytics.js';

// ─── Chunk helper ─────────────────────────────────────────────────────────────
// Splits an array into sequential chunks of `size`.
// Used to batch alert evaluation so a flash-sale with 500 simultaneous
// triggers never fires 500 concurrent DB writes — Atlas M0 has a 500
// connection limit and unbounded Promise.all would saturate it.
const TRIGGER_CHUNK_SIZE = 50;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Dashboard aggregation timeout ───────────────────────────────────────────
const ALERT_DASHBOARD_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Alert dashboard aggregation timed out')), ALERT_DASHBOARD_TIMEOUT_MS)
    ),
  ]);
}

// ─── Email (optional — only fires if RESEND_API_KEY is set) ──────────────────

async function sendAlertEmail(alert: IPriceAlert, latestPrice: number): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !alert.email) return;

  const savings = alert.currentPrice - latestPrice;
  const pct = Math.round((savings / alert.currentPrice) * 100);
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'TagCheck <onboarding@resend.dev>',
      to: alert.email,
      subject: `🔔 Price alert triggered — ${alert.productTitle}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#C9A96E">Your Price Alert Triggered! 🎉</h2>
        <p><strong>${alert.productTitle}</strong> dropped to your target price.</p>
        <p style="font-size:22px">
          <s style="color:#999">${fmt(alert.currentPrice)}</s> →
          <strong style="color:#0F0F1A">${fmt(latestPrice)}</strong>
          <span style="color:#22C55E">(${pct}% off)</span>
        </p>
        <p style="color:#666;font-size:13px">You set an alert for ${fmt(alert.targetPrice)}.</p>
        <a href="https://dripfeed-v21.vercel.app/product/${alert.canonicalId}"
           style="display:inline-block;background:#C9A96E;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:600;margin-top:16px">
          View Deal →
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          You're receiving this because you set a price alert on TagCheck.
        </p>
      </div>`,
    }),
  });
}

// ─── Core evaluation ──────────────────────────────────────────────────────────

export interface EvaluationResult {
  checked:   number;
  triggered: number;
}

/**
 * Evaluate all active alerts for a canonical product against its latest price.
 * Called fire-and-forget from the search/refresh pipeline.
 *
 * @param canonicalId  The canonical product ID
 * @param latestPrice  The freshly-scraped lowest price
 */
export async function evaluateAlerts(
  canonicalId: string,
  latestPrice: number,
): Promise<EvaluationResult> {
  const result: EvaluationResult = { checked: 0, triggered: 0 };
  if (!canonicalId || !Number.isFinite(latestPrice) || latestPrice <= 0) return result;

  try {
    await connectDB();

    // Fetch all active alerts for this product in one query
    const alerts = await PriceAlert.find({ canonicalId, status: 'active' });
    result.checked = alerts.length;
    if (!alerts.length) return result;

    const now = new Date();
    const toTrigger = alerts.filter(a => latestPrice <= a.targetPrice);

    if (!toTrigger.length) {
      // Just update lastChecked in bulk — non-critical, fire-and-forget
      PriceAlert.updateMany(
        { canonicalId, status: 'active' },
        { $set: { lastChecked: now } },
      ).catch(() => {});
      return result;
    }

    // Trigger matching alerts in chunks of TRIGGER_CHUNK_SIZE to bound
    // concurrent DB writes and avoid saturating the Atlas M0 connection pool.
    for (const batch of chunk(toTrigger, TRIGGER_CHUNK_SIZE)) {
      await Promise.all(
        batch.map(async alert => {
          const updated = await PriceAlert.findOneAndUpdate(
            { _id: alert._id, status: 'active' }, // atomic guard
            { $set: { status: 'triggered', triggeredAt: now, lastChecked: now } },
            { new: true },
          );
          if (!updated) return; // already triggered by a concurrent call

          result.triggered++;

          // Fire analytics event
          enqueueEvent({
            event: 'alert_triggered',
            sessionId: alert.sessionId,
            device: 'web',
            ts: now,
            canonicalId,
            productTitle: alert.productTitle,
          });

          // Send email notification (fire-and-forget)
          sendAlertEmail(alert, latestPrice).catch(() => {});
        }),
      );
    }

    // Update lastChecked on non-triggered alerts
    const triggeredIds = toTrigger.map(a => a._id);
    PriceAlert.updateMany(
      { canonicalId, status: 'active', _id: { $nin: triggeredIds } },
      { $set: { lastChecked: now } },
    ).catch(() => {});

  } catch (e: any) {
    console.error('[alertService] evaluateAlerts error:', e?.message?.slice(0, 120));
  }

  return result;
}

// ─── Dashboard aggregations ───────────────────────────────────────────────────

export interface AlertDashboardMetrics {
  total:              number;
  active:             number;
  triggered:          number;
  cancelled:          number;
  conversionRate:     number;  // triggered / total * 100
  avgTargetDiscount:  number;  // avg % below currentPrice
  topAlertedProducts: { canonicalId: string; productTitle: string; count: number }[];
}

export async function getAlertDashboardMetrics(): Promise<AlertDashboardMetrics> {
  await connectDB();

  const [counts, topProducts] = await withTimeout(Promise.all([
    PriceAlert.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    PriceAlert.aggregate<{ _id: string; productTitle: string; count: number }>([
      { $group: { _id: '$canonicalId', productTitle: { $first: '$productTitle' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]));

  const countMap: Record<string, number> = {};
  for (const c of counts) countMap[c._id] = c.count;

  const total     = Object.values(countMap).reduce((s, n) => s + n, 0);
  const triggered = countMap['triggered'] ?? 0;
  const active    = countMap['active']    ?? 0;
  const cancelled = countMap['cancelled'] ?? 0;

  // Average target discount — separate query, also timeout-guarded
  const [discountResult] = await withTimeout(PriceAlert.aggregate<{ avg: number }>([
    { $match: { status: { $in: ['active', 'triggered'] } } },
    {
      $project: {
        discount: {
          $multiply: [
            { $divide: [{ $subtract: ['$currentPrice', '$targetPrice'] }, '$currentPrice'] },
            100,
          ],
        },
      },
    },
    { $group: { _id: null, avg: { $avg: '$discount' } } },
  ]));

  return {
    total,
    active,
    triggered,
    cancelled,
    conversionRate:     total > 0 ? Math.round((triggered / total) * 100 * 10) / 10 : 0,
    avgTargetDiscount:  discountResult ? Math.round(discountResult.avg * 10) / 10 : 0,
    topAlertedProducts: topProducts.map(p => ({
      canonicalId:  p._id,
      productTitle: p.productTitle,
      count:        p.count,
    })),
  };
}
