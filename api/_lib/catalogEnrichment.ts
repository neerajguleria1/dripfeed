/**
 * catalogEnrichment.ts
 *
 * Pure enrichment functions for the Catalog Intelligence pipeline.
 *
 * ── Design ────────────────────────────────────────────────────────────────────
 *   - Pure functions only — no DB calls, no HTTP, no side effects.
 *   - Reuses normalizer.ts and vocab.ts entirely — no duplication.
 *   - Each function is independently unit-testable.
 *   - The completeness score is deterministic given the same input.
 *
 * ── What is NOT done here ─────────────────────────────────────────────────────
 *   - No canonical matching (already done by matcher.ts)
 *   - No quality scoring (already done by productQuality.ts)
 *   - No query interpretation (already done by queryInterpreter.ts)
 *   - No price prediction (already done by pricePrediction.ts)
 */

import {
  normalizeTitle,
  normalizeBrand,
  extractColor,
  extractSize,
  extractGender,
  buildTokens,
} from './normalizer.js';
import type { CanonicalProduct, Offer } from './types/canonicalProduct.js';
import type {
  ICatalogEntry,
  CompletenessBreakdown,
  EnrichmentFlags,
} from './models/CatalogEntry.js';

// ─── Category inference ───────────────────────────────────────────────────────
// Keyword → canonical category slug mapping.
// Ordered from most-specific to least-specific within each group.

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  // Ethnic / South Asian
  { pattern: /\b(lehenga|lehanga)\b/i,                         category: 'lehenga' },
  { pattern: /\b(anarkali)\b/i,                                category: 'anarkali' },
  { pattern: /\b(salwar|sharara|palazzo\s*suit|kurta\s*set)\b/i, category: 'kurta-set' },
  { pattern: /\b(kurta|kurti|kurtis)\b/i,                      category: 'kurta' },
  { pattern: /\b(saree|sari|sarees)\b/i,                       category: 'saree' },
  { pattern: /\b(dupatta)\b/i,                                  category: 'dupatta' },
  // Tops
  { pattern: /\b(hoodie|hoody|sweatshirt)\b/i,                  category: 'hoodie' },
  { pattern: /\b(crop\s*top|croptop)\b/i,                       category: 'crop-top' },
  { pattern: /\b(t[\s-]?shirt|tee)\b/i,                        category: 'tshirt' },
  { pattern: /\b(blouse)\b/i,                                   category: 'blouse' },
  { pattern: /\b(shirt)\b/i,                                    category: 'shirt' },
  { pattern: /\b(top)\b/i,                                      category: 'top' },
  // Dresses
  { pattern: /\b(maxi\s*dress|midi\s*dress|mini\s*dress)\b/i,  category: 'dress' },
  { pattern: /\b(gown)\b/i,                                     category: 'gown' },
  { pattern: /\b(dress|dresses)\b/i,                            category: 'dress' },
  // Bottoms
  { pattern: /\b(palazzo)\b/i,                                  category: 'palazzo' },
  { pattern: /\b(legging|leggings|jegging|jeggings)\b/i,       category: 'leggings' },
  { pattern: /\b(jogger|joggers)\b/i,                           category: 'jogger' },
  { pattern: /\b(jeans|denim\s*jeans)\b/i,                     category: 'jeans' },
  { pattern: /\b(skirt|skirts)\b/i,                             category: 'skirt' },
  { pattern: /\b(short|shorts)\b/i,                             category: 'shorts' },
  { pattern: /\b(trouser|trousers|pant|pants)\b/i,              category: 'trouser' },
  // Outerwear — jacket MUST be before jeans so "denim jacket" → jacket not jeans
  { pattern: /\b(bomber|windbreaker)\b/i,                       category: 'jacket' },
  { pattern: /\b(denim\s*jacket|jacket|jackets)\b/i,            category: 'jacket' },
  { pattern: /\b(sweater|pullover|cardigan|jumper)\b/i,         category: 'sweater' },
  { pattern: /\b(coat|overcoat)\b/i,                            category: 'coat' },
  { pattern: /\b(blazer)\b/i,                                   category: 'blazer' },
  // Footwear
  { pattern: /\b(running\s*shoe|sports\s*shoe)\b/i,             category: 'sports-shoes' },
  { pattern: /\b(sneaker|sneakers|trainer|trainers)\b/i,        category: 'sneakers' },
  { pattern: /\b(sandal|sandals)\b/i,                           category: 'sandals' },
  { pattern: /\b(slipper|slippers|flip[\s-]flop)\b/i,          category: 'slippers' },
  { pattern: /\b(boot|boots|ankle\s*boot)\b/i,                  category: 'boots' },
  { pattern: /\b(heel|heels|stiletto|wedge)\b/i,                category: 'heels' },
  { pattern: /\b(loafer|loafers|moccasin)\b/i,                  category: 'loafers' },
  { pattern: /\b(flat|flats|ballerina)\b/i,                     category: 'flats' },
  { pattern: /\b(shoe|shoes|footwear)\b/i,                      category: 'shoes' },
  // Accessories
  { pattern: /\b(sunglass|sunglasses|eyewear)\b/i,              category: 'sunglasses' },
  { pattern: /\b(watch|watches)\b/i,                            category: 'watch' },
  { pattern: /\b(earring|earrings|necklace|bracelet|bangle|bangles|ring|rings)\b/i, category: 'jewellery' },
  { pattern: /\b(handbag|clutch|tote|purse|satchel)\b/i,        category: 'handbag' },
  { pattern: /\b(backpack)\b/i,                                  category: 'backpack' },
  { pattern: /\b(bag|bags)\b/i,                                  category: 'bag' },
  // Electronics
  { pattern: /\b(smartphone|mobile\s*phone|iphone)\b/i,         category: 'smartphone' },
  { pattern: /\b(laptop|notebook)\b/i,                          category: 'laptop' },
  { pattern: /\b(earphone|earbuds|tws|headphone)\b/i,           category: 'earphones' },
  { pattern: /\b(tablet|ipad)\b/i,                              category: 'tablet' },
];

export function inferCategory(title: string): string | undefined {
  for (const { pattern, category } of CATEGORY_RULES) {
    if (pattern.test(title)) return category;
  }
  return undefined;
}

// ─── Keyword generation ───────────────────────────────────────────────────────

/**
 * Generates searchable keyword tokens from a canonical product.
 * Reuses buildTokens() from normalizer (which applies vocab canonicalization).
 * Adds brand, category, color, gender as bonus tokens.
 */
export function generateKeywords(
  title: string,
  brand: string | undefined,
  category: string | undefined,
  color: string | undefined,
  gender: string | undefined,
): string[] {
  const base = buildTokens(title);
  const extras: string[] = [];
  if (brand)    extras.push(...brand.toLowerCase().split(/\s+/));
  if (category) extras.push(category.toLowerCase().replace(/-/g, ' '));
  if (color)    extras.push(color.toLowerCase());
  if (gender)   extras.push(gender.toLowerCase());
  return [...new Set([...base, ...extras])].sort();
}

// ─── Completeness score ───────────────────────────────────────────────────────

/** Max retailer coverage score — awarded at ≥3 retailers */
const MAX_RETAILER_SCORE = 15;

/**
 * Computes a 0–100 completeness score for a canonical product.
 *
 * Weights:
 *   Title             15 — essential, penalises very short titles
 *   Image             15 — product image URL present and https
 *   Brand             15 — brand extracted/normalized
 *   Retailer coverage 15 — 5/retailer up to 3 retailers
 *   Original price    10 — MRP/originalPrice present (enables discount display)
 *   Category          10 — category inferred
 *   Color              5 — color extracted
 *   Size               5 — size extracted
 *   Gender             5 — gender extracted
 *   Rating             5 — at least one offer has a rating
 *   ─────────────────────
 *   Total            100
 */
export function computeCompletenessScore(
  title:           string | undefined,
  imageUrl:        string | undefined,
  brand:           string | undefined,
  category:        string | undefined,
  color:           string | undefined,
  size:            string | undefined,
  gender:          string | undefined,
  hasOriginalPrice: boolean,
  hasRating:       boolean,
  offerCount:      number,
): { score: number; breakdown: CompletenessBreakdown } {
  // Title — full 15 if ≥20 chars, partial 8 if 5–19, 0 if missing/too short
  const titleScore =
    !title || title.trim().length < 5  ? 0 :
    title.trim().length < 20           ? 8 :
    15;

  // Image — full if https URL, partial if http, 0 if missing
  const imageScore =
    !imageUrl                             ? 0 :
    imageUrl.startsWith('https://')       ? 15 :
    imageUrl.startsWith('http://')        ? 8 :
    0;

  const brandScore    = brand    ? 15 : 0;
  const categoryScore = category ? 10 : 0;
  const colorScore    = color    ? 5  : 0;
  const sizeScore     = size     ? 5  : 0;
  const genderScore   = gender   ? 5  : 0;
  const origPriceScore = hasOriginalPrice ? 10 : 0;
  const ratingScore   = hasRating        ? 5  : 0;

  // Retailer coverage: 5 points per retailer, max 15
  const retailerCoverage = Math.min(offerCount * 5, MAX_RETAILER_SCORE);

  const breakdown: CompletenessBreakdown = {
    hasTitle:         titleScore,
    hasImage:         imageScore,
    hasBrand:         brandScore,
    hasCategory:      categoryScore,
    hasColor:         colorScore,
    hasSize:          sizeScore,
    hasGender:        genderScore,
    hasOriginalPrice: origPriceScore,
    hasRating:        ratingScore,
    retailerCoverage,
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return {
    score: Math.max(0, Math.min(100, Math.round(total))),
    breakdown,
  };
}

// ─── Main enrichment function ─────────────────────────────────────────────────

export interface EnrichmentInput {
  canonical: CanonicalProduct;
  sourceQuery?: string;
}

/**
 * Enriches a single CanonicalProduct into an ICatalogEntry record.
 * Pure — no DB, no side effects.
 * Called by the background cron job per batch item.
 */
export function enrichCanonical(input: EnrichmentInput): Omit<ICatalogEntry, 'createdAt' | 'lastEnrichedAt'> {
  const { canonical, sourceQuery } = input;
  const offers = canonical.offers as Offer[];

  // ── Pick best-quality offer for display fields ──────────────────────────────
  // Prefer offers that have a valid https image URL
  const bestOffer = offers.find(o => o.imageUrl?.startsWith('https://')) ?? offers[0];

  const rawTitle    = canonical.title || bestOffer?.title || '';
  const rawBrand    = canonical.brand || bestOffer?.originalProduct?.brand;

  // ── Normalise ───────────────────────────────────────────────────────────────
  const normalizedTitle = normalizeTitle(rawTitle);
  const normalizedBrand = normalizeBrand(rawBrand);

  // ── Extract signals ─────────────────────────────────────────────────────────
  // Merge color/size from all offers — take first non-null
  const rawColor  = offers.map(o => o.color).find(Boolean);
  const rawSize   = offers.map(o => o.size).find(Boolean);
  const color     = extractColor(rawColor, rawTitle);
  const size      = extractSize(rawSize, rawTitle);
  const gender    = extractGender(rawTitle);
  const category  = inferCategory(rawTitle);

  // ── Pricing signals ─────────────────────────────────────────────────────────
  const prices         = offers.map(o => o.price).filter(p => p > 0);
  const lowestPrice    = prices.length ? Math.min(...prices) : undefined;
  const hasOriginalPrice = offers.some(o => typeof o.originalPrice === 'number' && o.originalPrice > 0);

  // ── Rating signals ──────────────────────────────────────────────────────────
  const ratings = offers.map(o => o.rating).filter((r): r is number => typeof r === 'number' && r > 0);
  const avgRating = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : undefined;
  const hasRating = ratings.length > 0;

  // ── Image ───────────────────────────────────────────────────────────────────
  const imageUrl = bestOffer?.imageUrl;

  // ── Platforms ───────────────────────────────────────────────────────────────
  const platforms = [...new Set(offers.map(o => o.platform))];

  // ── Keywords ────────────────────────────────────────────────────────────────
  const keywords = generateKeywords(rawTitle, normalizedBrand, category, color, gender);

  // ── Completeness ────────────────────────────────────────────────────────────
  const { score: completenessScore, breakdown } = computeCompletenessScore(
    rawTitle, imageUrl, normalizedBrand, category, color, size, gender,
    hasOriginalPrice, hasRating, offers.length,
  );

  // ── Flags ────────────────────────────────────────────────────────────────────
  const flags: EnrichmentFlags = {
    titleNormalized:   normalizedTitle !== rawTitle.toLowerCase().trim(),
    brandNormalized:   !!normalizedBrand && normalizedBrand !== (rawBrand ?? '').toLowerCase().trim(),
    colorExtracted:    !!color,
    sizeExtracted:     !!size,
    genderExtracted:   !!gender,
    categoryInferred:  !!category,
    keywordsGenerated: keywords.length > 0,
  };

  return {
    canonicalId:       canonical.id,
    normalizedTitle,
    displayTitle:      rawTitle,
    normalizedBrand,
    category,
    imageUrl,
    color,
    size,
    gender: gender as string | undefined,
    keywords,
    platforms,
    offerCount:        offers.length,
    lowestPrice,
    hasOriginalPrice,
    avgRating,
    matchConfidence:   canonical.confidence ?? 0,
    completenessScore,
    breakdown,
    flags,
    needsEnrichment:   completenessScore < 50, // flag low-quality for re-enrichment
    sourceQuery,
  };
}

// ─── Catalog health summary ───────────────────────────────────────────────────

export interface CatalogHealthSummary {
  total:                 number;
  avgCompleteness:       number;
  /** Count by grade bucket */
  grades: {
    excellent: number;  // 80–100
    good:      number;  // 60–79
    fair:      number;  // 40–59
    poor:      number;  // 0–39
  };
  missingImage:          number;
  missingBrand:          number;
  missingCategory:       number;
  needsEnrichment:       number;
  /** Products not seen in any SearchCache for >48h (stale) */
  staleCount:            number;
  /** Products below score 40 (poor) */
  poorCount:             number;
  /** Most common missing fields */
  topMissingFields:      Array<{ field: string; count: number }>;
}
