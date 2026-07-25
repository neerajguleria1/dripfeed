// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import PriceAlert from '../models/PriceAlert.js';
import { enqueueEvent } from '../analytics.js';
import { getAlertDashboardMetrics } from '../alertService.js';
import { requireAdmin } from '../adminAuth.js';
import { checkRateLimit } from '../rateLimit.js';

function sanitize(v: unknown, max = 200): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.trim().slice(0, max) || undefined;
}

function sanitizeEmail(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const e = v.trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
}

// ─── POST /api/alerts/create ──────────────────────────────────────────────────

// Rate limit: max 10 alert creations per sessionId per hour.
// Prevents a single session from flooding the PriceAlert collection and
// exhausting Atlas M0's storage/connection budget.
const ALERT_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };

async function createAlert(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { canonicalId, targetPrice, currentPrice, sessionId, productTitle, email, platform, imageUrl } = req.body ?? {};

  const sid = sanitize(sessionId, 64);
  if (!sid) return res.status(400).json({ error: 'sessionId required' });

  // Rate limit check — keyed on sessionId, applied before any DB access
  if (!checkRateLimit(sid, ALERT_RATE_LIMIT)) {
    return res.status(429).json({ error: 'Too many alerts. Try again later.' });
  }

  const cid = sanitize(canonicalId, 100);
  if (!cid) return res.status(400).json({ error: 'canonicalId required' });

  const title = sanitize(productTitle, 200);
  if (!title) return res.status(400).json({ error: 'productTitle required' });

  const target  = Number(targetPrice);
  const current = Number(currentPrice);
  if (!Number.isFinite(target) || target <= 0)   return res.status(400).json({ error: 'Invalid targetPrice' });
  if (!Number.isFinite(current) || current <= 0) return res.status(400).json({ error: 'Invalid currentPrice' });
  if (target >= current) return res.status(400).json({ error: 'targetPrice must be below currentPrice' });

  try {
    await connectDB();

    // Duplicate check — one active alert per (sessionId, canonicalId)
    const existing = await PriceAlert.findOne({ sessionId: sid, canonicalId: cid, status: 'active' });
    if (existing) {
      return res.status(409).json({
        error: 'duplicate',
        message: 'You already have an active alert for this product.',
        alert: existing,
      });
    }

    const alert = await PriceAlert.create({
      canonicalId:  cid,
      targetPrice:  target,
      currentPrice: current,
      sessionId:    sid,
      productTitle: title,
      email:        sanitizeEmail(email),
      platform:     sanitize(platform, 50),
      imageUrl:     sanitize(imageUrl, 500),
    });

    enqueueEvent({
      event: 'alert_created',
      sessionId: sid,
      device: 'web',
      ts: new Date(),
      canonicalId: cid,
      productTitle: title,
    });

    return res.status(201).json({ alert });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to create alert', message: e.message });
  }
}

// ─── GET /api/alerts/status?canonicalId=&sessionId= ──────────────────────────

async function getAlertStatus(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const cid = sanitize(req.query.canonicalId as string, 100);
  const sid = sanitize(req.query.sessionId as string, 64);
  if (!cid || !sid) return res.status(400).json({ error: 'canonicalId and sessionId required' });

  try {
    await connectDB();
    const alert = await PriceAlert.findOne(
      { canonicalId: cid, sessionId: sid },
      { status: 1, targetPrice: 1, triggeredAt: 1, createdAt: 1, _id: 0 },
    )
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ alert: alert ?? null });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch alert status', message: e.message });
  }
}

// ─── POST /api/alerts/cancel ──────────────────────────────────────────────────

async function cancelAlert(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const cid = sanitize(req.body?.canonicalId, 100);
  const sid = sanitize(req.body?.sessionId, 64);
  if (!cid || !sid) return res.status(400).json({ error: 'canonicalId and sessionId required' });

  try {
    await connectDB();
    const result = await PriceAlert.findOneAndUpdate(
      { canonicalId: cid, sessionId: sid, status: 'active' },
      { $set: { status: 'cancelled' } },
      { new: true },
    );

    if (!result) return res.status(404).json({ error: 'No active alert found' });

    enqueueEvent({
      event: 'alert_cancelled',
      sessionId: sid,
      device: 'web',
      ts: new Date(),
      canonicalId: cid,
      productTitle: result.productTitle,
    });

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to cancel alert', message: e.message });
  }
}

// ─── GET /api/alerts/dashboard ────────────────────────────────────────────────

async function dashboard(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!requireAdmin(req, res)) return;
  try {
    const metrics = await getAlertDashboardMetrics();
    return res.json(metrics);
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch alert metrics', message: e.message });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function handleAlerts(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
) {
  const path = subpath.replace(/^\//, '');
  if (path === 'create')    return createAlert(req, res);
  if (path === 'status')    return getAlertStatus(req, res);
  if (path === 'cancel')    return cancelAlert(req, res);
  if (path === 'dashboard') return dashboard(req, res);
  return res.status(404).json({ error: 'Not found' });
}
