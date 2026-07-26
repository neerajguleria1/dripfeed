/**
 * recommendations.ts
 *
 * Pure recommendation scoring engine.
 * No database, no HTTP, no side effects — only deterministic math.
 *
 * ── Recommendation types ──────────────────────────────────────────────────────
 *   similar        — same brand/category/gender/type
 *   better_deal    — similar attributes, lower price or higher discount
 *   popular        — most-clicked / highest search frequency fallback
 *   price_dropped  — largest % price drop in same category
 *   premium        — higher price, better rating
 *   budget         — cheaper, similar attributes
 *
 * ── Scoring weights ───────────────────────────────────────────────────────────
 *   brand match        30 pts
 *   token overlap      25 pts  (Jaccard similarity × 25)
 *   gender match       15 pts
 *   color match         5 pts
 *   price proximity    15 pts  (1 − |Δprice| / max_price) × 15
 *   discount bonus      5 pts  (discount% / 100) × 5
 *   rating bonus        5 pts  (rating / 5) × 5
 *
 *   Total max = 100 pts, normalized to 0–100.
 */

import type { CanonicalProduct } from './types/canonicalProduct.js';
import {
  normalizeBrand,
  extractGender,
  extractColor,
  buildTokens,
} from './normalizer.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationType =
  | 'similar'
  | 'better_deal'
  | 'popular'
  | 'price_dropped'
  | 'premium'
  | 'budget';

export interface ScoredProduct {
  product: CanonicalProduct;
  score: number;          // 0–100
  type: RecommendationType;
  reason: string;         // human-readable label shown in UI
}

export interface RecommendationSet {
  similar:      ScoredProduct[];
  betterDeal:   ScoredProduct[];
  popular:      ScoredProduct[];
  priceDropped: ScoredProduct[];
  premium:      ScoredProduct[];
  budget:       ScoredProduct[];
}

// ─── Internal product fingerprint ────────────────────────────────────────────

interface Fingerprint {
  id:           string;
  brand:        string | undefined;
  tokens:       string[];
  gender:       string | undefined;
  color:        string | undefined;
  price:        number;
  discount:     number;
  rating:       number;
  originalPrice: number;
}

function fingerprint(c: CanonicalProduct): Fingerprint {
  const offer = c.offers[0];
  const title = c.title;
  return {
    id:            c.id,
    brand:         normalizeBrand(c.brand),
    tokens:        buildTokens(title),
    gender:        extractGender(title),
    color:         extractColor(offer?.color, title),
    price:         offer?.price ?? 0,
    discount:      offer?.discount ?? 0,
    rating:        offer?.rating ?? 0,
    originalPrice: offer?.originalPrice ?? offer?.price ?? 0,
  };
}

// ─── Jaccard token similarity ─────────────────────────────────────────────────

function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Core similarity score (0–100) ───────────────────────────────────────────

function similarityScore(src: Fingerprint, cand: Fingerprint, maxPrice: number): number {
  let score = 0;

  // Brand match — 30 pts
  if (src.brand && cand.brand && src.brand === cand.brand) score += 30;

  // Token overlap — 25 pts
  score += jaccard(src.tokens, cand.tokens) * 25;

  // Gender match — 15 pts (undefined gender is neutral, not penalized)
  if (src.gender && cand.gender) {
    if (src.gender === cand.gender) score += 15;
    else score -= 10; // opposite gender is a strong negative signal
  }

  // Color match — 5 pts
  if (src.color && cand.color && src.color === cand.color) score += 5;

  // Price proximity — 15 pts
  if (maxPrice > 0) {
    const priceDelta = Math.abs(src.price - cand.price);
    score += (1 - Math.min(priceDelta / maxPrice, 1)) * 15;
  }

  // Discount bonus — 5 pts
  score += (Math.min(cand.discount, 100) / 100) * 5;

  // Rating bonus — 5 pts
  if (cand.rating > 0) score += (Math.min(cand.rating, 5) / 5) * 5;

  return Math.max(0, Math.min(100, score));
}

// ─── Price drop percentage ────────────────────────────────────────────────────

function dropPct(c: CanonicalProduct): number {
  const offer = c.offers[0];
  if (!offer || !offer.originalPrice || offer.originalPrice <= offer.price) return 0;
  return ((offer.originalPrice - offer.price) / offer.originalPrice) * 100;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds all recommendation sections for a source product from a pool of
 * candidate canonical products (typically from the same search cache query).
 *
 * @param source    The product being viewed
 * @param pool      All other canonical products from the same search context
 * @param limit     Max results per section (default 6)
 */
export function buildRecommendations(
  source: CanonicalProduct,
  pool: CanonicalProduct[],
  limit = 6,
): RecommendationSet {
  const candidates = pool.filter(c => c.id !== source.id);
  if (!candidates.length) {
    return { similar: [], betterDeal: [], popular: [], priceDropped: [], premium: [], budget: [] };
  }

  const src = fingerprint(source);
  const maxPrice = Math.max(src.price, ...candidates.map(c => c.offers[0]?.price ?? 0));

  const scored = candidates.map(c => {
    const fp = fingerprint(c);
    return { product: c, fp, score: similarityScore(src, fp, maxPrice) };
  });

  // ── Similar ───────────────────────────────────────────────────────────────
  const similar: ScoredProduct[] = scored
    .filter(s => s.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({ product: s.product, score: s.score, type: 'similar', reason: 'Similar product' }));

  // ── Better Deal ───────────────────────────────────────────────────────────
  // Similar attributes (score ≥ 15) + lower price OR higher discount
  const betterDeal: ScoredProduct[] = scored
    .filter(s => s.score >= 15 && (s.fp.price < src.price || s.fp.discount > src.discount))
    .sort((a, b) => {
      // Primary: price savings; secondary: similarity
      const savingsA = src.price - a.fp.price;
      const savingsB = src.price - b.fp.price;
      return savingsB - savingsA || b.score - a.score;
    })
    .slice(0, limit)
    .map(s => {
      const savings = src.price - s.fp.price;
      const reason = savings > 0
        ? `Save ${Math.round(savings).toLocaleString('en-IN')} vs current`
        : `${s.fp.discount}% off`;
      return { product: s.product, score: s.score, type: 'better_deal', reason };
    });

  // ── Popular ───────────────────────────────────────────────────────────────
  // Highest discount as popularity proxy (no click data in cache)
  const popular: ScoredProduct[] = [...candidates]
    .sort((a, b) => (b.offers[0]?.discount ?? 0) - (a.offers[0]?.discount ?? 0))
    .slice(0, limit)
    .map(c => ({
      product: c,
      score: Math.min(100, (c.offers[0]?.discount ?? 0) * 2),
      type: 'popular',
      reason: 'Trending deal',
    }));

  // ── Price Dropped ─────────────────────────────────────────────────────────
  const priceDropped: ScoredProduct[] = candidates
    .map(c => ({ product: c, drop: dropPct(c) }))
    .filter(x => x.drop >= 10)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, limit)
    .map(x => ({
      product: x.product,
      score: Math.min(100, x.drop),
      type: 'price_dropped',
      reason: `${Math.round(x.drop)}% price drop`,
    }));

  // ── Premium Upgrade ───────────────────────────────────────────────────────
  // Higher price (≥10% more) + better rating or higher similarity
  const premium: ScoredProduct[] = scored
    .filter(s => s.fp.price >= src.price * 1.1 && (s.fp.rating > src.rating || s.score >= 20))
    .sort((a, b) => {
      // Prefer better rating, then similarity
      const ratingDiff = b.fp.rating - a.fp.rating;
      return ratingDiff !== 0 ? ratingDiff : b.score - a.score;
    })
    .slice(0, limit)
    .map(s => ({
      product: s.product,
      score: s.score,
      type: 'premium',
      reason: s.fp.rating > src.rating
        ? `${s.fp.rating.toFixed(1)}★ rated`
        : 'Premium option',
    }));

  // ── Budget Alternative ────────────────────────────────────────────────────
  // Cheaper (≥10% less) + similar attributes (score ≥ 15)
  const budget: ScoredProduct[] = scored
    .filter(s => s.fp.price <= src.price * 0.9 && s.score >= 15)
    .sort((a, b) => a.fp.price - b.fp.price)
    .slice(0, limit)
    .map(s => ({
      product: s.product,
      score: s.score,
      type: 'budget',
      reason: `${Math.round(((src.price - s.fp.price) / src.price) * 100)}% cheaper`,
    }));

  return { similar, betterDeal, popular, priceDropped, premium, budget };
}
