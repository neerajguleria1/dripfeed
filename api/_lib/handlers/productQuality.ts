/**
 * handlers/productQuality.ts
 *
 * GET  /api/admin/product-quality         — paginated quality list
 * GET  /api/admin/product-quality/summary — aggregate stats only
 *
 * Admin-only (requireAdmin guard). Reads from SearchCache, groups into
 * canonicals, runs the quality scorer, sorts by score ascending (worst first).
 *
 * Query params for list endpoint:
 *   page     (default 1)
 *   limit    (default 20, max 100)
 *   minScore (filter: only return products below this score, default 100)
 *   grade    (filter: A | B | C | D)
 *   sort     (asc | desc, default asc = worst first)
 */

// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../adminAuth.js';
import { computeProductQuality } from '../productQuality.js';
import type { ProductQualityResult } from '../productQuality.js';
import { LRUCache } from '../lruCache.js';

// Cache the full scored list for 10 minutes (scoring 200+ products is expensive)
const CACHE_TTL_MS = 10 * 60 * 1000;
const resultCache = new LRUCache<'results', ProductQualityResult[]>({
  maxSize: 1,
  ttlMs:   CACHE_TTL_MS,
});

async function loadAndScoreAll(): Promise<ProductQualityResult[]> {
  const cached = resultCache.get('results');
  if (cached) return cached;

  const { connectDB }       = await import('../db.js');
  const SearchCache         = (await import('../models/SearchCache.js')).default;
  const { groupSearchResults } = await import('../search.js');

  await connectDB();

  // Fetch the most-recently-updated cache docs (up to 500 unique queries)
  const docs = await SearchCache.find(
    {},
    { results: 1, canonicalIds: 1 },
  )
    .sort({ fetchedAt: -1 })
    .limit(500)
    .lean();

  // Deduplicate by canonicalId across cache documents
  const seen = new Set<string>();
  const allResults: ProductQualityResult[] = [];

  for (const doc of docs) {
    try {
      const canonicals = groupSearchResults(doc.results as any[]);
      for (const canonical of canonicals) {
        if (seen.has(canonical.id)) continue;
        seen.add(canonical.id);
        allResults.push(computeProductQuality(canonical));
      }
    } catch {
      // non-fatal — skip malformed cache doc
    }
  }

  resultCache.set('results', allResults);
  return allResults;
}

/** Invalidate the scored-results cache (call after any data refresh) */
export function invalidateQualityCache() {
  resultCache.delete('results');
}

async function handleList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const page     = Math.max(1, Number(req.query.page) || 1);
  const limit    = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const minScore = req.query.minScore !== undefined ? Number(req.query.minScore) : 100;
  const grade    = typeof req.query.grade === 'string' ? req.query.grade.toUpperCase() : undefined;
  const sortDir  = req.query.sort === 'desc' ? 'desc' : 'asc';

  try {
    let results = await loadAndScoreAll();

    // Filter
    if (minScore < 100) results = results.filter(r => r.score < minScore);
    if (grade && ['A', 'B', 'C', 'D'].includes(grade)) {
      results = results.filter(r => r.grade === grade);
    }

    // Sort
    results = [...results].sort((a, b) =>
      sortDir === 'asc' ? a.score - b.score : b.score - a.score,
    );

    const total = results.length;
    const skip  = (page - 1) * limit;
    const page_items = results.slice(skip, skip + limit);

    return res.json({
      products: page_items,
      total,
      page,
      limit,
      hasMore: skip + page_items.length < total,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to compute quality scores', message: e?.message });
  }
}

async function handleSummary(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  try {
    const results = await loadAndScoreAll();

    const total = results.length;
    const grades = { A: 0, B: 0, C: 0, D: 0 };
    let totalScore = 0;
    const issueFrequency: Record<string, number> = {};

    for (const r of results) {
      grades[r.grade]++;
      totalScore += r.score;
      for (const issue of r.issues) {
        issueFrequency[issue.code] = (issueFrequency[issue.code] ?? 0) + 1;
      }
    }

    // Top 5 most frequent issue codes
    const topIssues = Object.entries(issueFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    return res.json({
      total,
      avgScore:   total > 0 ? Math.round(totalScore / total) : 0,
      grades,
      topIssues,
      poorCount:  grades.D + grades.C,  // products needing attention
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to compute quality summary', message: e?.message });
  }
}

export async function handleProductQuality(
  req: VercelRequest,
  res: VercelResponse,
  subpath: string,
) {
  const path = subpath.replace(/^\//, '');
  if (path === '' || path === 'list') return handleList(req, res);
  if (path === 'summary')             return handleSummary(req, res);
  return res.status(404).json({ error: 'Not found' });
}
