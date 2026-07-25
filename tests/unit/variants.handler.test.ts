/**
 * variants.handler.test.ts
 *
 * Tests for GET /api/variants handler logic.
 *
 * fetchAjioVariants is mocked — no HTTP calls.
 * variantCache is imported directly so we can inspect/seed it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock fetchAjioVariants before importing the handler ─────────────────────

vi.mock('../../api/_lib/variantFetcher.js', () => ({
  fetchAjioVariants: vi.fn(),
}));

import { handleVariants } from '../../api/_lib/handlers/variants.js';
import { fetchAjioVariants } from '../../api/_lib/variantFetcher.js';
import { setVariantCache, getVariantCache } from '../../api/_lib/cache/variantCache.js';
import type { AjioProductVariants } from '../../api/_lib/types/productVariant.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(query: Record<string, string>, method = 'GET') {
  return { method, query } as any;
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json   = vi.fn().mockReturnValue(res);
  return res;
}

const MOCK_VARIANTS: AjioProductVariants = {
  colorCode:   '460886329_white',
  baseProduct: '460886329',
  colors: [{
    colorCode:     '460886329_white',
    colorName:     'White',
    swatchUrl:     'https://assets.ajio.com/medias/swatch.jpg',
    imageUrl:      'https://assets.ajio.com/medias/model.jpg',
    price:         7495,
    originalPrice: 8999,
    available:     true,
    buyUrl:        'https://www.ajio.com/nike/p/460886329_white',
  }],
  sizes: [{
    skuCode:       '460886329003',
    sizeLabel:     '7',
    sizeFormat:    'UK',
    price:         7495,
    originalPrice: 8999,
    available:     true,
    stockLevel:    37,
    buyUrl:        'https://www.ajio.com/nike/p/460886329003',
    imageUrl:      'https://assets.ajio.com/medias/model.jpg',
  }],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/variants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ✓ invalid platform returns 400
  it('returns 400 when platform is not ajio', async () => {
    const req = makeReq({ platform: 'myntra', productId: '460886329_white' });
    const res = makeRes();
    await handleVariants(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Platform not supported yet' });
  });

  // ✓ missing params return 400
  it('returns 400 when productId is missing', async () => {
    const req = makeReq({ platform: 'ajio' });
    const res = makeRes();
    await handleVariants(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'platform and productId are required' });
  });

  // ✓ valid Ajio request returns AjioProductVariants
  it('returns AjioProductVariants on a valid ajio request', async () => {
    vi.mocked(fetchAjioVariants).mockResolvedValue(MOCK_VARIANTS);
    const req = makeReq({ platform: 'ajio', productId: '460886329_white' });
    const res = makeRes();
    await handleVariants(req, res);
    expect(fetchAjioVariants).toHaveBeenCalledWith('460886329_white');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(MOCK_VARIANTS);
  });

  // ✓ cache miss stores response
  it('stores the fetched result in cache on a cache miss', async () => {
    vi.mocked(fetchAjioVariants).mockResolvedValue(MOCK_VARIANTS);
    const productId = 'cache-miss-test_white';
    const req = makeReq({ platform: 'ajio', productId });
    const res = makeRes();
    await handleVariants(req, res);
    expect(getVariantCache(productId)).toEqual(MOCK_VARIANTS);
  });

  // ✓ cache hit returns cached data without calling fetchAjioVariants
  it('returns cached data and skips fetch on a cache hit', async () => {
    const productId = 'cache-hit-test_white';
    setVariantCache(productId, MOCK_VARIANTS);
    const req = makeReq({ platform: 'ajio', productId });
    const res = makeRes();
    await handleVariants(req, res);
    expect(fetchAjioVariants).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(MOCK_VARIANTS);
  });

  // ✓ fetch returning null returns 500
  it('returns 500 when fetchAjioVariants returns null', async () => {
    vi.mocked(fetchAjioVariants).mockResolvedValue(null);
    const req = makeReq({ platform: 'ajio', productId: 'bad-product-id' });
    const res = makeRes();
    await handleVariants(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unable to fetch variants' });
  });

  // ✓ fetch throwing returns 500
  it('returns 500 when fetchAjioVariants throws', async () => {
    vi.mocked(fetchAjioVariants).mockRejectedValue(new Error('network error'));
    const req = makeReq({ platform: 'ajio', productId: 'throw-test_white' });
    const res = makeRes();
    await handleVariants(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unable to fetch variants' });
  });
});
