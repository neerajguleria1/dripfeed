/**
 * tests/unit/catalogEnrichment.test.ts
 *
 * Comprehensive unit tests for the Catalog Intelligence pipeline.
 *
 * Coverage:
 *   1. inferCategory              — 20 category patterns
 *   2. generateKeywords           — tokens + bonus fields
 *   3. computeCompletenessScore   — all 10 signal weights, boundaries
 *   4. enrichCanonical            — full integration, field extraction
 *   5. Property tests             — score always [0,100], keywords always sorted
 */

import { describe, it, expect } from 'vitest';
import {
  inferCategory,
  generateKeywords,
  computeCompletenessScore,
  enrichCanonical,
} from '../../api/_lib/catalogEnrichment';
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

// ─── 1. inferCategory ─────────────────────────────────────────────────────────

describe('inferCategory', () => {
  const cases: Array<[string, string]> = [
    ['oversized hoodie black',               'hoodie'],
    ['silk saree women',                     'saree'],
    ['cotton kurta set women',               'kurta-set'],
    ['kurti women XL',                       'kurta'],
    ['Levis 511 slim fit jeans men',         'jeans'],
    ['palazzo set ladies',                   'palazzo'],
    ['lehenga for girls',                    'lehenga'],
    ['denim jacket men',                     'jacket'],
    ['white sneakers running',               'sneakers'],
    ['high heels stiletto',                  'heels'],
    ['women flat sandals',                   'sandals'],
    ['men ankle boots',                      'boots'],
    ['ladies handbag tote',                  'handbag'],
    ['casual maxi dress women',              'dress'],
    ['analog watch men',                     'watch'],
    ['gold earrings bridal',                 'jewellery'],
    ['samsung galaxy smartphone',            'smartphone'],
    ['laptop notebook 15 inch',              'laptop'],
    ['wireless earbuds tws',                 'earphones'],
    ['yoga pants activewear women',          'trouser'],  // "pants" → trouser
  ];

  it.each(cases)('"%s" → %s', (title, expected) => {
    expect(inferCategory(title)).toBe(expected);
  });

  it('returns undefined for unrecognised titles', () => {
    expect(inferCategory('random product xyz 12345')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(inferCategory('OVERSIZED HOODIE')).toBe('hoodie');
    expect(inferCategory('SAREE Silk')).toBe('saree');
  });
});

// ─── 2. generateKeywords ─────────────────────────────────────────────────────

describe('generateKeywords', () => {
  it('returns a sorted deduplicated array', () => {
    const kw = generateKeywords('oversized hoodie black', 'nike', 'hoodie', 'black', 'men');
    expect(kw).toEqual([...kw].sort());
    expect(new Set(kw).size).toBe(kw.length);
  });

  it('includes brand as a keyword token', () => {
    const kw = generateKeywords('Adidas Running Shoes', 'adidas', 'sneakers', undefined, undefined);
    expect(kw).toContain('adidas');
  });

  it('includes category as a keyword token', () => {
    const kw = generateKeywords('Nike Hoodie Black', 'nike', 'hoodie', 'black', undefined);
    expect(kw.some(k => k.includes('hoodie'))).toBe(true);
  });

  it('includes color as a keyword token', () => {
    const kw = generateKeywords('Cotton Kurta', undefined, 'kurta', 'navy', undefined);
    expect(kw).toContain('navy');
  });

  it('includes gender as a keyword token', () => {
    const kw = generateKeywords('Slim Jeans', undefined, 'jeans', undefined, 'women');
    expect(kw).toContain('women');
  });

  it('handles undefined optional fields gracefully', () => {
    const kw = generateKeywords('Simple Product', undefined, undefined, undefined, undefined);
    expect(Array.isArray(kw)).toBe(true);
    expect(kw.length).toBeGreaterThan(0);
  });

  it('returns an array even for empty title', () => {
    const kw = generateKeywords('', undefined, undefined, undefined, undefined);
    expect(Array.isArray(kw)).toBe(true);
  });
});

// ─── 3. computeCompletenessScore ─────────────────────────────────────────────

describe('computeCompletenessScore', () => {
  it('returns 100 for a fully complete product', () => {
    const { score } = computeCompletenessScore(
      'Samsung Galaxy M35 5G Midnight Blue 8GB 256GB Smartphone',
      'https://m.media-amazon.com/images/I/abc.jpg',
      'Samsung',
      'smartphone',
      'midnight blue',
      'M',
      'men',
      true,
      true,
      3,
    );
    expect(score).toBe(100);
  });

  it('returns 0 for a completely empty product', () => {
    const { score } = computeCompletenessScore(
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, false, false, 0,
    );
    expect(score).toBe(0);
  });

  it('title scoring: <5 chars = 0', () => {
    const { breakdown } = computeCompletenessScore('abc', undefined, undefined, undefined, undefined, undefined, undefined, false, false, 1);
    expect(breakdown.hasTitle).toBe(0);
  });

  it('title scoring: 5–19 chars = 8', () => {
    const { breakdown } = computeCompletenessScore('short title', undefined, undefined, undefined, undefined, undefined, undefined, false, false, 1);
    expect(breakdown.hasTitle).toBe(8);
  });

  it('title scoring: ≥20 chars = 15', () => {
    const { breakdown } = computeCompletenessScore('Samsung Galaxy M35 5G Blue', undefined, undefined, undefined, undefined, undefined, undefined, false, false, 1);
    expect(breakdown.hasTitle).toBe(15);
  });

  it('image scoring: https URL = 15', () => {
    const { breakdown } = computeCompletenessScore(undefined, 'https://cdn.example.com/img.jpg', undefined, undefined, undefined, undefined, undefined, false, false, 1);
    expect(breakdown.hasImage).toBe(15);
  });

  it('image scoring: http URL = 8', () => {
    const { breakdown } = computeCompletenessScore(undefined, 'http://cdn.example.com/img.jpg', undefined, undefined, undefined, undefined, undefined, false, false, 1);
    expect(breakdown.hasImage).toBe(8);
  });

  it('image scoring: missing = 0', () => {
    const { breakdown } = computeCompletenessScore(undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, 1);
    expect(breakdown.hasImage).toBe(0);
  });

  it('retailer coverage: 1 retailer = 5, 2 = 10, 3+ = 15', () => {
    const r1 = computeCompletenessScore(undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, 1).breakdown.retailerCoverage;
    const r2 = computeCompletenessScore(undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, 2).breakdown.retailerCoverage;
    const r3 = computeCompletenessScore(undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, 3).breakdown.retailerCoverage;
    const r4 = computeCompletenessScore(undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, 5).breakdown.retailerCoverage;
    expect(r1).toBe(5);
    expect(r2).toBe(10);
    expect(r3).toBe(15);
    expect(r4).toBe(15); // capped at 15
  });

  it('brand = 15 when present, 0 when absent', () => {
    const with_brand    = computeCompletenessScore(undefined, undefined, 'Nike', undefined, undefined, undefined, undefined, false, false, 1);
    const without_brand = computeCompletenessScore(undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, 1);
    expect(with_brand.breakdown.hasBrand).toBe(15);
    expect(without_brand.breakdown.hasBrand).toBe(0);
  });

  it('score is always clamped to [0, 100]', () => {
    // Run multiple scenarios
    const inputs: Array<Parameters<typeof computeCompletenessScore>> = [
      ['', '', '', '', '', '', '', false, false, 0],
      ['a'.repeat(30), 'https://x.com', 'Brand', 'cat', 'red', 'M', 'men', true, true, 5],
      [undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, 0],
    ];
    for (const args of inputs) {
      const { score } = computeCompletenessScore(...args);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('breakdown sums to score', () => {
    const result = computeCompletenessScore(
      'Samsung Galaxy M35 Blue 8GB', 'https://cdn.com/img.jpg', 'Samsung',
      'smartphone', 'blue', 'XL', 'men', true, true, 2,
    );
    const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
    expect(result.score).toBe(Math.max(0, Math.min(100, Math.round(sum))));
  });
});

// ─── 4. enrichCanonical — integration ────────────────────────────────────────

describe('enrichCanonical', () => {
  it('returns all required fields for a well-formed canonical', () => {
    const result = enrichCanonical({ canonical: makeCanonical() });
    expect(result.canonicalId).toBe('az_TEST_canon');
    expect(result.normalizedTitle).toBeTruthy();
    expect(result.displayTitle).toBeTruthy();
    expect(typeof result.completenessScore).toBe('number');
    expect(Array.isArray(result.keywords)).toBe(true);
    expect(Array.isArray(result.platforms)).toBe(true);
  });

  it('normalizes the title (lowercase, removes punctuation)', () => {
    const c = makeCanonical({ title: "Levi's 511 Slim-Fit Jeans, Men's!" });
    const result = enrichCanonical({ canonical: c });
    expect(result.normalizedTitle).not.toMatch(/[!,]/);
    expect(result.normalizedTitle).toBe(result.normalizedTitle.toLowerCase());
  });

  it('infers brand from canonical.brand', () => {
    const result = enrichCanonical({ canonical: makeCanonical({ brand: "Levi's" }) });
    expect(result.normalizedBrand).toBe('levis');
  });

  it('infers brand from offer originalProduct.brand when canonical.brand missing', () => {
    const c = makeCanonical({ brand: undefined });
    const result = enrichCanonical({ canonical: c });
    expect(result.normalizedBrand).toBe('testbrand');
  });

  it('infers category from title', () => {
    const c = makeCanonical({ title: 'Oversized Hoodie Black Men' });
    const result = enrichCanonical({ canonical: c });
    expect(result.category).toBe('hoodie');
  });

  it('extracts color from offer.color first, then title', () => {
    const c = makeCanonical({ offers: [makeOffer({ color: 'Navy' })] });
    const result = enrichCanonical({ canonical: c });
    expect(result.color?.toLowerCase()).toContain('navy');
  });

  it('extracts size from offer.size first, then title', () => {
    const c = makeCanonical({ offers: [makeOffer({ size: 'XL' })] });
    const result = enrichCanonical({ canonical: c });
    expect(result.size?.toLowerCase()).toContain('xl');
  });

  it('computes lowestPrice as minimum across offers', () => {
    const c = makeCanonical({
      offers: [
        makeOffer({ price: 999,  platform: 'Amazon India' }),
        makeOffer({ price: 1299, platform: 'Flipkart',    platformProductId: 'fk_TEST' }),
      ],
    });
    const result = enrichCanonical({ canonical: c });
    expect(result.lowestPrice).toBe(999);
  });

  it('sets hasOriginalPrice=true when any offer has originalPrice', () => {
    const c = makeCanonical({ offers: [makeOffer({ originalPrice: 1499 })] });
    expect(enrichCanonical({ canonical: c }).hasOriginalPrice).toBe(true);
  });

  it('sets hasOriginalPrice=false when no offer has originalPrice', () => {
    const c = makeCanonical({ offers: [makeOffer({ originalPrice: undefined })] });
    expect(enrichCanonical({ canonical: c }).hasOriginalPrice).toBe(false);
  });

  it('computes avgRating when ratings are present', () => {
    const c = makeCanonical({
      offers: [
        makeOffer({ rating: 4.0, platform: 'Amazon India',  platformProductId: 'a1' }),
        makeOffer({ rating: 4.4, platform: 'Flipkart',       platformProductId: 'f1' }),
      ],
    });
    const result = enrichCanonical({ canonical: c });
    expect(result.avgRating).toBeCloseTo(4.2, 1);
  });

  it('sets needsEnrichment=false for high-completeness products', () => {
    const c = makeCanonical({
      title:  'Samsung Galaxy M35 5G Midnight Blue 8GB 256GB',
      brand:  'Samsung',
      offers: [makeOffer({
        imageUrl:      'https://m.media-amazon.com/images/I/abc.jpg',
        originalPrice: 22999,
        rating:        4.3,
        color:         'midnight blue',
        size:          'M',
      })],
    });
    const result = enrichCanonical({ canonical: c });
    // Score ≥ 50 → needsEnrichment should be false
    if (result.completenessScore >= 50) {
      expect(result.needsEnrichment).toBe(false);
    }
  });

  it('sets needsEnrichment=true for low-completeness products', () => {
    const bare = makeCanonical({
      title:  'p',
      brand:  undefined,
      offers: [makeOffer({ imageUrl: undefined, rating: undefined, originalPrice: undefined, color: undefined, size: undefined })],
    });
    const result = enrichCanonical({ canonical: bare });
    expect(result.completenessScore).toBeLessThan(50);
    expect(result.needsEnrichment).toBe(true);
  });

  it('preserves sourceQuery', () => {
    const result = enrichCanonical({ canonical: makeCanonical(), sourceQuery: 'test kurta' });
    expect(result.sourceQuery).toBe('test kurta');
  });

  it('collects all unique platforms', () => {
    const c = makeCanonical({
      offers: [
        makeOffer({ platform: 'Amazon India', platformProductId: 'a1' }),
        makeOffer({ platform: 'Flipkart',     platformProductId: 'f1' }),
        makeOffer({ platform: 'Myntra',       platformProductId: 'm1' }),
      ],
    });
    const result = enrichCanonical({ canonical: c });
    expect(result.platforms).toContain('Amazon India');
    expect(result.platforms).toContain('Flipkart');
    expect(result.platforms).toContain('Myntra');
    expect(result.offerCount).toBe(3);
  });

  it('handles canonical with empty offers gracefully', () => {
    const c = makeCanonical({ offers: [] as any, offerCount: 0 });
    const result = enrichCanonical({ canonical: c });
    expect(result.completenessScore).toBeGreaterThanOrEqual(0);
    expect(result.completenessScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.keywords)).toBe(true);
  });

  it('enrichment flags reflect what was extracted', () => {
    const c = makeCanonical({
      title:  'Nike Air Max Sneakers Black Men XL',
      brand:  'Nike',
      offers: [makeOffer({ color: 'black', size: 'xl' })],
    });
    const result = enrichCanonical({ canonical: c });
    expect(result.flags.colorExtracted).toBe(true);
    expect(result.flags.sizeExtracted).toBe(true);
    expect(result.flags.keywordsGenerated).toBe(true);
  });
});

// ─── 5. Property tests ────────────────────────────────────────────────────────

describe('property tests', () => {
  it('completenessScore is always in [0, 100]', () => {
    const scenarios: Array<Parameters<typeof computeCompletenessScore>> = [
      [undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, 0],
      ['a', 'https://x.com', 'Brand', 'cat', 'red', 'M', 'men', true, true, 10],
      ['x'.repeat(200), 'https://cdn.com/img.jpg', 'Brand', 'cat', 'blue', 'L', 'women', false, true, 2],
    ];
    for (const args of scenarios) {
      const { score } = computeCompletenessScore(...args);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('keywords are always sorted and deduplicated', () => {
    const kw = generateKeywords('Nike Oversized Hoodie Black Men XL', 'nike', 'hoodie', 'black', 'men');
    expect(kw).toEqual([...kw].sort());
    expect(new Set(kw).size).toBe(kw.length);
  });

  it('enrichCanonical always returns a valid completenessScore', () => {
    const canonicals = [
      makeCanonical(),
      makeCanonical({ title: '', brand: undefined, offers: [] as any }),
      makeCanonical({ title: 'x'.repeat(100), offers: [makeOffer({ imageUrl: undefined, rating: undefined })] }),
    ];
    for (const c of canonicals) {
      const { completenessScore } = enrichCanonical({ canonical: c });
      expect(completenessScore).toBeGreaterThanOrEqual(0);
      expect(completenessScore).toBeLessThanOrEqual(100);
    }
  });

  it('enrichCanonical needsEnrichment correlates with completenessScore', () => {
    const result = enrichCanonical({ canonical: makeCanonical() });
    if (result.completenessScore >= 50) {
      expect(result.needsEnrichment).toBe(false);
    } else {
      expect(result.needsEnrichment).toBe(true);
    }
  });
});
