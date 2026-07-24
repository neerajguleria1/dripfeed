/**
 * matcher.test.ts
 *
 * Unit tests for the Product Matching Engine (Milestone 2).
 *
 * Covers:
 *   - calculateJaccard: edge cases and known values
 *   - calculateSimilarity: brand conflict, missing brand, full match
 *   - groupIntoCanonicals: all required grouping scenarios
 *   - Determinism: same input → same output
 *   - Immutability: input array never mutated
 */

import { describe, it, expect } from 'vitest';
import {
  calculateJaccard,
  calculateSimilarity,
  findBestMatch,
  groupIntoCanonicals,
} from '../../api/_lib/matcher.js';
import { normalizeProduct, normalizeProducts } from '../../api/_lib/normalizer.js';
import type { SearchProduct } from '../../api/_lib/types/searchProduct.js';
import type { NormalizedProduct } from '../../api/_lib/types/normalizedProduct.js';

// ─── Fixture factory ──────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<SearchProduct> & Pick<SearchProduct, 'id' | 'title' | 'platform'>): SearchProduct {
  return {
    price: 999,
    imageUrl: 'https://example.com/img.jpg',
    url: 'https://example.com/product',
    ...overrides,
  };
}

// ─── Platform fixtures — Nike Air Force 1 ────────────────────────────────────

const amazonNikeAF1 = makeProduct({
  id: 'az_nikeaf1',
  title: "Nike Men's Air Force 1 '07 Sneaker - White/White",
  brand: 'Nike',
  price: 7495,
  platform: 'Amazon India',
  url: 'https://www.amazon.in/dp/nikeaf1',
});

const flipkartNikeAF1 = makeProduct({
  id: 'fk_nikeaf1',
  title: "Nike Men's Air Force 1 Sneaker White",
  brand: 'Nike',
  price: 7295,
  platform: 'Flipkart',
  url: 'https://www.flipkart.com/nike-air-force-1/p/nikeaf1',
});

const myntraNikeAF1 = makeProduct({
  id: 'mn_nikeaf1',
  title: 'Nike Men White Air Force 1 Casual Shoes',
  brand: 'Nike',
  price: 7495,
  platform: 'Myntra',
  url: 'https://www.myntra.com/shoes/nike/nikeaf1/buy',
});

const ajioNikeAF1 = makeProduct({
  id: 'aj_nikeaf1',
  title: 'Nike Air Force 1 Sneaker',
  brand: 'Nike',
  price: 7495,
  platform: 'Ajio',
  url: 'https://www.ajio.com/nike-air-force-1/p/nikeaf1',
  color: 'White',
});

// ─── Fixture — completely different product ───────────────────────────────────

const bibaKurta = makeProduct({
  id: 'mn_bibakurta',
  title: 'Biba Women Ethnic Kurta Set with Dupatta',
  brand: 'Biba',
  price: 1299,
  platform: 'Myntra',
  url: 'https://www.myntra.com/kurta/biba/bibakurta/buy',
});

// ─── Fixture — same title, different brand ───────────────────────────────────

const pumaRunnerAmazon = makeProduct({
  id: 'az_pumarunner',
  title: 'Puma Men Running Shoes Lightweight',
  brand: 'Puma',
  price: 3499,
  platform: 'Amazon India',
  url: 'https://www.amazon.in/dp/pumarunner',
});

const nikeRunnerAmazon = makeProduct({
  id: 'az_nikerunner',
  title: 'Nike Men Running Shoes Lightweight',
  brand: 'Nike',
  price: 4999,
  platform: 'Amazon India',
  url: 'https://www.amazon.in/dp/nikerunner',
});

// ─── Fixture — missing brand ──────────────────────────────────────────────────
// Meesho title is intentionally very close to Amazon so Jaccard is high enough
// to overcome the reduced brand_score (0.5) and still cross 0.75.
// Required: 0.5*0.45 + jaccard*0.55 >= 0.75  →  jaccard >= 0.954
const meeshoNikeAF1 = makeProduct({
  id: 'ms_nikeaf1',
  title: "Nike Men's Air Force 1 '07 Sneaker - White/White",
  brand: undefined,
  price: 6999,
  platform: 'Meesho',
  url: 'https://www.meesho.com/nike-af1/p/ms_nikeaf1',
});

// ─── Fixture — duplicate (same product, same platform) ───────────────────────

const amazonNikeAF1Duplicate = makeProduct({
  id: 'az_nikeaf1_dup',
  title: "Nike Men's Air Force 1 '07 Sneaker - White/White",
  brand: 'Nike',
  price: 7495,
  platform: 'Amazon India',
  url: 'https://www.amazon.in/dp/nikeaf1_dup',
});

// ─── calculateJaccard ─────────────────────────────────────────────────────────

describe('calculateJaccard', () => {
  it('identical sets → 1.0', () => {
    expect(calculateJaccard(['air', 'force', 'nike'], ['air', 'force', 'nike'])).toBe(1);
  });

  it('disjoint sets → 0', () => {
    expect(calculateJaccard(['kurta', 'biba'], ['nike', 'air', 'force'])).toBe(0);
  });

  it('partial overlap — known value', () => {
    // A = {air, force, nike, white}  B = {air, force, nike, casual, white}
    // intersection = 4, union = 5 → 0.8
    const a = ['air', 'force', 'nike', 'white'];
    const b = ['air', 'casual', 'force', 'nike', 'white'];
    expect(calculateJaccard(a, b)).toBeCloseTo(0.8);
  });

  it('one empty set → 0', () => {
    expect(calculateJaccard([], ['nike', 'air'])).toBe(0);
  });

  it('both empty → 0', () => {
    expect(calculateJaccard([], [])).toBe(0);
  });

  it('single common token', () => {
    // intersection = 1, union = 3 → 0.333
    expect(calculateJaccard(['nike'], ['nike', 'air', 'force'])).toBeCloseTo(1 / 3);
  });
});

// ─── calculateSimilarity ─────────────────────────────────────────────────────

describe('calculateSimilarity', () => {
  it('same brand + identical tokens → 1.0', () => {
    const a = normalizeProduct(amazonNikeAF1);
    // Use same product as both sides
    expect(calculateSimilarity(a, a)).toBeCloseTo(1.0);
  });

  it('brand conflict → -1 (hard reject)', () => {
    const puma = normalizeProduct(pumaRunnerAmazon);
    const nike = normalizeProduct(nikeRunnerAmazon);
    expect(calculateSimilarity(puma, nike)).toBe(-1);
  });

  it('same brand + token overlap → score > 0.6 (Flipkart title variant)', () => {
    const az = normalizeProduct(amazonNikeAF1);
    const fk = normalizeProduct(flipkartNikeAF1);
    expect(calculateSimilarity(az, fk)).toBeGreaterThan(0.6);
  });

  it('same brand + high token overlap → score >= 0.75 (Amazon ↔ Myntra)', () => {
    const az = normalizeProduct(amazonNikeAF1);
    const mn = normalizeProduct(myntraNikeAF1);
    expect(calculateSimilarity(az, mn)).toBeGreaterThanOrEqual(0.75);
  });

  it('same brand + high token overlap → score >= 0.75 (Amazon ↔ Ajio)', () => {
    const az = normalizeProduct(amazonNikeAF1);
    const aj = normalizeProduct(ajioNikeAF1);
    expect(calculateSimilarity(az, aj)).toBeGreaterThanOrEqual(0.75);
  });

  it('missing brand on one side → reduced confidence, score < 1.0', () => {
    const az = normalizeProduct(amazonNikeAF1);
    // Use a Meesho product with slightly different title so score is < 1.0
    const msVariant = normalizeProduct(makeProduct({
      id: 'ms_variant',
      title: 'Nike Air Force 1 Sneaker White Men',
      brand: undefined,
      price: 6999,
      platform: 'Meesho',
      url: 'https://www.meesho.com/nike-af1/p/ms_variant',
    }));
    const score = calculateSimilarity(az, msVariant);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1.0);
  });

  it('completely different products → score < 0.75', () => {
    const nike = normalizeProduct(amazonNikeAF1);
    const kurta = normalizeProduct(bibaKurta);
    // brand conflict → -1
    expect(calculateSimilarity(nike, kurta)).toBe(-1);
  });

  it('score is between 0 and 1 for valid (non-conflict) pairs', () => {
    const az = normalizeProduct(amazonNikeAF1);
    const fk = normalizeProduct(flipkartNikeAF1);
    const score = calculateSimilarity(az, fk);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── groupIntoCanonicals ──────────────────────────────────────────────────────

describe('groupIntoCanonicals — empty input', () => {
  it('returns empty array', () => {
    expect(groupIntoCanonicals([])).toEqual([]);
  });
});

describe('groupIntoCanonicals — single product', () => {
  it('creates one canonical with one offer', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1]));
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(1);
    expect(result[0].offers).toHaveLength(1);
  });

  it('canonical title matches original product title', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1]));
    expect(result[0].title).toBe(amazonNikeAF1.title);
  });

  it('canonical brand is normalized', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1]));
    expect(result[0].brand).toBe('nike');
  });
});

describe('groupIntoCanonicals — Amazon + Flipkart same product', () => {
  it('groups into one canonical', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, flipkartNikeAF1]));
    expect(result).toHaveLength(1);
  });

  it('canonical has 2 offers', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, flipkartNikeAF1]));
    expect(result[0].offerCount).toBe(2);
    expect(result[0].offers).toHaveLength(2);
  });

  it('offers contain correct platforms', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, flipkartNikeAF1]));
    const platforms = result[0].offers.map((o) => o.platform);
    expect(platforms).toContain('Amazon India');
    expect(platforms).toContain('Flipkart');
  });
});

describe('groupIntoCanonicals — Amazon + Myntra same product', () => {
  it('groups into one canonical', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, myntraNikeAF1]));
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(2);
  });
});

describe('groupIntoCanonicals — Amazon + Ajio same product', () => {
  it('groups into one canonical', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, ajioNikeAF1]));
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(2);
  });
});

describe('groupIntoCanonicals — completely different products', () => {
  it('creates two separate canonicals', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, bibaKurta]));
    expect(result).toHaveLength(2);
  });

  it('each canonical has exactly 1 offer', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, bibaKurta]));
    expect(result[0].offerCount).toBe(1);
    expect(result[1].offerCount).toBe(1);
  });
});

describe('groupIntoCanonicals — same title, different brands (no false merge)', () => {
  it('creates two separate canonicals', () => {
    const result = groupIntoCanonicals(normalizeProducts([pumaRunnerAmazon, nikeRunnerAmazon]));
    expect(result).toHaveLength(2);
  });

  it('brands are preserved separately', () => {
    const result = groupIntoCanonicals(normalizeProducts([pumaRunnerAmazon, nikeRunnerAmazon]));
    const brands = result.map((c) => c.brand);
    expect(brands).toContain('puma');
    expect(brands).toContain('nike');
  });
});

describe('groupIntoCanonicals — missing brand', () => {
  it('Meesho (no brand, identical title) + Amazon Nike AF1 → merged', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, meeshoNikeAF1]));
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(2);
  });

  it('Meesho (no brand, different title) + Amazon Nike AF1 → NOT merged when Jaccard too low', () => {
    const meeshoLowOverlap = makeProduct({
      id: 'ms_lowoverlap',
      title: 'Nike Air Force 1 Sneaker White Men',
      brand: undefined,
      price: 6999,
      platform: 'Meesho',
      url: 'https://www.meesho.com/nike-af1/p/ms_lowoverlap',
    });
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, meeshoLowOverlap]));
    // score = 0.5*0.45 + 0.857*0.55 = 0.696 < 0.75 → separate canonicals
    expect(result).toHaveLength(2);
  });

  it('Meesho (no brand) + Biba Kurta → separate canonicals', () => {
    const meeshoKurta = makeProduct({
      id: 'ms_kurta',
      title: 'Biba Women Ethnic Kurta Set with Dupatta',
      brand: undefined,
      price: 1199,
      platform: 'Meesho',
      url: 'https://www.meesho.com/kurta/p/ms_kurta',
    });
    const result = groupIntoCanonicals(normalizeProducts([bibaKurta, meeshoKurta]));
    // bibaKurta has brand 'Biba', meeshoKurta has no brand — no conflict, tokens identical
    // should merge (same title, no brand conflict)
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(2);
  });
});

describe('groupIntoCanonicals — duplicate products (same platform, same title)', () => {
  it('merges duplicate into one canonical', () => {
    const result = groupIntoCanonicals(
      normalizeProducts([amazonNikeAF1, amazonNikeAF1Duplicate]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(2);
  });
});

describe('groupIntoCanonicals — multiple offers on one canonical', () => {
  it('all 4 Nike AF1 platform listings merge into one canonical', () => {
    const result = groupIntoCanonicals(
      normalizeProducts([amazonNikeAF1, flipkartNikeAF1, myntraNikeAF1, ajioNikeAF1]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(4);
    expect(result[0].offers).toHaveLength(4);
  });

  it('canonical brand is nike', () => {
    const result = groupIntoCanonicals(
      normalizeProducts([amazonNikeAF1, flipkartNikeAF1, myntraNikeAF1, ajioNikeAF1]),
    );
    expect(result[0].brand).toBe('nike');
  });

  it('all 4 platform names present in offers', () => {
    const result = groupIntoCanonicals(
      normalizeProducts([amazonNikeAF1, flipkartNikeAF1, myntraNikeAF1, ajioNikeAF1]),
    );
    const platforms = result[0].offers.map((o) => o.platform);
    expect(platforms).toContain('Amazon India');
    expect(platforms).toContain('Flipkart');
    expect(platforms).toContain('Myntra');
    expect(platforms).toContain('Ajio');
  });
});

describe('groupIntoCanonicals — mixed batch (Nike AF1 + Biba Kurta)', () => {
  it('produces exactly 2 canonicals', () => {
    const result = groupIntoCanonicals(
      normalizeProducts([amazonNikeAF1, flipkartNikeAF1, myntraNikeAF1, bibaKurta]),
    );
    expect(result).toHaveLength(2);
  });

  it('Nike canonical has 3 offers', () => {
    const result = groupIntoCanonicals(
      normalizeProducts([amazonNikeAF1, flipkartNikeAF1, myntraNikeAF1, bibaKurta]),
    );
    const nikeCanonical = result.find((c) => c.brand === 'nike');
    expect(nikeCanonical?.offerCount).toBe(3);
  });

  it('Biba canonical has 1 offer', () => {
    const result = groupIntoCanonicals(
      normalizeProducts([amazonNikeAF1, flipkartNikeAF1, myntraNikeAF1, bibaKurta]),
    );
    const bibaCanonical = result.find((c) => c.brand === 'biba');
    expect(bibaCanonical?.offerCount).toBe(1);
  });
});

// ─── Offer shape ──────────────────────────────────────────────────────────────

describe('Offer shape', () => {
  it('offer contains correct fields', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1]));
    const offer = result[0].offers[0];
    expect(offer.platform).toBe('Amazon India');
    expect(offer.platformProductId).toBe('az_nikeaf1');
    expect(offer.title).toBe(amazonNikeAF1.title);
    expect(offer.price).toBe(7495);
    expect(offer.productUrl).toBe(amazonNikeAF1.url);
    expect(offer.originalProduct).toBe(amazonNikeAF1);
  });

  it('offer does not contain affiliateUrl', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1]));
    expect(result[0].offers[0]).not.toHaveProperty('affiliateUrl');
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('Determinism', () => {
  it('same input produces identical output on two runs', () => {
    const input = normalizeProducts([amazonNikeAF1, flipkartNikeAF1, bibaKurta]);
    const run1 = groupIntoCanonicals(input);
    const run2 = groupIntoCanonicals(input);
    expect(run1.length).toBe(run2.length);
    expect(run1[0].offerCount).toBe(run2[0].offerCount);
    expect(run1[1].offerCount).toBe(run2[1].offerCount);
    expect(run1[0].offers.map((o) => o.platformProductId))
      .toEqual(run2[0].offers.map((o) => o.platformProductId));
  });

  it('canonical id is the id of the first product that created it', () => {
    const result = groupIntoCanonicals(normalizeProducts([amazonNikeAF1, flipkartNikeAF1]));
    expect(result[0].id).toBe(amazonNikeAF1.id);
  });
});

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('Immutability', () => {
  it('input NormalizedProduct array is not mutated', () => {
    const normalized = normalizeProducts([amazonNikeAF1, flipkartNikeAF1, bibaKurta]);
    const lengthBefore = normalized.length;
    groupIntoCanonicals(normalized);
    expect(normalized.length).toBe(lengthBefore);
    expect(normalized[0].originalProduct).toBe(amazonNikeAF1);
  });

  it('original SearchProduct is not mutated', () => {
    const titleBefore = amazonNikeAF1.title;
    const priceBefore = amazonNikeAF1.price;
    groupIntoCanonicals(normalizeProducts([amazonNikeAF1, flipkartNikeAF1]));
    expect(amazonNikeAF1.title).toBe(titleBefore);
    expect(amazonNikeAF1.price).toBe(priceBefore);
  });
});
