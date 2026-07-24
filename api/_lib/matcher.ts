/**
 * matcher.ts
 *
 * Product Matching Engine — Milestone 2 of the Product Identity Resolution system.
 *
 * Groups NormalizedProduct[] into CanonicalProduct[] by detecting which
 * listings across different platforms represent the same logical product.
 *
 * ── Guarantees ────────────────────────────────────────────────────────────────
 *   • Pure functions only — no database, no cache, no HTTP, no side effects.
 *   • Input objects are never mutated.
 *   • Deterministic — identical input always produces identical output.
 *   • Strict TypeScript — no `any`.
 *
 * ── V1 Signals ────────────────────────────────────────────────────────────────
 *   • Brand match / mismatch (hard reject on brand conflict)
 *   • Jaccard token similarity
 *   • Final score = brand_score * 0.45 + jaccard * 0.55
 *   • Merge threshold: score >= 0.75
 *
 * ── Deferred to Phase 2 ───────────────────────────────────────────────────────
 *   • Brand alias tables
 *   • Color / size signals
 *   • Model number extraction
 *   • Category taxonomy
 */

import type { NormalizedProduct } from './types/normalizedProduct.js';
import type { CanonicalProduct, Offer } from './types/canonicalProduct.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_WEIGHT = 0.45;
const TITLE_WEIGHT = 0.55;
const MERGE_THRESHOLD = 0.75;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Calculates Jaccard similarity between two token sets.
 *
 * Jaccard = |A ∩ B| / |A ∪ B|
 *
 * Returns 0 when both sets are empty (no signal → no match).
 */
export function calculateJaccard(
  a: readonly string[],
  b: readonly string[],
): number {
  if (a.length === 0 && b.length === 0) return 0;

  const setA = new Set(a);
  const setB = new Set(b);

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculates the composite similarity score between two NormalizedProducts.
 *
 * Brand scoring rules:
 *   • Both brands present and equal   → brand_score = 1.0
 *   • Both brands present and differ  → brand_score = 0  (hard reject via -1 sentinel)
 *   • One or both brands missing      → brand_score = 0.5 (reduced confidence)
 *
 * Returns -1 when brands conflict — caller must treat this as "no match".
 */
export function calculateSimilarity(
  a: NormalizedProduct,
  b: NormalizedProduct,
): number {
  // Hard reject on brand conflict
  if (
    a.normalizedBrand !== undefined &&
    b.normalizedBrand !== undefined &&
    a.normalizedBrand !== b.normalizedBrand
  ) {
    return -1;
  }

  const brandScore =
    a.normalizedBrand !== undefined && b.normalizedBrand !== undefined
      ? 1.0   // both present and equal (conflict already rejected above)
      : 0.5;  // at least one missing → reduced confidence

  const jaccardScore = calculateJaccard(a.tokens, b.tokens);

  return brandScore * BRAND_WEIGHT + jaccardScore * TITLE_WEIGHT;
}

// ─── Offer builder ────────────────────────────────────────────────────────────

function toOffer(np: NormalizedProduct): Offer {
  const p = np.originalProduct;
  return {
    platform:          p.platform,
    platformProductId: p.id,
    title:             p.title,
    price:             p.price,
    originalPrice:     p.originalPrice,
    imageUrl:          p.imageUrl,
    productUrl:        p.url,
    color:             np.color,
    size:              np.size,
    originalProduct:   p,
  };
}

// ─── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Finds the best matching CanonicalProduct for a given NormalizedProduct.
 *
 * Returns `{ index, score }` where `index` is the position in `canonicals`
 * and `score` is the highest similarity found.
 * Returns `{ index: -1, score: 0 }` when `canonicals` is empty or no
 * candidate scores above zero.
 */
export function findBestMatch(
  product: NormalizedProduct,
  canonicals: readonly CanonicalProduct[],
  normalizedMap: ReadonlyMap<string, NormalizedProduct>,
): { index: number; score: number } {
  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < canonicals.length; i++) {
    // Compare against the representative (first offer) of each canonical
    const representativeId = canonicals[i].offers[0].platformProductId;
    const representative = normalizedMap.get(representativeId);
    if (representative === undefined) continue;

    const score = calculateSimilarity(product, representative);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return { index: bestIndex, score: bestScore };
}

/**
 * Groups an array of NormalizedProducts into CanonicalProducts.
 *
 * Algorithm (deterministic, single-pass):
 *   For each product (in input order):
 *     1. Compare against every existing canonical's representative.
 *     2. Pick the highest-scoring candidate.
 *     3. If score >= MERGE_THRESHOLD → add a new Offer to that canonical.
 *     4. Otherwise → create a new CanonicalProduct seeded with this product.
 *
 * The representative of each canonical is always its first offer — the
 * product that created it. This keeps the algorithm deterministic: the
 * same input order always produces the same grouping.
 */
export function groupIntoCanonicals(
  products: readonly NormalizedProduct[],
): CanonicalProduct[] {
  // Build an id → NormalizedProduct lookup used by findBestMatch
  const normalizedMap = new Map<string, NormalizedProduct>(
    products.map((np) => [np.originalProduct.id, np]),
  );

  const canonicals: CanonicalProduct[] = [];

  for (const product of products) {
    const { index, score } = findBestMatch(product, canonicals, normalizedMap);

    if (index !== -1 && score >= MERGE_THRESHOLD) {
      // Merge: append a new offer to the existing canonical
      const existing = canonicals[index];
      const newOffer = toOffer(product);
      canonicals[index] = {
        ...existing,
        offers:     [...existing.offers, newOffer],
        offerCount: existing.offerCount + 1,
      };
    } else {
      // New canonical seeded by this product
      const offer = toOffer(product);
      const p = product.originalProduct;
      canonicals.push({
        id:         p.id,
        title:      p.title,
        brand:      product.normalizedBrand,
        offers:     [offer],
        offerCount: 1,
      });
    }
  }

  return canonicals;
}
