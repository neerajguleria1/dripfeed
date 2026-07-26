/**
 * matcher.test.ts
 *
 * Comprehensive unit tests for the Product Matching Engine (V2).
 *
 * Covers:
 *   - calculateJaccard
 *   - calculateSimilarity: all hard rejects + scored signals
 *   - groupIntoCanonicals: all grouping scenarios
 *   - normalizer: brand aliases, color/size/gender/model extraction
 *   - Determinism and immutability
 */

import { describe, it, expect } from 'vitest';
import {
  calculateJaccard,
  calculateSimilarity,
  findBestMatch,
  groupIntoCanonicals,
} from '../../api/_lib/matcher.js';
import {
  normalizeProduct,
  normalizeProducts,
  normalizeBrand,
  extractColor,
  extractSize,
  extractGender,
  extractModel,
} from '../../api/_lib/normalizer.js';
import type { SearchProduct } from '../../api/_lib/types/searchProduct.js';

// ─── Fixture factory ──────────────────────────────────────────────────────────

function p(
  overrides: Partial<SearchProduct> & Pick<SearchProduct, 'id' | 'title' | 'platform'>,
): SearchProduct {
  return {
    price: 999,
    imageUrl: 'https://example.com/img.jpg',
    url: 'https://example.com/product',
    ...overrides,
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Nike Air Force 1 — same product, 4 platforms
const azNikeAF1 = p({ id: 'az_af1', title: "Nike Men's Air Force 1 '07 Sneaker White", brand: 'Nike', price: 7495, platform: 'Amazon India' });
const fkNikeAF1 = p({ id: 'fk_af1', title: "Nike Men's Air Force 1 Sneaker White",     brand: 'Nike', price: 7295, platform: 'Flipkart' });
const mnNikeAF1 = p({ id: 'mn_af1', title: 'Nike Men White Air Force 1 Casual Shoes',  brand: 'Nike', price: 7495, platform: 'Myntra' });
const ajNikeAF1 = p({ id: 'aj_af1', title: 'Nike Men Air Force 1 White Sneaker',        brand: 'Nike', price: 7495, platform: 'Ajio', color: 'White' });

// Nike AF1 Black — same model, different color → must NOT merge with white
const azNikeAF1Black = p({ id: 'az_af1b', title: "Nike Men's Air Force 1 '07 Sneaker Black", brand: 'Nike', price: 7495, platform: 'Amazon India', color: 'Black' });
const fkNikeAF1Black = p({ id: 'fk_af1b', title: 'Nike Men Air Force 1 Sneaker Black',       brand: 'Nike', price: 7295, platform: 'Flipkart' });

// Levi's 511 — brand alias test
const azLevis511  = p({ id: 'az_511',  title: "Levi's 511 Slim Fit Jeans Blue Men", brand: "Levi's", price: 2499, platform: 'Amazon India' });
const fkLevis511  = p({ id: 'fk_511',  title: 'Levis 511 Slim Fit Jeans Blue Men',  brand: 'Levis',  price: 2399, platform: 'Flipkart' });
const mnLevis511  = p({ id: 'mn_511',  title: "Levi's 511 Slim Jeans Men Blue",     brand: "Levi's", price: 2499, platform: 'Myntra' });

// Levi's 511 vs 501 — different model → must NOT merge
const azLevis501  = p({ id: 'az_501',  title: "Levi's 501 Original Fit Jeans Blue Men", brand: "Levi's", price: 2699, platform: 'Amazon India' });

// Gender conflict — men vs women kurta
const menKurta    = p({ id: 'az_mkurta', title: 'Men Blue Cotton Kurta Regular Fit',   brand: 'Fabindia', price: 899, platform: 'Amazon India' });
const womenKurta  = p({ id: 'fk_wkurta', title: 'Women Blue Cotton Kurta Regular Fit', brand: 'Fabindia', price: 899, platform: 'Flipkart' });

// Different brands — same title shape
const pumaRunner  = p({ id: 'az_puma', title: 'Puma Men Running Shoes Lightweight', brand: 'Puma', price: 3499, platform: 'Amazon India' });
const nikeRunner  = p({ id: 'fk_nike', title: 'Nike Men Running Shoes Lightweight', brand: 'Nike', price: 4999, platform: 'Flipkart' });

// Price sanity — ₹399 vs ₹3999 → must NOT merge
const cheapKurta  = p({ id: 'ms_cheap', title: 'Men Blue Kurta Cotton',  brand: undefined, price: 399,  platform: 'Meesho' });
const expKurta    = p({ id: 'mn_exp',   title: 'Men Blue Kurta Cotton',  brand: undefined, price: 3999, platform: 'Myntra' });

// Meesho — no brand, identical title to Amazon
const msNikeAF1   = p({ id: 'ms_af1', title: "Nike Men's Air Force 1 '07 Sneaker White", brand: undefined, price: 6999, platform: 'Meesho' });

// Same platform duplicate
const azNikeAF1Dup = p({ id: 'az_af1_dup', title: "Nike Men's Air Force 1 '07 Sneaker White", brand: 'Nike', price: 7295, platform: 'Amazon India' });

// Completely different product
const bibaKurta   = p({ id: 'mn_biba', title: 'Biba Women Ethnic Kurta Set Dupatta', brand: 'Biba', price: 1299, platform: 'Myntra' });

// H&M brand alias
const hmAmazon    = p({ id: 'az_hm', title: 'H&M Women Floral Dress Summer', brand: 'H&M', price: 1499, platform: 'Amazon India' });
const hmFlipkart  = p({ id: 'fk_hm', title: 'H and M Women Floral Dress Summer', brand: 'H and M', price: 1399, platform: 'Flipkart' });

// US Polo alias
const uspoloAz    = p({ id: 'az_uspo', title: 'U.S. Polo Men Polo T-Shirt Navy', brand: 'U.S. Polo', price: 799, platform: 'Amazon India' });
const uspoloFk    = p({ id: 'fk_uspo', title: 'US Polo Assn Men Polo T-Shirt Navy', brand: 'US Polo Assn', price: 749, platform: 'Flipkart' });

// Size conflict — same product, different sizes
const sizeS       = p({ id: 'fk_s',  title: "Levi's 511 Slim Fit Jeans Blue Men", brand: "Levi's", price: 2499, platform: 'Flipkart', size: 'S' });
const sizeXL      = p({ id: 'mn_xl', title: "Levi's 511 Slim Fit Jeans Blue Men", brand: "Levi's", price: 2499, platform: 'Myntra',   size: 'XL' });

// ─── normalizeBrand ───────────────────────────────────────────────────────────

describe('normalizeBrand — alias resolution', () => {
  it("Levi's → levis", () => expect(normalizeBrand("Levi's")).toBe('levis'));
  it('Levis → levis',  () => expect(normalizeBrand('Levis')).toBe('levis'));
  it('H&M → hm',       () => expect(normalizeBrand('H&M')).toBe('hm'));
  it('H and M → hm',   () => expect(normalizeBrand('H and M')).toBe('hm'));
  it('U.S. Polo → us polo', () => expect(normalizeBrand('U.S. Polo')).toBe('us polo'));
  it('US Polo Assn → us polo', () => expect(normalizeBrand('US Polo Assn')).toBe('us polo'));
  it('Roadster® → roadster', () => expect(normalizeBrand('Roadster®')).toBe('roadster'));
  it('Nike → nike (no alias, just lowercase)', () => expect(normalizeBrand('Nike')).toBe('nike'));
  it('undefined → undefined', () => expect(normalizeBrand(undefined)).toBeUndefined());
  it('empty string → undefined', () => expect(normalizeBrand('')).toBeUndefined());
  it('Adidas Originals → adidas', () => expect(normalizeBrand('Adidas Originals')).toBe('adidas'));
});

// ─── extractColor ─────────────────────────────────────────────────────────────

describe('extractColor — from structured field', () => {
  it('structured field takes priority', () =>
    expect(extractColor('Navy Blue', 'Some Black Shirt')).toBe('navy blue'));
  it('structured field empty → falls back to title', () =>
    expect(extractColor('', 'Nike White Sneaker')).toBe('white'));
  it('structured undefined → falls back to title', () =>
    expect(extractColor(undefined, 'Nike Black Sneaker')).toBe('black'));
});

describe('extractColor — from title', () => {
  it('detects white',      () => expect(extractColor(undefined, 'Nike Air Force 1 White')).toBe('white'));
  it('detects black',      () => expect(extractColor(undefined, 'Puma Running Shoes Black')).toBe('black'));
  it('detects navy blue',  () => expect(extractColor(undefined, 'Men Navy Blue Polo Shirt')).toBe('navy blue'));
  it('detects olive',      () => expect(extractColor(undefined, 'Cargo Pants Olive Green Men')).toBe('olive green'));
  it('detects maroon',     () => expect(extractColor(undefined, 'Maroon Kurta Cotton')).toBe('maroon'));
  it('detects grey',       () => expect(extractColor(undefined, 'Grey Hoodie Oversized')).toBe('grey'));
  it('detects multi',      () => expect(extractColor(undefined, 'Multi Color Printed Saree')).toBe('multi'));
  it('no color → undefined', () => expect(extractColor(undefined, 'Slim Fit Jeans Regular')).toBeUndefined());
});

// ─── extractSize ──────────────────────────────────────────────────────────────

describe('extractSize — from structured field', () => {
  it('structured field takes priority', () =>
    expect(extractSize('XL', 'Some S Shirt')).toBe('xl'));
});

describe('extractSize — from title', () => {
  it('detects xl',  () => expect(extractSize(undefined, 'Nike Shirt XL Men')).toBe('xl'));
  it('detects xxl', () => expect(extractSize(undefined, 'Kurta XXL Cotton')).toBe('xxl'));
  it('detects 32',  () => expect(extractSize(undefined, "Levi's 511 Jeans 32 Waist")).toBe('32'));
  it('detects 38',  () => expect(extractSize(undefined, 'Formal Trouser 38 Waist')).toBe('38'));
  it('no size → undefined', () => expect(extractSize(undefined, 'Nike Air Force 1 White')).toBeUndefined());
  // "s" should not match inside "shoes"
  it('does not match s inside shoes', () =>
    expect(extractSize(undefined, 'Running Shoes Men')).toBeUndefined());
});

// ─── extractGender ────────────────────────────────────────────────────────────

describe('extractGender', () => {
  it('men',    () => expect(extractGender("Nike Men's Running Shoes")).toBe('men'));
  it('women',  () => expect(extractGender('Women Floral Dress Summer')).toBe('women'));
  it('boys',   () => expect(extractGender('Boys Cotton Kurta')).toBe('men'));
  it('girls',  () => expect(extractGender('Girls Printed Frock')).toBe('women'));
  it('unisex', () => expect(extractGender('Unisex Cotton T-Shirt')).toBe('unisex'));
  it('both men and women → unisex', () =>
    expect(extractGender('Men Women Couple T-Shirt')).toBe('unisex'));
  it('no gender → undefined', () =>
    expect(extractGender('Cotton Kurta Blue Regular Fit')).toBeUndefined());
});

// ─── extractModel ─────────────────────────────────────────────────────────────

describe('extractModel', () => {
  it("Nike AF1 '07 → 07",       () => expect(extractModel("Nike Air Force 1 '07 Sneaker")).toBe('07'));
  it("Levi's 511 → 511",        () => expect(extractModel("Levi's 511 Slim Fit Jeans")).toBe('511'));
  it('no model → undefined',    () => expect(extractModel('Cotton Kurta Blue Regular')).toBeUndefined());
  it('longer match wins',       () => {
    const m = extractModel('Samsung SM-N986B Phone');
    expect(m).toBe('sm-n986b');
  });
});

// ─── calculateJaccard ─────────────────────────────────────────────────────────

describe('calculateJaccard', () => {
  it('identical sets → 1.0', () =>
    expect(calculateJaccard(['air', 'force', 'nike'], ['air', 'force', 'nike'])).toBe(1));
  it('disjoint sets → 0', () =>
    expect(calculateJaccard(['kurta', 'biba'], ['nike', 'air'])).toBe(0));
  it('partial overlap', () => {
    // A={air,force,nike,white} B={air,casual,force,nike,white} → 4/5 = 0.8
    expect(calculateJaccard(['air','force','nike','white'], ['air','casual','force','nike','white'])).toBeCloseTo(0.8);
  });
  it('one empty → 0', () => expect(calculateJaccard([], ['nike'])).toBe(0));
  it('both empty → 0', () => expect(calculateJaccard([], [])).toBe(0));
});

// ─── calculateSimilarity — hard rejects ──────────────────────────────────────

describe('calculateSimilarity — hard rejects', () => {
  it('brand conflict → -1', () => {
    expect(calculateSimilarity(normalizeProduct(pumaRunner), normalizeProduct(nikeRunner))).toBe(-1);
  });

  it('color conflict (structured) → -1', () => {
    const a = normalizeProduct(azNikeAF1Black); // color: Black (structured)
    const b = normalizeProduct(ajNikeAF1);      // color: White (structured)
    expect(calculateSimilarity(a, b)).toBe(-1);
  });

  it('color conflict (title-extracted) → -1', () => {
    const white = normalizeProduct(p({ id: 'x1', title: 'Nike AF1 White Men', brand: 'Nike', price: 7495, platform: 'Amazon India' }));
    const black = normalizeProduct(p({ id: 'x2', title: 'Nike AF1 Black Men', brand: 'Nike', price: 7495, platform: 'Flipkart' }));
    expect(calculateSimilarity(white, black)).toBe(-1);
  });

  it('size conflict (structured) → -1', () => {
    expect(calculateSimilarity(normalizeProduct(sizeS), normalizeProduct(sizeXL))).toBe(-1);
  });

  it('gender conflict (men vs women) → -1', () => {
    expect(calculateSimilarity(normalizeProduct(menKurta), normalizeProduct(womenKurta))).toBe(-1);
  });

  it('model conflict (511 vs 501) → -1', () => {
    expect(calculateSimilarity(normalizeProduct(azLevis511), normalizeProduct(azLevis501))).toBe(-1);
  });

  it('price sanity (₹399 vs ₹3999, ratio=10) → -1', () => {
    expect(calculateSimilarity(normalizeProduct(cheapKurta), normalizeProduct(expKurta))).toBe(-1);
  });
});

// ─── calculateSimilarity — valid merges ───────────────────────────────────────

describe('calculateSimilarity — valid merges', () => {
  it('same product, same brand → score >= 0.72', () => {
    expect(calculateSimilarity(normalizeProduct(azNikeAF1), normalizeProduct(fkNikeAF1))).toBeGreaterThanOrEqual(0.72);
  });

  it('brand aliases resolve: Levi\'s + Levis → score >= 0.72', () => {
    expect(calculateSimilarity(normalizeProduct(azLevis511), normalizeProduct(fkLevis511))).toBeGreaterThanOrEqual(0.72);
  });

  it('H&M + H and M → score >= 0.72', () => {
    expect(calculateSimilarity(normalizeProduct(hmAmazon), normalizeProduct(hmFlipkart))).toBeGreaterThanOrEqual(0.72);
  });

  it('missing brand (Meesho) + known brand → score > 0 when titles match', () => {
    const score = calculateSimilarity(normalizeProduct(azNikeAF1), normalizeProduct(msNikeAF1));
    expect(score).toBeGreaterThan(0);
  });

  it('score is in [0, 1] for non-conflict pairs', () => {
    const score = calculateSimilarity(normalizeProduct(azNikeAF1), normalizeProduct(fkNikeAF1));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('identical product compared to itself → score = 1.0', () => {
    const a = normalizeProduct(azNikeAF1);
    expect(calculateSimilarity(a, a)).toBeCloseTo(1.0);
  });
});

// ─── groupIntoCanonicals ──────────────────────────────────────────────────────

describe('groupIntoCanonicals — basic', () => {
  it('empty input → empty output', () =>
    expect(groupIntoCanonicals([])).toEqual([]));

  it('single product → 1 canonical, 1 offer, confidence 1.0', () => {
    const [c] = groupIntoCanonicals(normalizeProducts([azNikeAF1]));
    expect(c.offerCount).toBe(1);
    expect(c.confidence).toBe(1.0);
  });
});

describe('groupIntoCanonicals — Nike AF1 cross-platform merge', () => {
  it('4 platforms → 1 canonical', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1, mnNikeAF1, ajNikeAF1]));
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(4);
  });

  it('all 4 platform names present', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1, mnNikeAF1, ajNikeAF1]));
    const platforms = result[0].offers.map((o) => o.platform);
    expect(platforms).toContain('Amazon India');
    expect(platforms).toContain('Flipkart');
    expect(platforms).toContain('Myntra');
    expect(platforms).toContain('Ajio');
  });

  it('confidence > 0.7 for well-matched canonical', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1, mnNikeAF1]));
    expect(result[0].confidence).toBeGreaterThan(0.7);
  });
});

describe('groupIntoCanonicals — color separation', () => {
  it('White AF1 and Black AF1 → 2 separate canonicals', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1Black]));
    expect(result).toHaveLength(2);
  });

  it('structured color conflict → 2 canonicals', () => {
    const result = groupIntoCanonicals(normalizeProducts([ajNikeAF1, azNikeAF1Black]));
    expect(result).toHaveLength(2);
  });
});

describe('groupIntoCanonicals — gender separation', () => {
  it('Men Kurta + Women Kurta → 2 canonicals', () => {
    const result = groupIntoCanonicals(normalizeProducts([menKurta, womenKurta]));
    expect(result).toHaveLength(2);
  });
});

describe('groupIntoCanonicals — model separation', () => {
  it("Levi's 511 + Levi's 501 → 2 canonicals", () => {
    const result = groupIntoCanonicals(normalizeProducts([azLevis511, azLevis501]));
    expect(result).toHaveLength(2);
  });

  it("Levi's 511 across platforms → 1 canonical", () => {
    const result = groupIntoCanonicals(normalizeProducts([azLevis511, fkLevis511, mnLevis511]));
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(3);
  });
});

describe('groupIntoCanonicals — brand alias merge', () => {
  it("Levi's (Amazon) + Levis (Flipkart) → 1 canonical", () => {
    const result = groupIntoCanonicals(normalizeProducts([azLevis511, fkLevis511]));
    expect(result).toHaveLength(1);
  });

  it('H&M + H and M → 1 canonical', () => {
    const result = groupIntoCanonicals(normalizeProducts([hmAmazon, hmFlipkart]));
    expect(result).toHaveLength(1);
  });
});

describe('groupIntoCanonicals — size separation', () => {
  it('Size S + Size XL → 2 canonicals', () => {
    const result = groupIntoCanonicals(normalizeProducts([sizeS, sizeXL]));
    expect(result).toHaveLength(2);
  });
});

describe('groupIntoCanonicals — price sanity', () => {
  it('₹399 vs ₹3999 (ratio=10) → 2 canonicals', () => {
    const result = groupIntoCanonicals(normalizeProducts([cheapKurta, expKurta]));
    expect(result).toHaveLength(2);
  });

  it('₹7295 vs ₹7495 (ratio≈1.03) → 1 canonical', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1]));
    expect(result).toHaveLength(1);
  });
});

describe('groupIntoCanonicals — same platform block', () => {
  it('two Amazon products with same title → 2 canonicals (same platform)', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, azNikeAF1Dup]));
    expect(result).toHaveLength(2);
  });
});

describe('groupIntoCanonicals — different brands never merge', () => {
  it('Puma runner + Nike runner → 2 canonicals', () => {
    const result = groupIntoCanonicals(normalizeProducts([pumaRunner, nikeRunner]));
    expect(result).toHaveLength(2);
  });
});

describe('groupIntoCanonicals — missing brand (Meesho)', () => {
  it('Meesho (no brand, identical title) + Amazon Nike AF1 → 1 canonical', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, msNikeAF1]));
    expect(result).toHaveLength(1);
    expect(result[0].offerCount).toBe(2);
  });
});

describe('groupIntoCanonicals — mixed batch', () => {
  it('Nike AF1 x3 + Biba Kurta → 2 canonicals', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1, mnNikeAF1, bibaKurta]));
    expect(result).toHaveLength(2);
  });

  it('Nike canonical has 3 offers', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1, mnNikeAF1, bibaKurta]));
    const nike = result.find((c) => c.brand === 'nike');
    expect(nike?.offerCount).toBe(3);
  });

  it('Biba canonical has 1 offer', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1, mnNikeAF1, bibaKurta]));
    const biba = result.find((c) => c.brand === 'biba');
    expect(biba?.offerCount).toBe(1);
  });
});

// ─── Offer shape ──────────────────────────────────────────────────────────────

describe('Offer shape', () => {
  it('all required fields present', () => {
    const [c] = groupIntoCanonicals(normalizeProducts([azNikeAF1]));
    const o = c.offers[0];
    expect(o.platform).toBe('Amazon India');
    expect(o.platformProductId).toBe('az_af1');
    expect(o.price).toBe(7495);
    expect(o.productUrl).toBe(azNikeAF1.url);
    expect(o.originalProduct).toBe(azNikeAF1);
  });

  it('color from structured field survives into offer', () => {
    const [c] = groupIntoCanonicals(normalizeProducts([ajNikeAF1]));
    expect(c.offers[0].color).toBe('white');
  });
});

// ─── Confidence scoring ───────────────────────────────────────────────────────

describe('Confidence scoring', () => {
  it('single offer → confidence 1.0', () => {
    const [c] = groupIntoCanonicals(normalizeProducts([azNikeAF1]));
    expect(c.confidence).toBe(1.0);
  });

  it('two well-matched offers → confidence > 0.7', () => {
    const [c] = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1]));
    expect(c.confidence).toBeGreaterThan(0.7);
  });

  it('confidence is between 0 and 1', () => {
    const result = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1, mnNikeAF1]));
    for (const c of result) {
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('Determinism', () => {
  it('same input → identical output on two runs', () => {
    const input = normalizeProducts([azNikeAF1, fkNikeAF1, bibaKurta]);
    const r1 = groupIntoCanonicals(input);
    const r2 = groupIntoCanonicals(input);
    expect(r1.length).toBe(r2.length);
    expect(r1[0].offerCount).toBe(r2[0].offerCount);
    expect(r1[0].offers.map((o) => o.platformProductId))
      .toEqual(r2[0].offers.map((o) => o.platformProductId));
  });

  it('canonical id = id of first product that created it', () => {
    const [c] = groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1]));
    expect(c.id).toBe(azNikeAF1.id);
  });
});

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('Immutability', () => {
  it('input array not mutated', () => {
    const input = normalizeProducts([azNikeAF1, fkNikeAF1, bibaKurta]);
    const len = input.length;
    groupIntoCanonicals(input);
    expect(input.length).toBe(len);
    expect(input[0].originalProduct).toBe(azNikeAF1);
  });

  it('original SearchProduct not mutated', () => {
    const titleBefore = azNikeAF1.title;
    groupIntoCanonicals(normalizeProducts([azNikeAF1, fkNikeAF1]));
    expect(azNikeAF1.title).toBe(titleBefore);
  });
});
