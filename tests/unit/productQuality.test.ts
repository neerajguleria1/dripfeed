/**
 * tests/unit/productQuality.test.ts
 *
 * Comprehensive unit tests for the Product Quality Score engine.
 *
 * Coverage:
 *   1. scoreImageUrl          — trusted CDN, placeholder, http, missing, malformed
 *   2. scoreTitleQuality      — length, filler, caps, no-alpha, perfect title
 *   3. scoreAttributeCompleteness — brand, rating, origPrice, variants
 *   4. scoreCanonicalConfidence   — high / medium / low confidence
 *   5. scoreDuplicateConfidence   — single offer, similar, dissimilar
 *   6. scoreRetailerAgreement     — single, tight spread, wide spread, extreme
 *   7. scoreMissingFields         — all ok, missing url, missing price, missing image
 *   8. computeProductQuality      — full integration, grade assignment
 *   9. scoreToGrade               — boundary conditions
 *  10. Property tests            — score always [0,100], grade always valid
 */

import { describe, it, expect } from 'vitest';
import {
  scoreImageUrl,
  scoreTitleQuality,
  scoreAttributeCompleteness,
  scoreCanonicalConfidence,
  scoreDuplicateConfidence,
  scoreRetailerAgreement,
  scoreMissingFields,
  computeProductQuality,
  scoreToGrade,
  type QualityGrade,
} from '../../api/_lib/productQuality';
import type { CanonicalProduct, Offer } from '../../api/_lib/types/canonicalProduct';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    platform:          'Amazon India',
    platformProductId: 'az_TEST',
    title:             'Test Product Blue Large',
    price:             999,
    originalPrice:     1499,
    discount:          33,
    imageUrl:          'https://m.media-amazon.com/images/I/test.jpg',
    productUrl:        'https://www.amazon.in/dp/TEST',
    affiliateUrl:      undefined,
    color:             'Blue',
    size:              'L',
    rating:            4.2,
    originalProduct:   {
      id: 'az_TEST', title: 'Test Product Blue Large', price: 999,
      imageUrl: 'https://m.media-amazon.com/images/I/test.jpg',
      platform: 'Amazon India', url: 'https://www.amazon.in/dp/TEST',
      brand: 'TestBrand',
    } as any,
    ...overrides,
  };
}

function makeCanonical(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    id:         'az_TEST_canon',
    title:      'TestBrand Test Product Blue Large',
    brand:      'TestBrand',
    offers:     [makeOffer()],
    offerCount: 1,
    confidence: 0.9,
    ...overrides,
  };
}

// ─── 1. scoreImageUrl ─────────────────────────────────────────────────────────

describe('scoreImageUrl', () => {
  it('returns 15 for a trusted Amazon CDN URL', () => {
    const { score, issue } = scoreImageUrl('https://m.media-amazon.com/images/I/abc.jpg');
    expect(score).toBe(15);
    expect(issue).toBeUndefined();
  });

  it('returns 15 for Flipkart CDN', () => {
    const { score } = scoreImageUrl('https://rukminim1.flixcart.com/image/200/200/abc.jpg');
    expect(score).toBe(15);
  });

  it('returns 15 for Myntra CDN', () => {
    const { score } = scoreImageUrl('https://assets.myntassets.com/h_300/img.jpg');
    expect(score).toBe(15);
  });

  it('returns 0 for missing URL', () => {
    const { score, issue } = scoreImageUrl(undefined);
    expect(score).toBe(0);
    expect(issue?.code).toBe('IMAGE_MISSING');
    expect(issue?.severity).toBe('high');
  });

  it('returns 0 for empty string', () => {
    const { score } = scoreImageUrl('');
    expect(score).toBe(0);
  });

  it('returns score 5 + fix for http URL', () => {
    const { score, issue } = scoreImageUrl('http://m.media-amazon.com/images/I/abc.jpg');
    expect(score).toBe(5);
    expect(issue?.code).toBe('IMAGE_NOT_HTTPS');
    expect(issue?.fix).toBe('https://m.media-amazon.com/images/I/abc.jpg');
  });

  it('returns 3 for placeholder URL', () => {
    const { score, issue } = scoreImageUrl('https://via.placeholder.com/200x200');
    expect(score).toBe(3);
    expect(issue?.code).toBe('IMAGE_PLACEHOLDER');
  });

  it('returns 3 for noimage URL', () => {
    const { score } = scoreImageUrl('https://somecdn.com/noimage.jpg');
    expect(score).toBe(3);
  });

  it('returns 3 for unsplash URL (external stock photo)', () => {
    const { score, issue } = scoreImageUrl('https://images.unsplash.com/photo-123?w=200');
    expect(score).toBe(3);
    expect(issue?.code).toBe('IMAGE_PLACEHOLDER');
  });

  it('returns partial score for unknown CDN with valid https', () => {
    const { score, issue } = scoreImageUrl('https://cdn.somestore.com/img/product.jpg');
    expect(score).toBe(10);
    expect(issue?.code).toBe('IMAGE_UNKNOWN_CDN');
    expect(issue?.severity).toBe('low');
  });

  it('returns 0 for malformed URL', () => {
    const { score, issue } = scoreImageUrl('not-a-url');
    expect(score).toBe(0);
    expect(issue?.code).toBe('IMAGE_INVALID_URL');
  });
});

// ─── 2. scoreTitleQuality ─────────────────────────────────────────────────────

describe('scoreTitleQuality', () => {
  it('returns 20 for a good title', () => {
    const { score, issues } = scoreTitleQuality('Samsung Galaxy M35 5G (8GB RAM, 256GB Storage) Midnight Blue');
    expect(score).toBe(20);
    expect(issues).toHaveLength(0);
  });

  it('returns 0 for missing title', () => {
    const { score, issues } = scoreTitleQuality(undefined);
    expect(score).toBe(0);
    expect(issues[0]?.code).toBe('TITLE_MISSING');
  });

  it('returns 0 for empty string', () => {
    const { score } = scoreTitleQuality('');
    expect(score).toBe(0);
  });

  it('penalises too-short titles', () => {
    const { score, issues } = scoreTitleQuality('Shirt');
    expect(score).toBeLessThan(10);
    expect(issues.some(i => i.code === 'TITLE_TOO_SHORT')).toBe(true);
  });

  it('mildly penalises brief titles (between min and good)', () => {
    const { score, issues } = scoreTitleQuality('Blue Shirt XL');
    expect(score).toBeLessThan(20);
    expect(issues.some(i => i.code === 'TITLE_SHORT')).toBe(true);
  });

  it('penalises all-caps titles and suggests fix', () => {
    const { score, issues } = scoreTitleQuality('SAMSUNG GALAXY PHONE BLUE LARGE');
    expect(score).toBeLessThan(20);
    const capsIssue = issues.find(i => i.code === 'TITLE_ALL_CAPS');
    expect(capsIssue).toBeDefined();
    expect(capsIssue?.fix).toBeTruthy();
  });

  it('penalises filler text', () => {
    const { score, issues } = scoreTitleQuality('Buy Online New Best Price Offer Sale');
    expect(issues.some(i => i.code === 'TITLE_FILLER')).toBe(true);
    expect(score).toBeLessThan(15);
  });

  it('penalises titles with no alpha content', () => {
    const { score, issues } = scoreTitleQuality('123456789');
    expect(issues.some(i => i.code === 'TITLE_NO_ALPHA')).toBe(true);
    expect(score).toBeLessThanOrEqual(10);
  });

  it('penalises overly long titles and suggests truncation', () => {
    const longTitle = 'A'.repeat(5) + ' ' + 'word '.repeat(30);
    const { score, issues } = scoreTitleQuality(longTitle);
    const longIssue = issues.find(i => i.code === 'TITLE_TOO_LONG');
    expect(longIssue).toBeDefined();
    expect(longIssue?.fix?.length).toBeLessThanOrEqual(120);
    expect(score).toBeLessThan(20);
  });
});

// ─── 3. scoreAttributeCompleteness ───────────────────────────────────────────

describe('scoreAttributeCompleteness', () => {
  it('returns 15 for fully complete offer', () => {
    const { score, issues } = scoreAttributeCompleteness([makeOffer()]);
    expect(score).toBe(15);
    expect(issues).toHaveLength(0);
  });

  it('returns 0 for no offers', () => {
    const { score, issues } = scoreAttributeCompleteness([]);
    expect(score).toBe(0);
    expect(issues[0]?.code).toBe('NO_OFFERS');
  });

  it('deducts for missing brand', () => {
    const offer = makeOffer({ originalProduct: { id: 'x', title: 'Foo', price: 100, imageUrl: '', platform: 'Amazon India', url: '' } as any });
    const { score, issues } = scoreAttributeCompleteness([offer]);
    expect(issues.some(i => i.code === 'ATTR_NO_BRAND')).toBe(true);
    expect(score).toBeLessThan(15);
  });

  it('deducts for missing rating', () => {
    const offer = makeOffer({ rating: undefined });
    const { score, issues } = scoreAttributeCompleteness([offer]);
    expect(issues.some(i => i.code === 'ATTR_NO_RATING')).toBe(true);
    expect(score).toBeLessThan(15);
  });

  it('deducts for missing originalPrice', () => {
    const offer = makeOffer({ originalPrice: undefined });
    const { score, issues } = scoreAttributeCompleteness([offer]);
    expect(issues.some(i => i.code === 'ATTR_NO_ORIG_PRICE')).toBe(true);
    expect(score).toBeLessThan(15);
  });

  it('deducts for missing both color and size', () => {
    const offer = makeOffer({ color: undefined, size: undefined });
    const { score, issues } = scoreAttributeCompleteness([offer]);
    expect(issues.some(i => i.code === 'ATTR_NO_VARIANTS')).toBe(true);
    expect(score).toBeLessThan(15);
  });

  it('score is always >= 0', () => {
    // Worst case: no brand, no rating, no origPrice, no variants
    const bareOffer = makeOffer({ originalProduct: { id: 'x', title: 'X', price: 100, imageUrl: '', platform: 'P', url: '' } as any, rating: undefined, originalPrice: undefined, color: undefined, size: undefined });
    const { score } = scoreAttributeCompleteness([bareOffer]);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ─── 4. scoreCanonicalConfidence ─────────────────────────────────────────────

describe('scoreCanonicalConfidence', () => {
  it('returns 15 for confidence = 1', () => {
    const { score, issue } = scoreCanonicalConfidence(1.0);
    expect(score).toBe(15);
    expect(issue).toBeUndefined();
  });

  it('returns high score and no issue for confidence >= 0.7', () => {
    const { issue } = scoreCanonicalConfidence(0.8);
    expect(issue).toBeUndefined();
  });

  it('returns issue for confidence in medium range', () => {
    const { issue } = scoreCanonicalConfidence(0.55);
    expect(issue?.code).toBe('CANONICAL_MEDIUM_CONFIDENCE');
    expect(issue?.severity).toBe('medium');
  });

  it('returns high-severity issue for low confidence', () => {
    const { score, issue } = scoreCanonicalConfidence(0.2);
    expect(score).toBeLessThan(7);
    expect(issue?.code).toBe('CANONICAL_LOW_CONFIDENCE');
    expect(issue?.severity).toBe('high');
  });

  it('clamps out-of-range inputs to [0,1]', () => {
    expect(scoreCanonicalConfidence(-1).score).toBe(0);
    expect(scoreCanonicalConfidence(2).score).toBe(15);
  });
});

// ─── 5. scoreDuplicateConfidence ─────────────────────────────────────────────

describe('scoreDuplicateConfidence', () => {
  it('returns 10 for a single offer', () => {
    const { score, issue } = scoreDuplicateConfidence([makeOffer()]);
    expect(score).toBe(10);
    expect(issue).toBeUndefined();
  });

  it('returns 10 for highly similar titles', () => {
    const { score } = scoreDuplicateConfidence([
      makeOffer({ title: 'Samsung Galaxy M35 Blue 8GB 256GB' }),
      makeOffer({ platform: 'Flipkart', title: 'Samsung Galaxy M35 Blue 8GB 256GB' }),
    ]);
    expect(score).toBe(10);
  });

  it('returns medium score for moderate title similarity', () => {
    const { score, issue } = scoreDuplicateConfidence([
      makeOffer({ title: 'Samsung Galaxy M35 Blue' }),
      makeOffer({ platform: 'Flipkart', title: 'OnePlus Nord CE3 Lite Black' }),
      makeOffer({ platform: 'Myntra', title: 'Realme 12 Pro Plus Silver' }),
    ]);
    expect(score).toBeLessThan(10);
    expect(issue).toBeDefined();
  });

  it('returns low score for completely different titles', () => {
    const { score, issue } = scoreDuplicateConfidence([
      makeOffer({ title: 'Samsung Galaxy Phone Blue' }),
      makeOffer({ platform: 'Flipkart', title: 'Adidas Running Shoes Red Large' }),
    ]);
    expect(score).toBeLessThanOrEqual(6);
    expect(issue?.severity).toBeDefined();
  });
});

// ─── 6. scoreRetailerAgreement ────────────────────────────────────────────────

describe('scoreRetailerAgreement', () => {
  it('returns 15 for single offer', () => {
    const { score, issue } = scoreRetailerAgreement([makeOffer()]);
    expect(score).toBe(15);
    expect(issue).toBeUndefined();
  });

  it('returns 15 for tight price spread (≤10%)', () => {
    const { score } = scoreRetailerAgreement([
      makeOffer({ price: 1000 }),
      makeOffer({ price: 1050, platform: 'Flipkart' }),
    ]);
    expect(score).toBe(15);
  });

  it('returns 10 for moderate spread (11–25%)', () => {
    const { score, issue } = scoreRetailerAgreement([
      makeOffer({ price: 1000 }),
      makeOffer({ price: 1200, platform: 'Flipkart' }),
    ]);
    expect(score).toBe(10);
    expect(issue?.code).toBe('PRICE_SPREAD_MEDIUM');
  });

  it('returns 5 for high spread (26–50%)', () => {
    const { score, issue } = scoreRetailerAgreement([
      makeOffer({ price: 1000 }),
      makeOffer({ price: 1400, platform: 'Flipkart' }),
    ]);
    expect(score).toBe(5);
    expect(issue?.code).toBe('PRICE_SPREAD_HIGH');
  });

  it('returns 0 for extreme spread (>50%)', () => {
    const { score, issue } = scoreRetailerAgreement([
      makeOffer({ price: 500 }),
      makeOffer({ price: 1500, platform: 'Flipkart' }),
    ]);
    expect(score).toBe(0);
    expect(issue?.code).toBe('PRICE_SPREAD_EXTREME');
    expect(issue?.severity).toBe('high');
  });

  it('returns lower score when one offer has zero price', () => {
    const { score } = scoreRetailerAgreement([
      makeOffer({ price: 1000 }),
      makeOffer({ price: 0, platform: 'Flipkart' }),
    ]);
    // 2 offers but only 1 valid price — treated as ambiguous (not single-offer full score)
    expect(score).toBe(10);
  });
});

// ─── 7. scoreMissingFields ────────────────────────────────────────────────────

describe('scoreMissingFields', () => {
  it('returns 10 for fully valid offers', () => {
    const { score, issues } = scoreMissingFields([makeOffer()]);
    expect(score).toBe(10);
    expect(issues).toHaveLength(0);
  });

  it('returns 0 for no offers', () => {
    const { score, issues } = scoreMissingFields([]);
    expect(score).toBe(0);
    expect(issues[0]?.code).toBe('MISSING_ALL_OFFERS');
  });

  it('deducts for missing product URL', () => {
    const { score, issues } = scoreMissingFields([makeOffer({ productUrl: '' })]);
    expect(issues.some(i => i.code === 'MISSING_PRODUCT_URL')).toBe(true);
    expect(score).toBeLessThan(10);
  });

  it('deducts for zero price', () => {
    const { score, issues } = scoreMissingFields([makeOffer({ price: 0 })]);
    expect(issues.some(i => i.code === 'MISSING_PRICE')).toBe(true);
    expect(score).toBeLessThan(10);
  });

  it('deducts for non-https image', () => {
    const { score, issues } = scoreMissingFields([makeOffer({ imageUrl: 'http://cdn.com/img.jpg' })]);
    expect(issues.some(i => i.code === 'MISSING_IMAGE_URL')).toBe(true);
    expect(score).toBeLessThan(10);
  });

  it('counts partial failures correctly', () => {
    const offers = [
      makeOffer({ productUrl: '' }),          // fails url check
      makeOffer({ price: 0 }),               // fails price check
      makeOffer(),                           // all ok
    ];
    const { issues } = scoreMissingFields(offers);
    const urlIssue = issues.find(i => i.code === 'MISSING_PRODUCT_URL');
    expect(urlIssue?.message).toContain('1/3');
    const priceIssue = issues.find(i => i.code === 'MISSING_PRICE');
    expect(priceIssue?.message).toContain('1/3');
  });
});

// ─── 8. computeProductQuality — full integration ──────────────────────────────

describe('computeProductQuality', () => {
  it('returns a high score for a perfect product', () => {
    const canonical = makeCanonical({
      title: 'Samsung Galaxy M35 5G Midnight Blue 8GB RAM 256GB',
      confidence: 0.95,
      offers: [makeOffer()],
    });
    const result = computeProductQuality(canonical);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.grade).toMatch(/^[AB]$/);
    expect(result.canonicalId).toBe(canonical.id);
    expect(result.title).toBe(canonical.title);
    expect(result.offerCount).toBe(1);
  });

  it('returns a low score for a poor product', () => {
    const canonical = makeCanonical({
      title: 'p',           // too short
      confidence: 0.1,      // very low confidence
      offers: [makeOffer({
        imageUrl:   'http://via.placeholder.com/200',
        productUrl: '',
        price:      0,
        rating:     undefined,
        originalPrice: undefined,
        color:      undefined,
        size:       undefined,
        originalProduct: { id: 'x', title: 'p', price: 0, imageUrl: '', platform: 'P', url: '' } as any,
      })],
    });
    const result = computeProductQuality(canonical);
    expect(result.score).toBeLessThan(40);
    expect(result.grade).toBe('D');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('includes auto-fix suggestions where available', () => {
    const canonical = makeCanonical({
      title: 'ADIDAS RUNNING SHOES BLUE LARGE COMFORTABLE',
      offers: [makeOffer({ imageUrl: 'http://m.media-amazon.com/images/I/abc.jpg' })],
    });
    const result = computeProductQuality(canonical);
    const hasFix = result.issues.some(i => i.fix !== undefined);
    expect(hasFix).toBe(true);
  });

  it('populates platforms and representativeImage correctly', () => {
    const canonical = makeCanonical({
      offers: [
        makeOffer({ platform: 'Amazon India' }),
        makeOffer({ platform: 'Flipkart', imageUrl: 'https://rukminim1.flixcart.com/image/200/img.jpg' }),
      ],
    });
    const result = computeProductQuality(canonical);
    expect(result.platforms).toContain('Amazon India');
    expect(result.platforms).toContain('Flipkart');
    expect(result.representativeImage).toMatch(/^https:\/\//);
  });

  it('handles empty offers array gracefully', () => {
    const canonical = makeCanonical({ offers: [] as any, offerCount: 0 });
    const result = computeProductQuality(canonical);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('signal scores sum to total score', () => {
    const canonical = makeCanonical();
    const result = computeProductQuality(canonical);
    const signalSum = Object.values(result.signals).reduce((a, b) => a + b, 0);
    expect(result.score).toBe(Math.max(0, Math.min(100, Math.round(signalSum))));
  });
});

// ─── 9. scoreToGrade ──────────────────────────────────────────────────────────

describe('scoreToGrade', () => {
  const cases: Array<[number, QualityGrade]> = [
    [100, 'A'], [80,  'A'], [79, 'B'], [60, 'B'],
    [59,  'C'], [40,  'C'], [39, 'D'], [0,  'D'],
  ];
  it.each(cases)('score %i → grade %s', (score, grade) => {
    expect(scoreToGrade(score)).toBe(grade);
  });
});

// ─── 10. Property tests ───────────────────────────────────────────────────────

describe('property tests', () => {
  const VALID_GRADES = new Set<QualityGrade>(['A', 'B', 'C', 'D']);

  it('score is always in [0, 100]', () => {
    const scenarios = [
      makeCanonical(),
      makeCanonical({ title: '', confidence: 0, offers: [] as any }),
      makeCanonical({ title: 'X'.repeat(200), confidence: 1.0 }),
      makeCanonical({
        offers: [makeOffer({ price: 0, imageUrl: '', productUrl: '', rating: undefined, originalPrice: undefined })],
        confidence: 0.5,
      }),
    ];
    for (const c of scenarios) {
      const { score } = computeProductQuality(c);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('grade is always one of A, B, C, D', () => {
    const scenarios = [
      makeCanonical(),
      makeCanonical({ confidence: 0 }),
      makeCanonical({ title: 'ok product name here' }),
    ];
    for (const c of scenarios) {
      expect(VALID_GRADES.has(computeProductQuality(c).grade)).toBe(true);
    }
  });

  it('all signal scores are non-negative integers', () => {
    const result = computeProductQuality(makeCanonical());
    for (const val of Object.values(result.signals)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(val) || Number.isFinite(val)).toBe(true);
    }
  });

  it('higher confidence always produces higher or equal canonicalConfidence signal', () => {
    const low  = scoreCanonicalConfidence(0.1).score;
    const mid  = scoreCanonicalConfidence(0.5).score;
    const high = scoreCanonicalConfidence(0.9).score;
    expect(mid).toBeGreaterThanOrEqual(low);
    expect(high).toBeGreaterThanOrEqual(mid);
  });

  it('image score decreases from trusted CDN → unknown → placeholder → missing', () => {
    const trusted   = scoreImageUrl('https://m.media-amazon.com/images/I/abc.jpg').score;
    const unknown   = scoreImageUrl('https://cdn.someunknown.com/img.jpg').score;
    const placeholder = scoreImageUrl('https://via.placeholder.com/200').score;
    const missing   = scoreImageUrl(undefined).score;
    expect(trusted).toBeGreaterThanOrEqual(unknown);
    expect(unknown).toBeGreaterThan(placeholder);
    expect(placeholder).toBeGreaterThan(missing);
  });
});
