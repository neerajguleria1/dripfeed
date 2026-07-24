/**
 * variantFetcher.test.ts
 *
 * Unit tests for the Ajio variant fetcher — parser only.
 *
 * All tests are pure: no HTTP calls, no ScraperAPI, no environment variables.
 * fetchAjioVariants() is NOT tested here (it requires a live API key).
 * Only parseAjioPdpResponse() is tested — it is a pure function.
 *
 * Fixture data is shaped to match the verified Ajio PDP API response format.
 */

import { describe, it, expect } from 'vitest';
import { parseAjioPdpResponse } from '../../api/_lib/variantFetcher.js';
import type { ProductVariant } from '../../api/_lib/types/productVariant.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid color variant entry as returned by Ajio's PDP API */
function makeColorVariant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    colorGroup:  '469486197_white',
    images:      [{ url: 'https://assets.ajio.com/medias/sys_master/white.jpg' }],
    price:       { value: 8299 },
    wasPrice:    { value: 9999 },
    url:         '/nike-air-force-1/p/469486197_white',
    available:   true,
    ...overrides,
  };
}

/** Minimal valid size entry as returned by Ajio's PDP API */
function makeSizeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    size:      'UK 8',
    available: true,
    price:     { value: 8299 },
    ...overrides,
  };
}

/** A realistic full PDP response with 3 colors and 4 sizes */
const FULL_PDP_RESPONSE = {
  colorVariants: [
    makeColorVariant({ colorGroup: '469486197_white', url: '/nike-af1/p/469486197_white' }),
    makeColorVariant({
      colorGroup: '469486197_navy_blue',
      images: [{ url: 'https://assets.ajio.com/medias/sys_master/navy.jpg' }],
      price: { value: 8499 },
      wasPrice: { value: 9999 },
      url: '/nike-af1/p/469486197_navy_blue',
    }),
    makeColorVariant({
      colorGroup: '469486197_black',
      images: [{ url: 'https://assets.ajio.com/medias/sys_master/black.jpg' }],
      price: { value: 7999 },
      wasPrice: { value: 9999 },
      url: '/nike-af1/p/469486197_black',
    }),
  ],
  sizes: [
    makeSizeEntry({ size: 'UK 7',  available: true  }),
    makeSizeEntry({ size: 'UK 8',  available: true  }),
    makeSizeEntry({ size: 'UK 9',  available: false }),
    makeSizeEntry({ size: 'UK 10', available: true  }),
  ],
};

// ─── Edge case inputs ─────────────────────────────────────────────────────────

describe('parseAjioPdpResponse — invalid / empty inputs', () => {
  it('returns [] for null', () => {
    expect(parseAjioPdpResponse(null)).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(parseAjioPdpResponse(undefined)).toEqual([]);
  });

  it('returns [] for a string', () => {
    expect(parseAjioPdpResponse('not an object')).toEqual([]);
  });

  it('returns [] for a number', () => {
    expect(parseAjioPdpResponse(42)).toEqual([]);
  });

  it('returns [] for an empty object', () => {
    expect(parseAjioPdpResponse({})).toEqual([]);
  });

  it('returns [] when colorVariants is missing', () => {
    expect(parseAjioPdpResponse({ sizes: [] })).toEqual([]);
  });

  it('returns [] when colorVariants is an empty array', () => {
    expect(parseAjioPdpResponse({ colorVariants: [] })).toEqual([]);
  });

  it('returns [] when colorVariants contains only invalid entries', () => {
    expect(parseAjioPdpResponse({ colorVariants: [null, 42, 'bad'] })).toEqual([]);
  });
});

// ─── Color variant parsing ────────────────────────────────────────────────────

describe('parseAjioPdpResponse — color variant parsing', () => {
  it('produces one color variant per colorVariants entry', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const colorVariants = result.filter(v => v.color !== undefined);
    expect(colorVariants).toHaveLength(3);
  });

  it('sets variantId to the colorGroup string', () => {
    const result = parseAjioPdpResponse({ colorVariants: [makeColorVariant()] });
    expect(result[0].variantId).toBe('469486197_white');
  });

  it('parses single-word color correctly', () => {
    const result = parseAjioPdpResponse({ colorVariants: [makeColorVariant({ colorGroup: '469486197_white' })] });
    expect(result[0].color).toBe('White');
  });

  it('parses multi-word color with underscores correctly', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ colorGroup: '469486197_navy_blue' })],
    });
    expect(result[0].color).toBe('Navy Blue');
  });

  it('parses three-word color correctly', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ colorGroup: '469486197_off_white' })],
    });
    expect(result[0].color).toBe('Off White');
  });

  it('size is undefined on color variants', () => {
    const result = parseAjioPdpResponse({ colorVariants: [makeColorVariant()] });
    expect(result[0].size).toBeUndefined();
  });

  it('parses price correctly', () => {
    const result = parseAjioPdpResponse({ colorVariants: [makeColorVariant({ price: { value: 8299 } })] });
    expect(result[0].price).toBe(8299);
  });

  it('parses originalPrice when wasPrice > price', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ price: { value: 8299 }, wasPrice: { value: 9999 } })],
    });
    expect(result[0].originalPrice).toBe(9999);
  });

  it('sets originalPrice to undefined when wasPrice equals price', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ price: { value: 8299 }, wasPrice: { value: 8299 } })],
    });
    expect(result[0].originalPrice).toBeUndefined();
  });

  it('sets originalPrice to undefined when wasPrice is absent', () => {
    const cv = makeColorVariant();
    delete cv['wasPrice'];
    const result = parseAjioPdpResponse({ colorVariants: [cv] });
    expect(result[0].originalPrice).toBeUndefined();
  });

  it('converts relative URL to absolute', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ url: '/nike-af1/p/469486197_white' })],
    });
    expect(result[0].buyUrl).toBe('https://www.ajio.com/nike-af1/p/469486197_white');
  });

  it('passes through already-absolute https URL unchanged', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ url: 'https://www.ajio.com/nike-af1/p/469486197_white' })],
    });
    expect(result[0].buyUrl).toBe('https://www.ajio.com/nike-af1/p/469486197_white');
  });

  it('upgrades http:// image URL to https://', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ images: [{ url: 'http://assets.ajio.com/img.jpg' }] })],
    });
    expect(result[0].imageUrl).toBe('https://assets.ajio.com/img.jpg');
  });

  it('uses outfitPictureURL as image fallback when images[] is empty', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [{
        colorGroup:       '469486197_white',
        images:           [],
        outfitPictureURL: 'https://assets.ajio.com/outfit.jpg',
        price:            { value: 8299 },
        url:              '/p/469486197_white',
        available:        true,
      }],
    });
    expect(result[0].imageUrl).toBe('https://assets.ajio.com/outfit.jpg');
  });

  it('sets available: true when field is true', () => {
    const result = parseAjioPdpResponse({ colorVariants: [makeColorVariant({ available: true })] });
    expect(result[0].available).toBe(true);
  });

  it('sets available: false when field is false', () => {
    const result = parseAjioPdpResponse({ colorVariants: [makeColorVariant({ available: false })] });
    expect(result[0].available).toBe(false);
  });

  it('defaults available to true when field is absent', () => {
    const cv = makeColorVariant();
    delete cv['available'];
    const result = parseAjioPdpResponse({ colorVariants: [cv] });
    expect(result[0].available).toBe(true);
  });

  it('skips color variants with price <= 0', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ price: { value: 0 } })],
    });
    expect(result).toHaveLength(0);
  });

  it('skips color variants with missing colorGroup', () => {
    const cv = makeColorVariant();
    delete cv['colorGroup'];
    const result = parseAjioPdpResponse({ colorVariants: [cv] });
    expect(result).toHaveLength(0);
  });

  it('skips color variants with missing image', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ images: [], outfitPictureURL: '' })],
    });
    expect(result).toHaveLength(0);
  });
});

// ─── Size variant parsing ─────────────────────────────────────────────────────

describe('parseAjioPdpResponse — size variant parsing', () => {
  it('produces one size variant per sizes entry', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const sizeVariants = result.filter(v => v.size !== undefined);
    expect(sizeVariants).toHaveLength(4);
  });

  it('sets variantId to "size_{normalized_label}"', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant()],
      sizes: [makeSizeEntry({ size: 'UK 8' })],
    });
    const sizeVariant = result.find(v => v.size !== undefined);
    expect(sizeVariant?.variantId).toBe('size_uk_8');
  });

  it('color is undefined on size variants', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant()],
      sizes: [makeSizeEntry()],
    });
    const sizeVariant = result.find(v => v.size !== undefined);
    expect(sizeVariant?.color).toBeUndefined();
  });

  it('size label is preserved exactly', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant()],
      sizes: [makeSizeEntry({ size: 'UK 10' })],
    });
    const sizeVariant = result.find(v => v.size !== undefined);
    expect(sizeVariant?.size).toBe('UK 10');
  });

  it('uses size-specific price when provided', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ price: { value: 8299 } })],
      sizes: [makeSizeEntry({ size: 'UK 8', price: { value: 8999 } })],
    });
    const sizeVariant = result.find(v => v.size !== undefined);
    expect(sizeVariant?.price).toBe(8999);
  });

  it('falls back to first color variant price when size has no price', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ price: { value: 8299 } })],
      sizes: [{ size: 'UK 8', available: true }],  // no price field
    });
    const sizeVariant = result.find(v => v.size !== undefined);
    expect(sizeVariant?.price).toBe(8299);
  });

  it('inherits imageUrl from first color variant', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ images: [{ url: 'https://assets.ajio.com/white.jpg' }] })],
      sizes: [makeSizeEntry()],
    });
    const sizeVariant = result.find(v => v.size !== undefined);
    expect(sizeVariant?.imageUrl).toBe('https://assets.ajio.com/white.jpg');
  });

  it('inherits buyUrl from first color variant', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant({ url: '/nike-af1/p/469486197_white' })],
      sizes: [makeSizeEntry()],
    });
    const sizeVariant = result.find(v => v.size !== undefined);
    expect(sizeVariant?.buyUrl).toBe('https://www.ajio.com/nike-af1/p/469486197_white');
  });

  it('sets available: false for out-of-stock sizes', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant()],
      sizes: [makeSizeEntry({ available: false })],
    });
    const sizeVariant = result.find(v => v.size !== undefined);
    expect(sizeVariant?.available).toBe(false);
  });

  it('skips size entries with empty size label', () => {
    const result = parseAjioPdpResponse({
      colorVariants: [makeColorVariant()],
      sizes: [makeSizeEntry({ size: '' })],
    });
    const sizeVariants = result.filter(v => v.size !== undefined);
    expect(sizeVariants).toHaveLength(0);
  });

  it('produces no size variants when sizes array is absent', () => {
    const result = parseAjioPdpResponse({ colorVariants: [makeColorVariant()] });
    const sizeVariants = result.filter(v => v.size !== undefined);
    expect(sizeVariants).toHaveLength(0);
  });

  it('produces no size variants when there are no valid color variants (no representative)', () => {
    // Sizes need a color variant to inherit image/url from — without one, skip all sizes
    const result = parseAjioPdpResponse({
      colorVariants: [],
      sizes: [makeSizeEntry()],
    });
    expect(result).toHaveLength(0);
  });
});

// ─── Full response integration ────────────────────────────────────────────────

describe('parseAjioPdpResponse — full response', () => {
  it('produces correct total variant count (3 colors + 4 sizes)', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    expect(result).toHaveLength(7);
  });

  it('color variants come before size variants', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const firstSizeIndex = result.findIndex(v => v.size !== undefined);
    const lastColorIndex = result.map(v => v.color !== undefined).lastIndexOf(true);
    expect(lastColorIndex).toBeLessThan(firstSizeIndex);
  });

  it('all color variants have color defined and size undefined', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const colorVariants = result.filter(v => v.color !== undefined);
    expect(colorVariants.every(v => v.size === undefined)).toBe(true);
  });

  it('all size variants have size defined and color undefined', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const sizeVariants = result.filter(v => v.size !== undefined);
    expect(sizeVariants.every(v => v.color === undefined)).toBe(true);
  });

  it('all variants have non-empty buyUrl', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    expect(result.every(v => v.buyUrl.startsWith('https://'))).toBe(true);
  });

  it('all variants have non-empty imageUrl', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    expect(result.every(v => v.imageUrl.startsWith('https://'))).toBe(true);
  });

  it('all variants have price > 0', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    expect(result.every(v => v.price > 0)).toBe(true);
  });

  it('out-of-stock size (UK 9) is marked available: false', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const uk9 = result.find(v => v.size === 'UK 9');
    expect(uk9?.available).toBe(false);
  });

  it('in-stock sizes are marked available: true', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const uk8 = result.find(v => v.size === 'UK 8');
    expect(uk8?.available).toBe(true);
  });

  it('navy blue color is parsed correctly', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const navy = result.find(v => v.color === 'Navy Blue');
    expect(navy).toBeDefined();
    expect(navy?.variantId).toBe('469486197_navy_blue');
    expect(navy?.price).toBe(8499);
  });

  it('each color variant has a distinct buyUrl', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const colorVariants = result.filter(v => v.color !== undefined);
    const urls = colorVariants.map(v => v.buyUrl);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(colorVariants.length);
  });

  it('each color variant has a distinct variantId', () => {
    const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);
    const colorVariants = result.filter(v => v.color !== undefined);
    const ids = colorVariants.map(v => v.variantId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(colorVariants.length);
  });
});

// ─── Example output ───────────────────────────────────────────────────────────
// This test documents the exact expected output shape for a known input.
// It serves as a living specification and regression guard.

describe('parseAjioPdpResponse — example output (Nike Air Force 1, product 469486197)', () => {
  const result = parseAjioPdpResponse(FULL_PDP_RESPONSE);

  it('first variant is White color', () => {
    const expected: ProductVariant = {
      variantId:     '469486197_white',
      color:         'White',
      size:          undefined,
      imageUrl:      'https://assets.ajio.com/medias/sys_master/white.jpg',
      price:         8299,
      originalPrice: 9999,
      buyUrl:        'https://www.ajio.com/nike-af1/p/469486197_white',
      available:     true,
    };
    expect(result[0]).toEqual(expected);
  });

  it('second variant is Navy Blue color', () => {
    const expected: ProductVariant = {
      variantId:     '469486197_navy_blue',
      color:         'Navy Blue',
      size:          undefined,
      imageUrl:      'https://assets.ajio.com/medias/sys_master/navy.jpg',
      price:         8499,
      originalPrice: 9999,
      buyUrl:        'https://www.ajio.com/nike-af1/p/469486197_navy_blue',
      available:     true,
    };
    expect(result[1]).toEqual(expected);
  });

  it('fourth variant is UK 7 size', () => {
    const expected: ProductVariant = {
      variantId:     'size_uk_7',
      color:         undefined,
      size:          'UK 7',
      imageUrl:      'https://assets.ajio.com/medias/sys_master/white.jpg',
      price:         8299,
      originalPrice: 9999,
      buyUrl:        'https://www.ajio.com/nike-af1/p/469486197_white',
      available:     true,
    };
    expect(result[3]).toEqual(expected);
  });

  it('sixth variant is UK 9 size (out of stock)', () => {
    const expected: ProductVariant = {
      variantId:     'size_uk_9',
      color:         undefined,
      size:          'UK 9',
      imageUrl:      'https://assets.ajio.com/medias/sys_master/white.jpg',
      price:         8299,
      originalPrice: 9999,
      buyUrl:        'https://www.ajio.com/nike-af1/p/469486197_white',
      available:     false,
    };
    expect(result[5]).toEqual(expected);
  });
});
