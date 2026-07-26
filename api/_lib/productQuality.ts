/**
 * productQuality.ts
 *
 * Deterministic Product Quality Score engine.
 * No external services — operates entirely on data already in SearchCache.
 *
 * ── Signals (7) ───────────────────────────────────────────────────────────────
 *   1. Title quality       (0–20) — length, specificity, filler words
 *   2. Image quality       (0–15) — URL validity, CDN origin, placeholder check
 *   3. Attribute completeness (0–15) — brand, rating, color/size, originalPrice
 *   4. Canonical confidence   (0–15) — the canonical.confidence field from matcher
 *   5. Duplicate confidence   (0–10) — offer-count vs title similarity spread
 *   6. Retailer agreement     (0–15) — price spread across offers (low = consistent)
 *   7. Missing field penalty  (0–10) — hard missing fields (url, price, imageUrl)
 *
 * ── Score ─────────────────────────────────────────────────────────────────────
 *   Final score: sum of all signal scores, clamped to [0, 100].
 *   Grade:  A ≥ 80  |  B ≥ 60  |  C ≥ 40  |  D < 40
 *
 * ── Auto-Fix Suggestions ─────────────────────────────────────────────────────
 *   Each issue emitted by the engine includes a `fix` field where the engine
 *   can suggest a concrete corrected value (e.g. cleaned title, canonical image).
 */

import type { CanonicalProduct, Offer } from './types/canonicalProduct.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Well-known Indian e-commerce image CDN hostnames — high-quality images */
const TRUSTED_IMAGE_CDNS = new Set([
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'images-eu.ssl-images-amazon.com',
  'rukminim1.flixcart.com',
  'rukminim2.flixcart.com',
  'rukmini1.flixcart.com',
  'assets.myntassets.com',
  'images.meesho.com',
  'assets.ajio.com',
  'cdn.pixelbin.io',        // Nykaa
  'img.tatacliq.com',
]);

/** Known placeholder / broken image patterns */
const PLACEHOLDER_IMAGE_PATTERNS = [
  /placeholder/i,
  /noimage/i,
  /default[-_]?image/i,
  /coming[-_]?soon/i,
  /unsplash\.com/i,   // external stock photo = not real product image
  /via\.placeholder/i,
  /dummyimage/i,
  /lorempixel/i,
];

/** Title tokens that indicate low-quality / filler content */
const TITLE_FILLER_PATTERNS = [
  /^(product|item|listing|buy online|shop online|best price|great deal)$/i,
  /\b(click here|shop now|free delivery|buy online|shop online)\b/i,
];

/** Minimum/maximum title length thresholds */
const TITLE_MIN_LEN = 10;
const TITLE_GOOD_LEN = 25;
const TITLE_MAX_LEN = 120;

/** Retailer agreement: acceptable price spread fraction across offers */
const PRICE_SPREAD_OK = 0.10;   // ≤10% spread = full score
const PRICE_SPREAD_WARN = 0.25; // >25% spread = half score
const PRICE_SPREAD_BAD = 0.50;  // >50% spread = zero score

// ─── Types ────────────────────────────────────────────────────────────────────

export type QualityGrade = 'A' | 'B' | 'C' | 'D';

export interface QualityIssue {
  /** Machine-readable issue code */
  code: string;
  /** Human-readable description for admin display */
  message: string;
  /** Severity: high (score loss ≥ 10), medium (5–9), low (1–4) */
  severity: 'high' | 'medium' | 'low';
  /** Suggested auto-fix value (when engine can determine one) */
  fix?: string;
}

export interface SignalScores {
  titleQuality:          number;   // 0–20
  imageQuality:          number;   // 0–15
  attributeCompleteness: number;   // 0–15
  canonicalConfidence:   number;   // 0–15
  duplicateConfidence:   number;   // 0–10
  retailerAgreement:     number;   // 0–15
  missingFieldPenalty:   number;   // 0–10 (higher = fewer penalties)
}

export interface ProductQualityResult {
  canonicalId:    string;
  title:          string;
  score:          number;          // 0–100
  grade:          QualityGrade;
  signals:        SignalScores;
  issues:         QualityIssue[];
  offerCount:     number;
  platforms:      string[];
  /** Best image URL found, or first offer's imageUrl */
  representativeImage: string;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Is a URL a valid https image from a trusted CDN? */
export function scoreImageUrl(url: string | undefined): { score: number; issue?: QualityIssue } {
  if (!url || url.trim() === '') {
    return {
      score: 0,
      issue: { code: 'IMAGE_MISSING', message: 'No image URL found.', severity: 'high' },
    };
  }

  const trimmed = url.trim();

  // Must be https
  if (!trimmed.startsWith('https://')) {
    // If it starts with http://, suggest upgrade; if it's something else (malformed), flag as invalid
    if (trimmed.startsWith('http://')) {
      const fixed = trimmed.replace('http://', 'https://');
      return {
        score: 5,
        issue: {
          code:     'IMAGE_NOT_HTTPS',
          message:  'Image URL uses http (insecure).',
          severity: 'medium',
          fix:      fixed,
        },
      };
    }
    // Not http or https — malformed
    return {
      score: 0,
      issue: { code: 'IMAGE_INVALID_URL', message: 'Image URL is malformed.', severity: 'high' },
    };
  }

  // Check for known placeholder patterns
  for (const pattern of PLACEHOLDER_IMAGE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        score: 3,
        issue: { code: 'IMAGE_PLACEHOLDER', message: 'Image URL matches a known placeholder pattern.', severity: 'high' },
      };
    }
  }

  // Trusted CDN → full score
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (TRUSTED_IMAGE_CDNS.has(host)) {
      return { score: 15 };
    }
    // Unknown CDN — might still be valid, give partial
    return {
      score: 10,
      issue: { code: 'IMAGE_UNKNOWN_CDN', message: `Image CDN '${host}' is not a recognised platform CDN.`, severity: 'low' },
    };
  } catch {
    return {
      score: 0,
      issue: { code: 'IMAGE_INVALID_URL', message: 'Image URL is malformed.', severity: 'high' },
    };
  }
}

/** Score the title for quality */
export function scoreTitleQuality(title: string | undefined): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];

  if (!title || title.trim() === '') {
    return {
      score: 0,
      issues: [{ code: 'TITLE_MISSING', message: 'Product title is missing.', severity: 'high' }],
    };
  }

  const t = title.trim();
  let score = 20;

  // Too short
  if (t.length < TITLE_MIN_LEN) {
    score -= 12;
    issues.push({ code: 'TITLE_TOO_SHORT', message: `Title too short (${t.length} chars, min ${TITLE_MIN_LEN}).`, severity: 'high' });
  } else if (t.length < TITLE_GOOD_LEN) {
    score -= 5;
    issues.push({ code: 'TITLE_SHORT', message: `Title is brief (${t.length} chars). More detail improves discoverability.`, severity: 'low' });
  }

  // Too long
  if (t.length > TITLE_MAX_LEN) {
    const fixed = t.slice(0, TITLE_MAX_LEN).trim();
    score -= 3;
    issues.push({ code: 'TITLE_TOO_LONG', message: `Title too long (${t.length} chars, max ${TITLE_MAX_LEN}).`, severity: 'low', fix: fixed });
  }

  // Filler / low-quality patterns
  for (const pattern of TITLE_FILLER_PATTERNS) {
    if (pattern.test(t)) {
      score -= 8;
      issues.push({ code: 'TITLE_FILLER', message: 'Title contains filler/generic text.', severity: 'medium' });
      break;
    }
  }

  // All caps
  if (t.length > 10 && t === t.toUpperCase() && /[A-Z]{5,}/.test(t)) {
    const fixed = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    score -= 3;
    issues.push({ code: 'TITLE_ALL_CAPS', message: 'Title is entirely uppercase.', severity: 'low', fix: fixed });
  }

  // No alphabetic content
  if (!/[a-zA-Z]{3,}/.test(t)) {
    score -= 10;
    issues.push({ code: 'TITLE_NO_ALPHA', message: 'Title contains no meaningful alphabetic text.', severity: 'high' });
  }

  return { score: Math.max(0, score), issues };
}

/** Score attribute completeness from an array of offers */
export function scoreAttributeCompleteness(offers: readonly Offer[]): { score: number; issues: QualityIssue[] } {
  if (!offers.length) return { score: 0, issues: [{ code: 'NO_OFFERS', message: 'No offers found.', severity: 'high' }] };

  const issues: QualityIssue[] = [];
  let score = 15;

  const hasBrand     = offers.some(o => o.originalProduct?.brand && String(o.originalProduct.brand).trim().length > 1);
  const hasRating    = offers.some(o => typeof o.rating === 'number' && o.rating > 0);
  const hasOrigPrice = offers.some(o => typeof o.originalPrice === 'number' && o.originalPrice > 0);
  const hasColor     = offers.some(o => o.color && String(o.color).trim().length > 0);
  const hasSize      = offers.some(o => o.size && String(o.size).trim().length > 0);

  if (!hasBrand) {
    score -= 4;
    issues.push({ code: 'ATTR_NO_BRAND', message: 'No brand information across any offer.', severity: 'medium' });
  }
  if (!hasRating) {
    score -= 3;
    issues.push({ code: 'ATTR_NO_RATING', message: 'No customer rating available.', severity: 'low' });
  }
  if (!hasOrigPrice) {
    score -= 4;
    issues.push({ code: 'ATTR_NO_ORIG_PRICE', message: 'No original/MRP price found — cannot compute discount %.', severity: 'medium' });
  }
  if (!hasColor && !hasSize) {
    score -= 2;
    issues.push({ code: 'ATTR_NO_VARIANTS', message: 'No color or size variant information.', severity: 'low' });
  }

  return { score: Math.max(0, score), issues };
}

/** Score canonical confidence (0–1 input → 0–15 output) */
export function scoreCanonicalConfidence(confidence: number): { score: number; issue?: QualityIssue } {
  const clamped = Math.max(0, Math.min(1, confidence));
  const score = Math.round(clamped * 15);

  if (clamped < 0.4) {
    return {
      score,
      issue: {
        code:     'CANONICAL_LOW_CONFIDENCE',
        message:  `Low canonical confidence (${Math.round(clamped * 100)}%) — offers may represent different products.`,
        severity: 'high',
      },
    };
  }
  if (clamped < 0.7) {
    return {
      score,
      issue: {
        code:     'CANONICAL_MEDIUM_CONFIDENCE',
        message:  `Moderate canonical confidence (${Math.round(clamped * 100)}%).`,
        severity: 'medium',
      },
    };
  }
  return { score };
}

/** Score duplicate confidence based on how similar offer titles are to each other */
export function scoreDuplicateConfidence(offers: readonly Offer[]): { score: number; issue?: QualityIssue } {
  if (offers.length <= 1) return { score: 10 }; // single offer = no dupe risk

  // Compute pairwise normalized edit-distance proxy via token overlap
  const titleTokenSets = offers.map(o =>
    new Set(o.title.toLowerCase().split(/\s+/).filter(t => t.length > 2))
  );

  let totalSimilarity = 0;
  let pairs = 0;
  for (let i = 0; i < titleTokenSets.length; i++) {
    for (let j = i + 1; j < titleTokenSets.length; j++) {
      const a = titleTokenSets[i];
      const b = titleTokenSets[j];
      const intersection = [...a].filter(t => b.has(t)).length;
      const union = new Set([...a, ...b]).size;
      totalSimilarity += union > 0 ? intersection / union : 0;
      pairs++;
    }
  }

  const avgSimilarity = pairs > 0 ? totalSimilarity / pairs : 1;

  if (avgSimilarity < 0.3) {
    return {
      score: 2,
      issue: {
        code:     'DUPLICATE_LOW_SIMILARITY',
        message:  `Offer titles have low similarity (${Math.round(avgSimilarity * 100)}%) — may be mismatched products grouped together.`,
        severity: 'high',
      },
    };
  }
  if (avgSimilarity < 0.5) {
    return {
      score: 6,
      issue: {
        code:     'DUPLICATE_MEDIUM_SIMILARITY',
        message:  `Offer title similarity is moderate (${Math.round(avgSimilarity * 100)}%).`,
        severity: 'medium',
      },
    };
  }
  return { score: 10 };
}

/** Score retailer price agreement — low spread = more trustworthy data */
export function scoreRetailerAgreement(offers: readonly Offer[]): { score: number; issue?: QualityIssue } {
  if (offers.length <= 1) return { score: 15 }; // single retailer = nothing to compare

  const prices = offers.map(o => o.price).filter(p => p > 0);
  if (prices.length <= 1) return { score: 10 };

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = min > 0 ? (max - min) / min : 0;

  if (spread <= PRICE_SPREAD_OK) return { score: 15 };

  if (spread <= PRICE_SPREAD_WARN) {
    return {
      score: 10,
      issue: {
        code:     'PRICE_SPREAD_MEDIUM',
        message:  `Price spread across retailers is ${Math.round(spread * 100)}% (low–high: ₹${min}–₹${max}).`,
        severity: 'low',
      },
    };
  }

  if (spread <= PRICE_SPREAD_BAD) {
    return {
      score: 5,
      issue: {
        code:     'PRICE_SPREAD_HIGH',
        message:  `High price spread across retailers: ${Math.round(spread * 100)}% (₹${min}–₹${max}).`,
        severity: 'medium',
      },
    };
  }

  return {
    score: 0,
    issue: {
      code:     'PRICE_SPREAD_EXTREME',
      message:  `Extreme price spread: ${Math.round(spread * 100)}% (₹${min}–₹${max}). Data may be unreliable.`,
      severity: 'high',
    },
  };
}

/** Score missing critical fields — penalty-based (starts at 10, deducted per problem) */
export function scoreMissingFields(offers: readonly Offer[]): { score: number; issues: QualityIssue[] } {
  if (!offers.length) {
    return {
      score: 0,
      issues: [{ code: 'MISSING_ALL_OFFERS', message: 'Product has no offers.', severity: 'high' }],
    };
  }

  const issues: QualityIssue[] = [];
  let score = 10;

  const missingUrl   = offers.filter(o => !o.productUrl || !o.productUrl.startsWith('http'));
  const missingPrice = offers.filter(o => !o.price || o.price <= 0);
  const missingImage = offers.filter(o => !o.imageUrl || !o.imageUrl.startsWith('https'));

  if (missingUrl.length > 0) {
    score -= 4;
    issues.push({
      code:     'MISSING_PRODUCT_URL',
      message:  `${missingUrl.length}/${offers.length} offers have missing or invalid product URLs.`,
      severity: 'high',
    });
  }
  if (missingPrice.length > 0) {
    score -= 4;
    issues.push({
      code:     'MISSING_PRICE',
      message:  `${missingPrice.length}/${offers.length} offers have zero or missing price.`,
      severity: 'high',
    });
  }
  if (missingImage.length > 0) {
    score -= 2;
    issues.push({
      code:     'MISSING_IMAGE_URL',
      message:  `${missingImage.length}/${offers.length} offers have missing/non-https image URLs.`,
      severity: 'medium',
    });
  }

  return { score: Math.max(0, score), issues };
}

// ─── Grade helper ─────────────────────────────────────────────────────────────

export function scoreToGrade(score: number): QualityGrade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Compute a quality score for a single CanonicalProduct.
 * Pure function — no DB calls.
 */
export function computeProductQuality(product: CanonicalProduct): ProductQualityResult {
  const offers = product.offers as Offer[];

  // 1. Title quality
  const titleResult = scoreTitleQuality(product.title);

  // 2. Image quality — use best image across offers
  const bestImageUrl =
    offers.find(o => o.imageUrl?.startsWith('https://') && !PLACEHOLDER_IMAGE_PATTERNS.some(p => p.test(o.imageUrl)))?.imageUrl ??
    offers[0]?.imageUrl ?? '';
  const imageResult = scoreImageUrl(bestImageUrl);

  // 3. Attribute completeness
  const attrResult = scoreAttributeCompleteness(offers);

  // 4. Canonical confidence
  const canonicalResult = scoreCanonicalConfidence(product.confidence ?? 0);

  // 5. Duplicate confidence (token overlap between offer titles)
  const dupeResult = scoreDuplicateConfidence(offers);

  // 6. Retailer agreement (price spread)
  const retailerResult = scoreRetailerAgreement(offers);

  // 7. Missing field penalty
  const missingResult = scoreMissingFields(offers);

  const signals: SignalScores = {
    titleQuality:          titleResult.score,
    imageQuality:          imageResult.score,
    attributeCompleteness: attrResult.score,
    canonicalConfidence:   canonicalResult.score,
    duplicateConfidence:   dupeResult.score,
    retailerAgreement:     retailerResult.score,
    missingFieldPenalty:   missingResult.score,
  };

  const total = Object.values(signals).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, Math.round(total)));

  // Collect all issues
  const issues: QualityIssue[] = [
    ...titleResult.issues,
    ...(imageResult.issue ? [imageResult.issue] : []),
    ...attrResult.issues,
    ...(canonicalResult.issue ? [canonicalResult.issue] : []),
    ...(dupeResult.issue ? [dupeResult.issue] : []),
    ...(retailerResult.issue ? [retailerResult.issue] : []),
    ...missingResult.issues,
  ];

  return {
    canonicalId:          product.id,
    title:                product.title,
    score,
    grade:                scoreToGrade(score),
    signals,
    issues,
    offerCount:           offers.length,
    platforms:            [...new Set(offers.map(o => o.platform))],
    representativeImage:  bestImageUrl,
  };
}
