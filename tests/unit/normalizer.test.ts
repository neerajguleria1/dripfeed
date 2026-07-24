/**
 * normalizer.test.ts
 *
 * Unit tests for the Normalization Engine (Milestone 1).
 *
 * Covers:
 *   - Every individual pipeline step function
 *   - The full normalizeProduct() entry point for all 5 platforms
 *   - Cross-platform token overlap (the core matching guarantee)
 *   - Negative test: different products must NOT produce high overlap
 *   - Immutability: original SearchProduct must never be mutated
 */

import { describe, it, expect } from 'vitest';
import {
  toLower,
  trim,
  removePunctuation,
  collapseSpaces,
  removeStopWords,
  tokenize,
  sortAndDedupe,
  normalizeBrand,
  normalizeColor,
  normalizeSize,
  normalizeTitle,
  buildTokens,
  normalizeProduct,
  normalizeProducts,
} from '../../api/_lib/normalizer.js';
import type { SearchProduct } from '../../api/_lib/types/searchProduct.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Jaccard similarity between two token arrays. */
function jaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Fixture products — shaped exactly as each platform scraper produces ──────

const amazonProduct: SearchProduct = {
  id: 'az_p1_B09XYZ1234',
  title: "Nike Men's Air Force 1 '07 Sneaker - White/White",
  brand: 'Nike',
  price: 7495,
  originalPrice: 8995,
  discount: 17,
  imageUrl: 'https://m.media-amazon.com/images/I/example.jpg',
  platform: 'Amazon India',
  url: 'https://www.amazon.in/dp/B09XYZ1234',
  rating: 4.3,
  affiliateUrl: 'https://www.amazon.in/dp/B09XYZ1234?tag=dripfeed-21',
  color: undefined,
  size: undefined,
};

const flipkartProduct: SearchProduct = {
  id: 'fk_SHOEZXYZ123',
  title: 'Nike Air Force 1 Low Sneakers For Men',
  brand: 'Nike',
  price: 7295,
  originalPrice: 8995,
  discount: 19,
  imageUrl: 'https://rukmini1.flixcart.com/image/300/400/example.jpg',
  platform: 'Flipkart',
  url: 'https://www.flipkart.com/nike-air-force-1/p/SHOEZXYZ123',
  size: 'UK 9',
  color: undefined,
};

const myntraProduct: SearchProduct = {
  id: 'mn_12345678',
  title: 'Nike Men White Air Force 1 Casual Shoes',
  brand: 'Nike',
  price: 7495,
  originalPrice: 8995,
  discount: 17,
  imageUrl: 'https://assets.myntassets.com/example.jpg',
  platform: 'Myntra',
  url: 'https://www.myntra.com/casual-shoes/nike/12345678/buy',
  rating: 4.4,
  color: undefined,
  size: undefined,
};

const ajioProduct: SearchProduct = {
  id: 'aj_469486197',
  title: 'Nike Air Force 1 Sneaker',
  brand: 'Nike',
  price: 7495,
  originalPrice: 8995,
  discount: 17,
  imageUrl: 'https://assets.ajio.com/medias/sys_master/example.jpg',
  platform: 'Ajio',
  url: 'https://www.ajio.com/nike-air-force-1-sneaker/p/469486197_white',
  color: 'White',
  size: undefined,
};

// Meesho: no brand, noisy title
const meeshoProduct: SearchProduct = {
  id: 'ms_98765432',
  title: 'Adrika Refined Kurtis - New Arrival - Buy Online India',
  brand: undefined,
  price: 399,
  originalPrice: 799,
  discount: 50,
  imageUrl: 'https://images.meesho.com/images/products/example.jpg',
  platform: 'Meesho',
  url: 'https://www.meesho.com/adrika-refined-kurtis/p/98765432',
  color: undefined,
  size: undefined,
};

// A completely different product — used for the negative overlap test
const bibaKurta: SearchProduct = {
  id: 'mn_99999999',
  title: 'Biba Women Ethnic Kurta Set with Dupatta',
  brand: 'Biba',
  price: 1299,
  imageUrl: 'https://assets.myntassets.com/kurta.jpg',
  platform: 'Myntra',
  url: 'https://www.myntra.com/kurta/biba/99999999/buy',
};

// ─── Step-level unit tests ────────────────────────────────────────────────────

describe('toLower', () => {
  it('lowercases ASCII letters', () => {
    expect(toLower('Nike Air Force')).toBe('nike air force');
  });
  it('lowercases mixed case', () => {
    expect(toLower('H&M DIVIDED')).toBe('h&m divided');
  });
  it('is a no-op on already lowercase input', () => {
    expect(toLower('kurta set')).toBe('kurta set');
  });
});

describe('trim', () => {
  it('removes leading spaces', () => expect(trim('  kurta')).toBe('kurta'));
  it('removes trailing spaces', () => expect(trim('kurta  ')).toBe('kurta'));
  it('removes both sides',      () => expect(trim('  kurta  ')).toBe('kurta'));
  it('is a no-op on clean input', () => expect(trim('kurta')).toBe('kurta'));
});

describe('removePunctuation', () => {
  it("converts apostrophe to space → 'men's' becomes 'men s'", () => {
    expect(removePunctuation("men's")).toBe('men s');
  });
  it('converts hyphen to space', () => {
    expect(removePunctuation('full-sleeve')).toBe('full sleeve');
  });
  it('converts slash to space', () => {
    expect(removePunctuation('white/black')).toBe('white black');
  });
  it('removes brackets', () => {
    expect(removePunctuation('kurta (xl)')).toBe('kurta  xl ');
  });
  it('preserves digits', () => {
    expect(removePunctuation('501 jeans')).toBe('501 jeans');
  });
  it('removes rupee symbol', () => {
    expect(removePunctuation('₹1299')).toBe(' 1299');
  });
  it('converts ampersand to space (input must be lowercased first)', () => {
    expect(removePunctuation('h&m')).toBe('h m');
  });
});

describe('collapseSpaces', () => {
  it('collapses multiple spaces to one', () => {
    expect(collapseSpaces('nike  air   force')).toBe('nike air force');
  });
  it('trims after collapsing', () => {
    expect(collapseSpaces('  nike  ')).toBe('nike');
  });
  it('is a no-op on single-spaced input', () => {
    expect(collapseSpaces('nike air')).toBe('nike air');
  });
});

describe('removeStopWords', () => {
  it('removes "with"',           () => expect(removeStopWords('kurta with dupatta')).toBe('kurta dupatta'));
  it('removes "for"',            () => expect(removeStopWords('shoes for men')).toBe('shoes men'));
  it('removes "and"',            () => expect(removeStopWords('top and jeans')).toBe('top jeans'));
  it('removes "new"',            () => expect(removeStopWords('new arrival kurta')).toBe('arrival kurta'));
  it('removes platform names',   () => expect(removeStopWords('kurta myntra')).toBe('kurta'));
  it('preserves non-stop words', () => expect(removeStopWords('silk kurta')).toBe('silk kurta'));
  it('handles empty string',     () => expect(removeStopWords('')).toBe(''));
});

describe('tokenize', () => {
  it('splits on spaces',          () => expect(tokenize('nike air force')).toEqual(['nike', 'air', 'force']));
  it('drops single-char tokens',  () => expect(tokenize('a b nike')).toEqual(['nike']));
  it('keeps 2-char tokens',       () => expect(tokenize('xl kurta')).toEqual(['xl', 'kurta']));
  it('returns [] for empty input',() => expect(tokenize('')).toEqual([]));
});

describe('sortAndDedupe', () => {
  it('sorts alphabetically', () => {
    expect(sortAndDedupe(['nike', 'air', 'force'])).toEqual(['air', 'force', 'nike']);
  });
  it('removes duplicates', () => {
    expect(sortAndDedupe(['white', 'white', 'nike'])).toEqual(['nike', 'white']);
  });
  it('sorts and deduplicates together', () => {
    expect(sortAndDedupe(['force', 'air', 'nike', 'air'])).toEqual(['air', 'force', 'nike']);
  });
  it('returns [] for empty input', () => {
    expect(sortAndDedupe([])).toEqual([]);
  });
});

describe('normalizeBrand', () => {
  it('lowercases brand',              () => expect(normalizeBrand('Nike')).toBe('nike'));
  it('trims whitespace',              () => expect(normalizeBrand('  Puma  ')).toBe('puma'));
  it('returns undefined for undefined', () => expect(normalizeBrand(undefined)).toBeUndefined());
  it('returns undefined for empty string', () => expect(normalizeBrand('')).toBeUndefined());
  it('returns undefined for whitespace-only', () => expect(normalizeBrand('   ')).toBeUndefined());
});

describe('normalizeColor', () => {
  it('lowercases color',              () => expect(normalizeColor('Navy Blue')).toBe('navy blue'));
  it('trims whitespace',              () => expect(normalizeColor('  Red  ')).toBe('red'));
  it('returns undefined for undefined', () => expect(normalizeColor(undefined)).toBeUndefined());
  it('returns undefined for empty',   () => expect(normalizeColor('')).toBeUndefined());
});

describe('normalizeSize', () => {
  it('lowercases size',               () => expect(normalizeSize('XL')).toBe('xl'));
  it('trims whitespace',              () => expect(normalizeSize('  M  ')).toBe('m'));
  it('returns undefined for undefined', () => expect(normalizeSize(undefined)).toBeUndefined());
  it('returns undefined for empty',   () => expect(normalizeSize('')).toBeUndefined());
});

describe('normalizeTitle — full pipeline', () => {
  it('Nike title', () => {
    expect(normalizeTitle("Nike Men's Air Force 1 '07 Sneaker - White/White"))
      .toBe('nike men s air force 1 07 sneaker white white');
  });
  it('H&M title with ampersand', () => {
    expect(normalizeTitle('H&M Women Floral Wrap Dress'))
      .toBe('h m women floral wrap dress');
  });
  it('Meesho noisy title', () => {
    expect(normalizeTitle('Adrika Refined Kurtis - New Arrival - Buy Online India'))
      .toBe('adrika refined kurtis arrival');
  });
  it("Levi's title with apostrophe", () => {
    expect(normalizeTitle("Levi's Men 501 Original Fit Jeans"))
      .toBe('levi s men 501 original fit jeans');
  });
  it('Ajio title with hyphen', () => {
    // 'T-Shirt' → 't shirt' after punctuation removal; 't' is a 1-char token
    // dropped only during tokenize(), not in normalizeTitle() which returns a string
    expect(normalizeTitle('Puma Men Solid Regular Fit T-Shirt'))
      .toBe('puma men solid regular fit t shirt');
  });
});

describe('buildTokens — sorted deduplicated arrays', () => {
  it('Nike Air Force tokens', () => {
    // apostrophe → space → 'men' and 's' tokens; 's' is 1 char and dropped
    expect(buildTokens("Nike Men's Air Force 1 '07 Sneaker - White/White"))
      .toEqual(['07', 'air', 'force', 'men', 'nike', 'sneaker', 'white']);
  });
  it("Levi's 501 tokens", () => {
    // 'Levi's' → 'levi s' → 's' dropped (1 char) → 'levi' token
    expect(buildTokens("Levi's Men 501 Original Fit Jeans"))
      .toEqual(['501', 'fit', 'jeans', 'levi', 'men', 'original']);
  });
  it('Kurta set tokens — stop words removed', () => {
    // 'set' and 'with' are stop words; 'dupatta' is not a stop word
    expect(buildTokens('Biba Women Ethnic Kurta Set with Dupatta'))
      .toEqual(['biba', 'dupatta', 'ethnic', 'kurta', 'women']);
  });
});

// ─── normalizeProduct — per platform ─────────────────────────────────────────

describe('normalizeProduct — Amazon India', () => {
  const norm = normalizeProduct(amazonProduct);

  it('preserves originalProduct by reference', () => {
    expect(norm.originalProduct).toBe(amazonProduct);
  });
  it('normalizedTitle', () => {
    expect(norm.normalizedTitle).toBe('nike men s air force 1 07 sneaker white white');
  });
  it('normalizedBrand', () => {
    expect(norm.normalizedBrand).toBe('nike');
  });
  it('tokens', () => {
    expect(norm.tokens).toEqual(['07', 'air', 'force', 'men', 'nike', 'sneaker', 'white']);
  });
  it('color is undefined (Amazon does not provide it)', () => {
    expect(norm.color).toBeUndefined();
  });
  it('size is undefined (Amazon does not provide it)', () => {
    expect(norm.size).toBeUndefined();
  });
});

describe('normalizeProduct — Flipkart', () => {
  const norm = normalizeProduct(flipkartProduct);

  it('preserves originalProduct by reference', () => {
    expect(norm.originalProduct).toBe(flipkartProduct);
  });
  it('normalizedTitle', () => {
    expect(norm.normalizedTitle).toBe('nike air force 1 low sneakers men');
  });
  it('normalizedBrand', () => {
    expect(norm.normalizedBrand).toBe('nike');
  });
  it('tokens', () => {
    expect(norm.tokens).toEqual(['air', 'force', 'low', 'men', 'nike', 'sneakers']);
  });
  it('size normalized from structured field', () => {
    expect(norm.size).toBe('uk 9');
  });
  it('color is undefined (Flipkart does not provide it)', () => {
    expect(norm.color).toBeUndefined();
  });
});

describe('normalizeProduct — Myntra', () => {
  const norm = normalizeProduct(myntraProduct);

  it('preserves originalProduct by reference', () => {
    expect(norm.originalProduct).toBe(myntraProduct);
  });
  it('normalizedTitle', () => {
    expect(norm.normalizedTitle).toBe('nike men white air force 1 casual shoes');
  });
  it('normalizedBrand', () => {
    expect(norm.normalizedBrand).toBe('nike');
  });
  it('tokens', () => {
    expect(norm.tokens).toEqual(['air', 'casual', 'force', 'men', 'nike', 'shoes', 'white']);
  });
  it('color is undefined', () => expect(norm.color).toBeUndefined());
  it('size is undefined',  () => expect(norm.size).toBeUndefined());
});

describe('normalizeProduct — Ajio', () => {
  const norm = normalizeProduct(ajioProduct);

  it('preserves originalProduct by reference', () => {
    expect(norm.originalProduct).toBe(ajioProduct);
  });
  it('normalizedTitle', () => {
    expect(norm.normalizedTitle).toBe('nike air force 1 sneaker');
  });
  it('normalizedBrand', () => {
    expect(norm.normalizedBrand).toBe('nike');
  });
  it('tokens', () => {
    expect(norm.tokens).toEqual(['air', 'force', 'nike', 'sneaker']);
  });
  it('color normalized from structured field', () => {
    expect(norm.color).toBe('white');
  });
  it('size is undefined', () => expect(norm.size).toBeUndefined());
});

describe('normalizeProduct — Meesho (no brand, noisy title)', () => {
  const norm = normalizeProduct(meeshoProduct);

  it('preserves originalProduct by reference', () => {
    expect(norm.originalProduct).toBe(meeshoProduct);
  });
  it('normalizedTitle — noise stripped', () => {
    expect(norm.normalizedTitle).toBe('adrika refined kurtis arrival');
  });
  it('normalizedBrand is undefined when platform omits it', () => {
    expect(norm.normalizedBrand).toBeUndefined();
  });
  it('tokens', () => {
    expect(norm.tokens).toEqual(['adrika', 'arrival', 'kurtis', 'refined']);
  });
  it('color is undefined', () => expect(norm.color).toBeUndefined());
  it('size is undefined',  () => expect(norm.size).toBeUndefined());
});

// ─── Cross-platform token overlap ────────────────────────────────────────────
//
// Core guarantee: the same physical product scraped from different platforms
// must produce overlapping token sets. All pairs of the Nike Air Force 1
// across Amazon / Flipkart / Myntra / Ajio must score above 0.3 Jaccard.

describe('Cross-platform token overlap — Nike Air Force 1 (same product)', () => {
  const az = normalizeProduct(amazonProduct).tokens;
  const fk = normalizeProduct(flipkartProduct).tokens;
  const mn = normalizeProduct(myntraProduct).tokens;
  const aj = normalizeProduct(ajioProduct).tokens;

  it('Amazon ↔ Flipkart Jaccard > 0.3', () => expect(jaccard(az, fk)).toBeGreaterThan(0.3));
  it('Amazon ↔ Myntra Jaccard > 0.3',   () => expect(jaccard(az, mn)).toBeGreaterThan(0.3));
  it('Amazon ↔ Ajio Jaccard > 0.3',     () => expect(jaccard(az, aj)).toBeGreaterThan(0.3));
  it('Flipkart ↔ Myntra Jaccard > 0.3', () => expect(jaccard(fk, mn)).toBeGreaterThan(0.3));
  it('Flipkart ↔ Ajio Jaccard > 0.3',   () => expect(jaccard(fk, aj)).toBeGreaterThan(0.3));
  it('Myntra ↔ Ajio Jaccard > 0.3',     () => expect(jaccard(mn, aj)).toBeGreaterThan(0.3));
});

// ─── Negative test — different products must NOT produce high overlap ─────────

describe('Cross-platform token overlap — different products (should NOT match)', () => {
  const nikeTokens  = normalizeProduct(amazonProduct).tokens;
  const kurtaTokens = normalizeProduct(bibaKurta).tokens;

  it('Nike Air Force ↔ Biba Kurta Jaccard < 0.15', () => {
    expect(jaccard(nikeTokens, kurtaTokens)).toBeLessThan(0.15);
  });
});

// ─── Immutability ─────────────────────────────────────────────────────────────

describe('Immutability — original SearchProduct must not be mutated', () => {
  const original: SearchProduct = {
    id: 'az_IMMUTABLE',
    title: 'Test Product Original Title',
    brand: 'TestBrand',
    price: 999,
    imageUrl: 'https://example.com/img.jpg',
    platform: 'Amazon India',
    url: 'https://www.amazon.in/dp/IMMUTABLE',
  };

  const titleBefore = original.title;
  const brandBefore = original.brand;
  normalizeProduct(original);

  it('title is unchanged after normalization', () => {
    expect(original.title).toBe(titleBefore);
  });
  it('brand is unchanged after normalization', () => {
    expect(original.brand).toBe(brandBefore);
  });
});

// ─── normalizeProducts (batch) ────────────────────────────────────────────────

describe('normalizeProducts — batch convenience wrapper', () => {
  it('returns same length as input', () => {
    const results = normalizeProducts([amazonProduct, flipkartProduct, myntraProduct]);
    expect(results).toHaveLength(3);
  });
  it('preserves order', () => {
    const results = normalizeProducts([amazonProduct, flipkartProduct]);
    expect(results[0].originalProduct).toBe(amazonProduct);
    expect(results[1].originalProduct).toBe(flipkartProduct);
  });
  it('returns [] for empty input', () => {
    expect(normalizeProducts([])).toEqual([]);
  });
});
