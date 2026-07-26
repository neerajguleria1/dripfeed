/**
 * handlers/catalogHealth.ts
 *
 * Admin-only catalog health dashboard endpoints.
 *
 * GET /api/admin/catalog-health         — full health summary
 * GET /api/admin/catalog-health/poor    — products scoring < 40 (paginated)
 * POST /api/admin/catalog-health/trigger — trigger enrichment run immediately
 *
 * All endpoints require admin JWT.
 * Summary is cached in-process for 5 minutes to avoid hammering MongoDB.
 */

// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../adminAuth.js';
import { LRUCache } from '../lruCache.js';
import type { CatalogHealthSummary } from '../catalogEnrichment.js';

const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;
const summaryCache = new LRUCache<'summary', CatalogHealthSummary>({
  maxSize: 1,
  ttlMs:   SUMMARY_CACHE_TTL_MS,
});

async function buildHealthSummary(): Promise<CatalogHealthSummary> {
  const cached = summaryCache.get('summary');
  if (cached) return cached;

  const { connectDB }  = await import('../db.js');
  const CatalogEntry   = (await import('../models/CatalogEntry.js')).default;

  await connectDB();

  const [
    total,
    excellent,
    good,
    fair,
    poor,
    missingImage,
    missingBrand,
    missingCategory,
    needsEnrichment,
    staleCount,
  ] = await Promise.all([
    CatalogEntry.estimatedDocumentCount(),
    CatalogEntry.countDocuments({ completenessScore: { $gte: 80 } }),
    CatalogEntry.countDocuments({ completenessScore: { $gte: 60, $lt: 80 } }),
    CatalogEntry.countDocuments({ completenessScore: { $gte: 40, $lt: 60 } }),
    CatalogEntry.countDocuments({ completenessScore: { $lt: 40 } }),
    CatalogEntry.countDocuments({ imageUrl: { $exists: false } }),
    CatalogEntry.countDocuments({ normalizedBrand: { $exists: false } }),
    CatalogEntry.countDocuments({ category: { $exists: false } }),
    CatalogEntry.countDocuments({ needsEnrichment: true }),
    CatalogEntry.countDocuments({
      lastEnrichedAt: { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    }),
  ]);

  // Aggregate total score sum for average
  const scoreAgg = await CatalogEntry.aggregate([
    { $group: { _id: null, totalScore: { $sum: '$completenessScore' }, count: { $sum: 1 } } },
  ]);
  const avgCompleteness = scoreAgg[0]?.count > 0
    ? Math.round(scoreAgg[0].totalScore / scoreAgg[0].count)
    : 0;

  const topMissingFields: Array<{ field: string; count: number }> = [
    { field: 'image',    count: missingImage },
    { field: 'brand',    count: missingBrand },
    { field: 'category', count: missingCategory },
  ]
    .filter(f => f.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const summary: CatalogHealthSummary = {
    total,
    avgCompleteness,
    grades: { excellent, good, fair, poor },
    missingImage,
    missingBrand,
    missingCategory,
    needsEnrichment,
    staleCount,
    poorCount: poor,
    topMissingFields,
  };

  summaryCache.set('summary', summary);
  return summary;
}

async function handleSummary(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    const summary = await buildHealthSummary();
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json(summary);
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to build catalog health summary', message: e?.message });
  }
}

async function handlePoor(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const page  = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip  = (page - 1) * limit;

  try {
    const { connectDB } = await import('../db.js');
    const CatalogEntry  = (await import('../models/CatalogEntry.js')).default;
    await connectDB();

    const [products, total] = await Promise.all([
      CatalogEntry.find({ completenessScore: { $lt: 40 } })
        .sort({ completenessScore: 1, lastEnrichedAt: 1 })
        .skip(skip)
        .limit(limit)
        .select('canonicalId displayTitle normalizedBrand category imageUrl completenessScore breakdown flags platforms offerCount lastEnrichedAt needsEnrichment')
        .lean(),
      CatalogEntry.countDocuments({ completenessScore: { $lt: 40 } }),
    ]);

    return res.json({ products, total, page, limit, hasMore: skip + products.length < total });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch poor products', message: e?.message });
  }
}

async function handleTrigger(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    // Import and call the cron handler directly — reuse exact same logic
    const cronHandler = (await import('../../cron/catalog-enrich.js')).default;
    // Simulate GET request to cron handler
    const fakeReq = { method: 'GET', headers: req.headers } as any;
    const chunks: any[] = [];
    const fakeRes = {
      status: () => fakeRes,
      json: (data: any) => { chunks.push(data); },
      setHeader: () => {},
    } as any;
    await cronHandler(fakeReq, fakeRes);
    summaryCache.delete('summary'); // bust cache after enrichment
    return res.json({ triggered: true, result: chunks[0] ?? null });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to trigger enrichment', message: e?.message });
  }
}

export async function handleCatalogHealth(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
) {
  const path = (subpath || '').replace(/^\//, '');
  if (path === '' || path === 'summary') return handleSummary(req, res);
  if (path === 'poor')                   return handlePoor(req, res);
  if (path === 'trigger')                return handleTrigger(req, res);
  return res.status(404).json({ error: 'Not found' });
}
