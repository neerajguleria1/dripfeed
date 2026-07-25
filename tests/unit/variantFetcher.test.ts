/**
 * variantFetcher.test.ts
 *
 * Unit tests for parseAjioPdpResponse() — pure function, no HTTP.
 *
 * Fixture data mirrors the verified Ajio /api/p/{colorCode} response:
 *   baseOptions[0].options[]  → colors
 *   variantOptions[]          → sizes for the fetched color
 */

import { describe, it, expect } from 'vitest';
import { parseAjioPdpResponse } from '../../api/_lib/variantFetcher.js';
import type { AjioProductVariants } from '../../api/_lib/types/productVariant.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeColorOption(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code:  '460886329_white',
    color: 'WHITE',
    url:   '/nike-men-air-force-1-07-sneakers/p/460886329_white',
    priceData:    { value: 7495 },
    wasPriceData: { value: 8999 },
    stock: { stockLevelStatus: 'inStock', stockLevel: 10 },
    modelImage: { url: 'https://assets.ajio.com/medias/460886329-white-MODEL.jpg' },
    variantOptionQualifiers: [
      {
        qualifier:    'color',
        value:        'white',
        swatchImage:  { url: 'https://assets.ajio.com/medias/460886329-white-SWATCH.jpg' },
      },
    ],
    ...overrides,
  };
}

function makeSizeOption(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code:              '460886329003',
    url:               '/nike-men-air-force-1-07-sneakers/p/460886329003',
    priceData:         { value: 7495 },
    wasPriceData:      { value: 8999 },
    stock:             { stockLevelStatus: 'inStock', stockLevel: 37 },
    modelImage:        { url: 'https://assets.ajio.com/medias/460886329-white-MODEL.jpg' },
    scDisplaySize:     '7',
    displaySizeFormat: 'UK',
    variantOptionQualifiers: [
      { qualifier: 'color', value: 'white' },
      { qualifier: 'size',  value: '8' },
    ],
    ...overrides,
  };
}

/** Realistic full response: 1 color (white) + 3 sizes */
const FULL_RESPONSE = {
  code:        '460886329_white',
  baseProduct: '460886329',
  baseOptions: [{
    variantType: 'FnlColorVariant',
    options: [
      makeColorOption({ code: '460886329_white', color: 'WHITE' }),
      makeColorOption({
        code:  '460886329_black',
        color: 'BLACK',
        url:   '/nike-men-air-force-1-07-sneakers/p/460886329_black',
        priceData:    { value: 7495 },
        wasPriceData: { value: 8999 },
        stock: { stockLevelStatus: 'inStock', stockLevel: 5 },
        modelImage: { url: 'https://assets.ajio.com/medias/460886329-black-MODEL.jpg' },
        variantOptionQualifiers: [
          {
            qualifier:   'color',
            value:       'black',
            swatchImage: { url: 'https://assets.ajio.com/medias/460886329-black-SWATCH.jpg' },
          },
        ],
      }),
    ],
  }],
  variantOptions: [
    makeSizeOption({ code: '460886329002', scDisplaySize: '6', stock: { stockLevelStatus: 'inStock',    stockLevel: 20 }, url: '/nike-men-air-force-1-07-sneakers/p/460886329002' }),
    makeSizeOption({ code: '460886329003', scDisplaySize: '7', stock: { stockLevelStatus: 'inStock',    stockLevel: 37 }, url: '/nike-men-air-force-1-07-sneakers/p/460886329003' }),
    makeSizeOption({ code: '460886329004', scDisplaySize: '8', stock: { stockLevelStatus: 'outOfStock', stockLevel: 0  }, url: '/nike-men-air-force-1-07-sneakers/p/460886329004' }),
  ],
};

// ─── Invalid / empty inputs ───────────────────────────────────────────────────

describe('parseAjioPdpResponse — invalid inputs', () => {
  it('returns null for null',            () => expect(parseAjioPdpResponse(null)).toBeNull());
  it('returns null for undefined',       () => expect(parseAjioPdpResponse(undefined)).toBeNull());
  it('returns null for a string',        () => expect(parseAjioPdpResponse('bad')).toBeNull());
  it('returns null for a number',        () => expect(parseAjioPdpResponse(42)).toBeNull());
  it('returns null for an empty object', () => expect(parseAjioPdpResponse({})).toBeNull());

  it('returns null when baseOptions and variantOptions are both empty', () => {
    expect(parseAjioPdpResponse({
      code: '460886329_white',
      baseProduct: '460886329',
      baseOptions: [{ options: [] }],
      variantOptions: [],
    })).toBeNull();
  });
});

// ─── Root fields ──────────────────────────────────────────────────────────────

describe('parseAjioPdpResponse — root fields', () => {
  it('sets colorCode from response.code', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colorCode).toBe('460886329_white');
  });

  it('sets baseProduct from response.baseProduct', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.baseProduct).toBe('460886329');
  });

  it('defaults colorCode to empty string when code is absent', () => {
    const { code: _omit, ...rest } = FULL_RESPONSE as Record<string, unknown>;
    const result = parseAjioPdpResponse(rest)!;
    expect(result.colorCode).toBe('');
  });
});

// ─── Color parsing ────────────────────────────────────────────────────────────

describe('parseAjioPdpResponse — colors (baseOptions)', () => {
  it('parses all color options', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colors).toHaveLength(2);
  });

  it('sets colorCode on each color', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colors[0].colorCode).toBe('460886329_white');
    expect(result.colors[1].colorCode).toBe('460886329_black');
  });

  it('title-cases the color name from qualifier value', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colors[0].colorName).toBe('White');
    expect(result.colors[1].colorName).toBe('Black');
  });

  it('title-cases multi-word color names', () => {
    const result = parseAjioPdpResponse({
      code: 'x_navy_blue', baseProduct: 'x',
      baseOptions: [{ options: [makeColorOption({
        code: 'x_navy_blue',
        variantOptionQualifiers: [{ qualifier: 'color', value: 'navy_blue', swatchImage: { url: 'https://s.com/s.jpg' } }],
      })] }],
      variantOptions: [],
    })!;
    expect(result.colors[0].colorName).toBe('Navy Blue');
  });

  it('falls back to top-level color field when qualifier is absent', () => {
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption({ variantOptionQualifiers: [] })] }],
      variantOptions: [],
    })!;
    expect(result.colors[0].colorName).toBe('White');
  });

  it('extracts swatch URL from color qualifier swatchImage', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colors[0].swatchUrl).toBe('https://assets.ajio.com/medias/460886329-white-SWATCH.jpg');
  });

  it('extracts imageUrl from modelImage', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colors[0].imageUrl).toBe('https://assets.ajio.com/medias/460886329-white-MODEL.jpg');
  });

  it('upgrades http:// image URLs to https://', () => {
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption({ modelImage: { url: 'http://assets.ajio.com/img.jpg' } })] }],
      variantOptions: [],
    })!;
    expect(result.colors[0].imageUrl).toBe('https://assets.ajio.com/img.jpg');
  });

  it('parses price from priceData.value', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colors[0].price).toBe(7495);
  });

  it('sets originalPrice when wasPriceData > price', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colors[0].originalPrice).toBe(8999);
  });

  it('sets originalPrice to undefined when wasPriceData equals price', () => {
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption({ priceData: { value: 7495 }, wasPriceData: { value: 7495 } })] }],
      variantOptions: [],
    })!;
    expect(result.colors[0].originalPrice).toBeUndefined();
  });

  it('sets available: true when stockLevelStatus is inStock', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colors[0].available).toBe(true);
  });

  it('sets available: false when stockLevelStatus is outOfStock', () => {
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption({ stock: { stockLevelStatus: 'outOfStock', stockLevel: 0 } })] }],
      variantOptions: [],
    })!;
    expect(result.colors[0].available).toBe(false);
  });

  it('converts relative buyUrl to absolute', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.colors[0].buyUrl).toBe('https://www.ajio.com/nike-men-air-force-1-07-sneakers/p/460886329_white');
  });

  it('passes through already-absolute buyUrl', () => {
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption({ url: 'https://www.ajio.com/p/460886329_white' })] }],
      variantOptions: [],
    })!;
    expect(result.colors[0].buyUrl).toBe('https://www.ajio.com/p/460886329_white');
  });

  it('skips color options with price <= 0', () => {
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption({ priceData: { value: 0 } })] }],
      variantOptions: [],
    });
    expect(result).toBeNull();
  });

  it('skips color options with missing modelImage', () => {
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption({ modelImage: null })] }],
      variantOptions: [],
    });
    expect(result).toBeNull();
  });

  it('skips color options with missing code', () => {
    const opt = makeColorOption();
    delete opt['code'];
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [opt] }],
      variantOptions: [],
    });
    expect(result).toBeNull();
  });
});

// ─── Size parsing ─────────────────────────────────────────────────────────────

describe('parseAjioPdpResponse — sizes (variantOptions)', () => {
  it('parses all size options', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes).toHaveLength(3);
  });

  it('sets skuCode from size option code', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[0].skuCode).toBe('460886329002');
    expect(result.sizes[1].skuCode).toBe('460886329003');
  });

  it('sets sizeLabel from scDisplaySize', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[0].sizeLabel).toBe('6');
    expect(result.sizes[1].sizeLabel).toBe('7');
  });

  it('falls back to size qualifier value when scDisplaySize is absent', () => {
    const opt = makeSizeOption();
    delete opt['scDisplaySize'];
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption()] }],
      variantOptions: [opt],
    })!;
    expect(result.sizes[0].sizeLabel).toBe('8');
  });

  it('sets sizeFormat from displaySizeFormat', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[0].sizeFormat).toBe('UK');
  });

  it('defaults sizeFormat to "UK" when absent', () => {
    const opt = makeSizeOption();
    delete opt['displaySizeFormat'];
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption()] }],
      variantOptions: [opt],
    })!;
    expect(result.sizes[0].sizeFormat).toBe('UK');
  });

  it('parses price from priceData.value', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[0].price).toBe(7495);
  });

  it('sets originalPrice when wasPriceData > price', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[0].originalPrice).toBe(8999);
  });

  it('sets originalPrice to undefined when wasPriceData equals price', () => {
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption()] }],
      variantOptions: [makeSizeOption({ priceData: { value: 7495 }, wasPriceData: { value: 7495 } })],
    })!;
    expect(result.sizes[0].originalPrice).toBeUndefined();
  });

  it('sets available: true when stockLevelStatus is inStock', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[0].available).toBe(true);
    expect(result.sizes[1].available).toBe(true);
  });

  it('sets available: false when stockLevelStatus is outOfStock', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[2].available).toBe(false);
  });

  it('sets stockLevel from stock.stockLevel', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[0].stockLevel).toBe(20);
    expect(result.sizes[1].stockLevel).toBe(37);
    expect(result.sizes[2].stockLevel).toBe(0);
  });

  it('converts relative buyUrl to absolute', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[1].buyUrl).toBe('https://www.ajio.com/nike-men-air-force-1-07-sneakers/p/460886329003');
  });

  it('each size has a distinct buyUrl (its own SKU URL)', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    const urls = result.sizes.map(s => s.buyUrl);
    expect(new Set(urls).size).toBe(3);
  });

  it('uses SKU modelImage as imageUrl when present', () => {
    const result = parseAjioPdpResponse(FULL_RESPONSE)!;
    expect(result.sizes[0].imageUrl).toBe('https://assets.ajio.com/medias/460886329-white-MODEL.jpg');
  });

  it('falls back to fetched color imageUrl when SKU has no modelImage', () => {
    const opt = makeSizeOption();
    delete opt['modelImage'];
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption()] }],
      variantOptions: [opt],
    })!;
    expect(result.sizes[0].imageUrl).toBe('https://assets.ajio.com/medias/460886329-white-MODEL.jpg');
  });

  it('skips size options with missing skuCode', () => {
    const opt = makeSizeOption();
    delete opt['code'];
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption()] }],
      variantOptions: [opt],
    })!;
    expect(result.sizes).toHaveLength(0);
  });

  it('skips size options with missing sizeLabel', () => {
    const opt = makeSizeOption();
    delete opt['scDisplaySize'];
    (opt['variantOptionQualifiers'] as unknown[]) = [{ qualifier: 'color', value: 'white' }];
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption()] }],
      variantOptions: [opt],
    })!;
    expect(result.sizes).toHaveLength(0);
  });

  it('skips size options with price <= 0', () => {
    const result = parseAjioPdpResponse({
      code: '460886329_white', baseProduct: '460886329',
      baseOptions: [{ options: [makeColorOption()] }],
      variantOptions: [makeSizeOption({ priceData: { value: 0 } })],
    })!;
    expect(result.sizes).toHaveLength(0);
  });

  it('produces empty sizes array when variantOptions is absent', () => {
    const { variantOptions: _omit, ...rest } = FULL_RESPONSE as Record<string, unknown>;
    const result = parseAjioPdpResponse(rest)!;
    expect(result.sizes).toHaveLength(0);
  });
});

// ─── Full response integration ────────────────────────────────────────────────

describe('parseAjioPdpResponse — full response integration', () => {
  let result: AjioProductVariants;

  beforeAll(() => {
    result = parseAjioPdpResponse(FULL_RESPONSE)!;
  });

  it('returns non-null result', () => {
    expect(result).not.toBeNull();
  });

  it('has 2 colors and 3 sizes', () => {
    expect(result.colors).toHaveLength(2);
    expect(result.sizes).toHaveLength(3);
  });

  it('all colors have https buyUrl', () => {
    expect(result.colors.every(c => c.buyUrl.startsWith('https://'))).toBe(true);
  });

  it('all colors have https imageUrl', () => {
    expect(result.colors.every(c => c.imageUrl.startsWith('https://'))).toBe(true);
  });

  it('all sizes have https buyUrl', () => {
    expect(result.sizes.every(s => s.buyUrl.startsWith('https://'))).toBe(true);
  });

  it('all sizes have https imageUrl', () => {
    expect(result.sizes.every(s => s.imageUrl.startsWith('https://'))).toBe(true);
  });

  it('all colors have price > 0', () => {
    expect(result.colors.every(c => c.price > 0)).toBe(true);
  });

  it('all sizes have price > 0', () => {
    expect(result.sizes.every(s => s.price > 0)).toBe(true);
  });

  it('all colors have distinct colorCodes', () => {
    const codes = result.colors.map(c => c.colorCode);
    expect(new Set(codes).size).toBe(result.colors.length);
  });

  it('all sizes have distinct skuCodes', () => {
    const codes = result.sizes.map(s => s.skuCode);
    expect(new Set(codes).size).toBe(result.sizes.length);
  });

  it('all sizes have distinct buyUrls', () => {
    const urls = result.sizes.map(s => s.buyUrl);
    expect(new Set(urls).size).toBe(result.sizes.length);
  });

  it('out-of-stock size (UK 8) has available: false and stockLevel: 0', () => {
    const uk8 = result.sizes.find(s => s.sizeLabel === '8');
    expect(uk8?.available).toBe(false);
    expect(uk8?.stockLevel).toBe(0);
  });

  it('in-stock size (UK 7) has available: true and stockLevel > 0', () => {
    const uk7 = result.sizes.find(s => s.sizeLabel === '7');
    expect(uk7?.available).toBe(true);
    expect(uk7?.stockLevel).toBeGreaterThan(0);
  });
});

// ─── Example output spec ──────────────────────────────────────────────────────
// Documents the exact expected output for a known input — living specification.

describe('parseAjioPdpResponse — example output spec (Nike AF1 460886329_white)', () => {
  const result = parseAjioPdpResponse(FULL_RESPONSE)!;

  it('root fields are correct', () => {
    expect(result.colorCode).toBe('460886329_white');
    expect(result.baseProduct).toBe('460886329');
  });

  it('first color is White with correct fields', () => {
    expect(result.colors[0]).toEqual({
      colorCode:     '460886329_white',
      colorName:     'White',
      swatchUrl:     'https://assets.ajio.com/medias/460886329-white-SWATCH.jpg',
      imageUrl:      'https://assets.ajio.com/medias/460886329-white-MODEL.jpg',
      price:         7495,
      originalPrice: 8999,
      available:     true,
      buyUrl:        'https://www.ajio.com/nike-men-air-force-1-07-sneakers/p/460886329_white',
    });
  });

  it('second color is Black with correct fields', () => {
    expect(result.colors[1]).toEqual({
      colorCode:     '460886329_black',
      colorName:     'Black',
      swatchUrl:     'https://assets.ajio.com/medias/460886329-black-SWATCH.jpg',
      imageUrl:      'https://assets.ajio.com/medias/460886329-black-MODEL.jpg',
      price:         7495,
      originalPrice: 8999,
      available:     true,
      buyUrl:        'https://www.ajio.com/nike-men-air-force-1-07-sneakers/p/460886329_black',
    });
  });

  it('first size (UK 6) has correct fields', () => {
    expect(result.sizes[0]).toEqual({
      skuCode:       '460886329002',
      sizeLabel:     '6',
      sizeFormat:    'UK',
      price:         7495,
      originalPrice: 8999,
      available:     true,
      stockLevel:    20,
      buyUrl:        'https://www.ajio.com/nike-men-air-force-1-07-sneakers/p/460886329002',
      imageUrl:      'https://assets.ajio.com/medias/460886329-white-MODEL.jpg',
    });
  });

  it('second size (UK 7) has correct fields', () => {
    expect(result.sizes[1]).toEqual({
      skuCode:       '460886329003',
      sizeLabel:     '7',
      sizeFormat:    'UK',
      price:         7495,
      originalPrice: 8999,
      available:     true,
      stockLevel:    37,
      buyUrl:        'https://www.ajio.com/nike-men-air-force-1-07-sneakers/p/460886329003',
      imageUrl:      'https://assets.ajio.com/medias/460886329-white-MODEL.jpg',
    });
  });

  it('third size (UK 8, out of stock) has correct fields', () => {
    expect(result.sizes[2]).toEqual({
      skuCode:       '460886329004',
      sizeLabel:     '8',
      sizeFormat:    'UK',
      price:         7495,
      originalPrice: 8999,
      available:     false,
      stockLevel:    0,
      buyUrl:        'https://www.ajio.com/nike-men-air-force-1-07-sneakers/p/460886329004',
      imageUrl:      'https://assets.ajio.com/medias/460886329-white-MODEL.jpg',
    });
  });
});
