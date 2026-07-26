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
 * ── Signals (V2) ──────────────────────────────────────────────────────────────
 *   Hard rejects (return -1, never merge):
 *     • Brand conflict
 *     • Color conflict  (both present, different)
 *     • Size conflict   (both present, different)
 *     • Gender conflict (both present, different, neither is unisex)
 *     • Model conflict  (both present, different)
 *     • Price too far apart (ratio > PRICE_RATIO_THRESHOLD)
 *     • Same platform
 *
 *   Scored signals:
 *     • Brand match / missing  (weight 0.35)
 *     • Jaccard title tokens   (weight 0.40)
 *     • Model match bonus      (weight 0.15)
 *     • Color match bonus      (weight 0.05)
 *     • Gender match bonus     (weight 0.05)
 *
 *   Merge threshold: score >= 0.72
 */

import type { NormalizedProduct } from './types/normalizedProduct.js';
import type { CanonicalProduct, Offer } from './types/canonicalProduct.js';

// ─── Weights & thresholds ─────────────────────────────────────────────────────

const BRAND_WEIGHT  = 0.35;
const TITLE_WEIGHT  = 0.40;
const MODEL_WEIGHT  = 0.15;
const COLOR_WEIGHT  = 0.05;
const GENDER_WEIGHT = 0.05;

const MERGE_THRESHOLD = 0.72;

/**
 * Maximum price ratio between two offers to allow merging.
 * ratio = max(a,b) / min(a,b)
 * e.g. ₹399 vs ₹3999 → ratio ≈ 10 → rejected.
 * e.g. ₹7295 vs ₹7495 → ratio ≈ 1.03 → allowed.
 */
const PRICE_RATIO_THRESHOLD = 3.0;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Calculates Jaccard similarity between two token sets.
 * Jaccard = |A ∩ B| / |A ∪ B|
 * Returns 0 when both sets are empty.
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
 * Returns true when two prices are too far apart to plausibly be the
 * same product. Uses a ratio check so it scales across price ranges.
 */
function priceConflict(priceA: number, priceB: number): boolean {
  if (priceA <= 0 || priceB <= 0) return false; // can't judge with missing price
  const ratio = Math.max(priceA, priceB) / Math.min(priceA, priceB);
  return ratio > PRICE_RATIO_THRESHOLD;
}

/**
 * Calculates the composite similarity score between two NormalizedProducts.
 *
 * Returns -1 on any hard reject (brand/color/size/gender/model/price conflict).
 * Returns a score in [0, 1] otherwise.
 *
 * Confidence interpretation:
 *   >= 0.90  very high — brand + title + model all match
 *   >= 0.80  high      — brand + title match well
 *   >= 0.72  medium    — meets merge threshold
 *   <  0.72  no merge
 */
export function calculateSimilarity(
  a: NormalizedProduct,
  b: NormalizedProduct,
): number {
  // ── Hard rejects ────────────────────────────────────────────────────────────

  // Brand conflict
  if (
    a.normalizedBrand !== undefined &&
    b.normalizedBrand !== undefined &&
    a.normalizedBrand !== b.normalizedBrand
  ) return -1;

  // Color conflict — both present and different
  if (
    a.color !== undefined &&
    b.color !== undefined &&
    a.color !== b.color
  ) return -1;

  // Size conflict — both present and different
  if (
    a.size !== undefined &&
    b.size !== undefined &&
    a.size !== b.size
  ) return -1;

  // Gender conflict — both present, different, neither is unisex
  if (
    a.gender !== undefined &&
    b.gender !== undefined &&
    a.gender !== b.gender &&
    a.gender !== 'unisex' &&
    b.gender !== 'unisex'
  ) return -1;

  // Model conflict — both present and different
  if (
    a.model !== undefined &&
    b.model !== undefined &&
    a.model !== b.model
  ) return -1;

  // Price sanity — ratio too large
  if (priceConflict(a.originalProduct.price, b.originalProduct.price)) return -1;

  // ── Scored signals ───────────────────────────────────────────────────────────

  const brandScore =
    a.normalizedBrand !== undefined && b.normalizedBrand !== undefined
      ? 1.0   // both present and equal (conflict already rejected above)
      : 0.5;  // at least one missing → reduced confidence

  const jaccardScore = calculateJaccard(a.tokens, b.tokens);

  // Model bonus: both present and equal → full weight; otherwise 0
  const modelScore =
    a.model !== undefined && b.model !== undefined && a.model === b.model
      ? 1.0
      : 0.0;

  // Color bonus: both present and equal → full weight; otherwise 0
  const colorScore =
    a.color !== undefined && b.color !== undefined && a.color === b.color
      ? 1.0
      : 0.0;

  // Gender bonus: both present and equal (or one is unisex) → full weight
  const genderScore =
    a.gender !== undefined && b.gender !== undefined &&
    (a.gender === b.gender || a.gender === 'unisex' || b.gender === 'unisex')
      ? 1.0
      : 0.0;

  return (
    brandScore  * BRAND_WEIGHT  +
    jaccardScore * TITLE_WEIGHT  +
    modelScore  * MODEL_WEIGHT  +
    colorScore  * COLOR_WEIGHT  +
    genderScore * GENDER_WEIGHT
  );
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
    discount:          p.discount,
    imageUrl:          p.imageUrl,
    productUrl:        p.url,
    affiliateUrl:      p.affiliateUrl,
    color:             np.color,
    size:              np.size,
    rating:            p.rating,
    originalProduct:   p,
  };
}

// ─── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Finds the best matching CanonicalProduct for a given NormalizedProduct.
 *
 * Returns { index, score } where index is the position in canonicals.
 * Returns { index: -1, score: 0 } when no candidate meets the threshold.
 *
 * Guarantees:
 *   - Never matches a canonical that already has an offer from the same platform.
 *   - Compares against ALL offers in each canonical (not just the first) so
 *     match quality doesn't degrade as canonicals accumulate more offers.
 */
export function findBestMatch(
  product: NormalizedProduct,
  canonicals: readonly CanonicalProduct[],
  normalizedMap: ReadonlyMap<string, NormalizedProduct>,
): { index: number; score: number } {
  let bestIndex = -1;
  let bestScore = 0;
  const incomingPlatform = product.originalProduct.platform.toLowerCase();

  for (let i = 0; i < canonicals.length; i++) {
    // Never merge two offers from the same platform into one canonical
    const alreadyHasPlatform = canonicals[i].offers.some(
      (o) => o.platform.toLowerCase() === incomingPlatform,
    );
    if (alreadyHasPlatform) continue;

    // Compare against all offers — take the best score across all
    let canonicalBest = 0;
    for (const offer of canonicals[i].offers) {
      const np = normalizedMap.get(offer.platformProductId);
      if (np === undefined) continue;
      const score = calculateSimilarity(product, np);
      if (score > canonicalBest) canonicalBest = score;
    }

    if (canonicalBest > bestScore) {
      bestScore = canonicalBest;
      bestIndex = i;
    }
  }

  return { index: bestIndex, score: bestScore };
}

/**
 * Computes a confidence value (0–1) for a canonical that has multiple offers.
 * Based on the average pairwise similarity of all offer pairs.
 * Single-offer canonicals get confidence 1.0 (no ambiguity).
 */
function computeConfidence(
  offers: readonly Offer[],
  normalizedMap: ReadonlyMap<string, NormalizedProduct>,
): number {
  if (offers.length <= 1) return 1.0;

  let total = 0;
  let count = 0;

  for (let i = 0; i < offers.length; i++) {
    for (let j = i + 1; j < offers.length; j++) {
      const a = normalizedMap.get(offers[i].platformProductId);
      const b = normalizedMap.get(offers[j].platformProductId);
      if (a === undefined || b === undefined) continue;
      const score = calculateSimilarity(a, b);
      total += score < 0 ? 0 : score; // treat hard-reject as 0 for averaging
      count++;
    }
  }

  return count === 0 ? 1.0 : Math.min(1, total / count);
}

/**
 * Groups an array of NormalizedProducts into CanonicalProducts.
 *
 * Algorithm (deterministic, single-pass):
 *   For each product (in input order):
 *     1. Find the best-scoring existing canonical (excluding same-platform).
 *     2. If score >= MERGE_THRESHOLD → add a new Offer to that canonical.
 *     3. Otherwise → create a new CanonicalProduct seeded with this product.
 *   After grouping, compute confidence for each canonical.
 */
export function groupIntoCanonicals(
  products: readonly NormalizedProduct[],
): CanonicalProduct[] {
  const normalizedMap = new Map<string, NormalizedProduct>(
    products.map((np) => [np.originalProduct.id, np]),
  );

  const canonicals: CanonicalProduct[] = [];

  for (const product of products) {
    const { index, score } = findBestMatch(product, canonicals, normalizedMap);

    if (index !== -1 && score >= MERGE_THRESHOLD) {
      const existing = canonicals[index];
      canonicals[index] = {
        ...existing,
        offers:     [...existing.offers, toOffer(product)],
        offerCount: existing.offerCount + 1,
        confidence: existing.confidence, // recomputed below
      };
    } else {
      const p = product.originalProduct;
      canonicals.push({
        id:         p.id,
        title:      p.title,
        brand:      product.normalizedBrand,
        offers:     [toOffer(product)],
        offerCount: 1,
        confidence: 1.0,
      });
    }
  }

  // Recompute confidence for all multi-offer canonicals
  return canonicals.map((c) =>
    c.offerCount > 1
      ? { ...c, confidence: computeConfidence(c.offers, normalizedMap) }
      : c,
  );
}
