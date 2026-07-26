/**
 * api/cron/catalog-enrich.ts
 *
 * GET /api/cron/catalog-enrich
 * Called every 2 hours by Vercel Cron.
 *
 * Catalog Intelligence background enrichment job.
 * Reads from SearchCache → enriches → upserts to CatalogEntry.
 *
 * ── Design ────────────────────────────────────────────────────────────────────
 *   - Processes one batch per run (configurable via CATALOG_BATCH_SIZE env).
 *   - Resumable: always picks the oldest un-enriched entries first.
 *   - Idempotent: upsert by canonicalId — safe to re-run on the same data.
 *   - Never touches the live search pipeline.
 *   - Stays within Vercel's 60s cron function limit.
 *
 * ── Batch strategy ───────────────────────────────────────────────────────────
 *   1. Scan SearchCache (recent docs, last 24h) for canonical IDs.
 *   2. For each canonical, find or check CatalogEntry.
 *   3. Process only entries where needsEnrichment=true OR not yet in catalog.
 *   4. Enrich via enrichCanonical() (pure, no DB calls).
 *   5. Bulk upsert results to CatalogEntry.
 */

// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import SearchCache from '../_lib/models/SearchCache.js';
import CatalogEntry from '../_lib/models/CatalogEntry.js';
import { enrichCanonical } from '../_lib/catalogEnrichment.js';
import { groupSearchResults } from '../_lib/search.js';

const BATCH_SIZE = Number(process.env.CATALOG_BATCH_SIZE) || 50;
const MAX_DURATION_MS = 45_000; // stay under 60s vercel limit

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  console.log('[catalog-enrich] starting run at', new Date().toISOString());

  try {
    await connectDB();

    // ── Step 1: Find CatalogEntry IDs that need enrichment ──────────────────
    // Prefer: needsEnrichment=true, then oldest lastEnrichedAt
    const toProcess = await CatalogEntry.find(
      { needsEnrichment: true },
      { canonicalId: 1 },
    )
      .sort({ lastEnrichedAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    // Also scan SearchCache for *new* canonical IDs not yet in CatalogEntry
    const recentCaches = await SearchCache.find(
      { fetchedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      { query: 1, results: 1, canonicalIds: 1 },
    )
      .sort({ fetchedAt: -1 })
      .limit(20)
      .lean();

    // Build a map of canonicalId → {canonical, sourceQuery}
    const canonicalMap = new Map<string, { canonical: any; sourceQuery: string }>();

    for (const doc of recentCaches) {
      if (Date.now() - startTime > MAX_DURATION_MS * 0.4) break; // leave time for writes
      try {
        const canonicals = groupSearchResults(doc.results as any[]);
        for (const c of canonicals) {
          if (!canonicalMap.has(c.id)) {
            canonicalMap.set(c.id, { canonical: c, sourceQuery: doc.query });
          }
        }
      } catch { /* skip malformed doc */ }
    }

    // Merge: process the CatalogEntry backlog first, then new IDs
    const existingIds   = new Set(toProcess.map((e: any) => e.canonicalId));
    const newIds        = [...canonicalMap.keys()].filter(id => !existingIds.has(id));
    const allToProcess  = [...toProcess.map((e: any) => e.canonicalId), ...newIds.slice(0, BATCH_SIZE - toProcess.length)];

    if (allToProcess.length === 0) {
      console.log('[catalog-enrich] nothing to process');
      return res.json({ processed: 0, skipped: 0, duration: `${Date.now() - startTime}ms` });
    }

    // ── Step 2: Enrich + bulk upsert ─────────────────────────────────────────
    const ops: any[] = [];
    let enriched = 0;
    let skipped  = 0;

    for (const canonicalId of allToProcess) {
      if (Date.now() - startTime > MAX_DURATION_MS) break;

      const entry = canonicalMap.get(canonicalId);
      if (!entry) { skipped++; continue; }

      try {
        const enriched_entry = enrichCanonical({
          canonical:   entry.canonical,
          sourceQuery: entry.sourceQuery,
        });

        ops.push({
          updateOne: {
            filter:  { canonicalId },
            update:  {
              $set: {
                ...enriched_entry,
                lastEnrichedAt: new Date(),
                needsEnrichment: enriched_entry.completenessScore < 50,
              },
            },
            upsert:  true,
          },
        });
        enriched++;
      } catch (e: any) {
        console.warn(`[catalog-enrich] failed to enrich ${canonicalId}:`, e?.message?.slice(0, 80));
        skipped++;
      }
    }

    if (ops.length > 0) {
      await CatalogEntry.bulkWrite(ops, { ordered: false });
    }

    const duration = Date.now() - startTime;
    console.log(`[catalog-enrich] done — enriched=${enriched} skipped=${skipped} ops=${ops.length} duration=${duration}ms`);

    return res.json({
      success:   true,
      enriched,
      skipped,
      ops:       ops.length,
      duration:  `${duration}ms`,
      batchSize: BATCH_SIZE,
    });
  } catch (e: any) {
    console.error('[catalog-enrich] fatal error:', e?.message);
    return res.status(500).json({ error: 'Catalog enrichment failed', message: e?.message });
  }
}
