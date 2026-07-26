/**
 * similarProducts.ts
 *
 * SimilarProductService — cross-query similar product engine.
 *
 * ── Strategy ──────────────────────────────────────────────────────────────────
 * The existing `buildRecommendations` engine already implements all weighted
 * scoring (brand, tokens, gender, color, price proximity, discount, rating).
 * This service feeds it a cross-query candidate pool instead of a single-query
 * pool, then returns only the `similar` section capped at SIMILAR_LIMIT.
 *
 * ── Pool construction (no N+1) ────────────────────────────────────────────────
 * 1. Fast path: find the source canonical via the `canonicalIds` sparse index
 *    (single O(1) index scan — same path as productDetail.ts).
 * 2. Candidate pool: fetch the most recent POOL_DOC_LIMIT SearchCache docs,
 *    group each into canonicals, deduplicate by id, exclude the source.
 *    All in one `find().limit()` — no per-document queries.
 * 3. Graceful relaxation: if the scored pool yields < MIN_RESULTS, fall back
 *    to returning the top-scored candidates regardless of score threshold.
 *
 * ── Caching ───────────────────────────────────────────────────────────────────
 * Results are stored in a module-level LRUCache (reuses existing LRUCache class).
 * TTL and max size are configurable via SIMILAR_CACHE_TTL_MS / SIMILAR_CACHE_SIZE.
 */

import { LRUCache } from './lruCache.js';
import { buildRecommendations } from './recommendations.js';
import type { CanonicalProduct } from './types/canonicalProduct.js';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Number of similar products to return. */
export const SIMILAR_LIMIT = 8;

/** Minimum results before graceful relaxation kicks in. */
const MIN_RESULTS = 4;

/** How many recent SearchCache documents to scan for candidates. */
const POOL_DOC_LIMIT = 50;

/** In-process cache TTL — 2h matches QUERY_CACHE_TTL_MS. Configurable. */
export const SIMILAR_CACHE_TTL_MS =
  Number(process.env.SIMILAR_CACHE_TTL_MS) || 2 * 60 * 60 * 1000;

/** Max LRU entries — one per canonical product viewed. */
const SIMILAR_CACHE_SIZE = 500;

// ─── Module-level LRU cache ───────────────────────────────────────────────────

const similarCache = new LRUCache<string, CanonicalProduct[]>({
  maxSize: SIMILAR_CACHE_SIZE,
  ttlMs: SIMILAR_CACHE_TTL_MS,
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns up to SIMILAR_LIMIT canonical products similar to the given
 * canonicalId, ordered by similarity score descending.
 *
 * @param canonicalId  The canonical product to find similar items for.
 * @returns            Array of similar CanonicalProduct[], empty on miss.
 */
export async function getSimilarProducts(
  canonicalId: string,
): Promise<CanonicalProduct[]> {
  // ── Cache hit ──────────────────────────────────────────────────────────────
  const cached = similarCache.get(canonicalId);
  if (cached) return cached;

  // ── DB lookup ──────────────────────────────────────────────────────────────
  const { connectDB } = await import('./db.js');
  const SearchCache = (await import('./models/SearchCache.js')).default;
  const { groupSearchResults } = await import('./search.js');

  await connectDB();

  // Fast path: O(1) index scan via the sparse canonicalIds index
  const sourceDoc = await SearchCache.findOne(
    { canonicalIds: canonicalId },
    { results: 1 },
  ).lean();

  if (!sourceDoc) return [];

  const sourceCanonicals = groupSearchResults(sourceDoc.results as any[]);
  const source = sourceCanonicals.find(c => c.id === canonicalId);
  if (!source) return [];

  // ── Build candidate pool (single query, no N+1) ───────────────────────────
  // Fetch recent cache docs, group each, deduplicate by canonical id.
  const recentDocs = await SearchCache.find(
    {},
    { results: 1 },
  )
    .sort({ fetchedAt: -1 })
    .limit(POOL_DOC_LIMIT)
    .lean();

  const seen = new Set<string>([canonicalId]); // exclude source
  const pool: CanonicalProduct[] = [];

  for (const doc of recentDocs) {
    const canonicals = groupSearchResults(doc.results as any[]);
    for (const c of canonicals) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        pool.push(c);
      }
    }
  }

  // ── Score via existing engine ─────────────────────────────────────────────
  const recs = buildRecommendations(source, pool, SIMILAR_LIMIT);
  let results = recs.similar;

  // ── Graceful relaxation ───────────────────────────────────────────────────
  // If scored similar section is thin, supplement with betterDeal + budget
  // (already scored, just different section labels) up to SIMILAR_LIMIT.
  if (results.length < MIN_RESULTS) {
    const supplement = [...recs.betterDeal, ...recs.budget]
      .filter(s => !results.some(r => r.product.id === s.product.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, SIMILAR_LIMIT - results.length);
    results = [...results, ...supplement];
  }

  const products = results.slice(0, SIMILAR_LIMIT).map(s => s.product);

  similarCache.set(canonicalId, products);
  return products;
}

/** Invalidates the cache entry for a given canonicalId (e.g. after a price update). */
export function invalidateSimilarCache(canonicalId: string): void {
  similarCache.delete(canonicalId);
}

/** Exposed for tests only — allows cache inspection/reset. */
export const _similarCache = similarCache;
