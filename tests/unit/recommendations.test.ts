/**
 * tests/unit/recommendations.test.ts
 *
 * Tests for the recommendation engine (scoring, sorting, sections)
 * and the useRecommendations hook.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRecommendations } from '../../api/_lib/recommendations';
import type { CanonicalProduct } from '../../api/_lib/types/canonicalProduct';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOffer(overrides: Record<string, unknown> = {}) {
  return {
    platform: 'flipkart',
    platformProductId: 'fk_001',
    title: 'Nike Air Max 270 Men Running Shoes',
    price: 5000,
    originalPrice: 8000,
    discount: 37,
    imageUrl: 'https://example.com/img.jpg',
    productUrl: 'https://flipkart.com/p/fk_001',
    affiliateUrl: 'https://flipkart.com/p/fk_001?aff=1',
    color: 'black',
    size: '9',
    rating: 4.2,
    originalProduct: {} as any,
    ...overrides,
  };
}

function makeCanonical(overrides: Partial<CanonicalProduct> & { offerOverrides?: Record<string, unknown> } = {}): CanonicalProduct {
  const { offerOverrides, ...rest } = overrides;
  return {
    id: `canon_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Nike Air Max 270 Men Running Shoes',
    brand: 'Nike',
    offerCount: 1,
    confidence: 0.9,
    offers: [makeOffer(offerOverrides ?? {})],
    ...rest,
  };
}

// ─── buildRecommendations ─────────────────────────────────────────────────────

describe('buildRecommendations', () => {

  // ── Empty pool ────────────────────────────────────────────────────────────

  it('returns all empty sections when pool is empty', () => {
    const source = makeCanonical();
    const result = buildRecommendations(source, []);
    expect(result.similar).toHaveLength(0);
    expect(result.betterDeal).toHaveLength(0);
    expect(result.popular).toHaveLength(0);
    expect(result.priceDropped).toHaveLength(0);
    expect(result.premium).toHaveLength(0);
    expect(result.budget).toHaveLength(0);
  });

  it('excludes the source product from all sections', () => {
    const source = makeCanonical({ id: 'source_id' });
    const pool = [source, makeCanonical()];
    const result = buildRecommendations(source, pool);
    const allIds = [
      ...result.similar,
      ...result.betterDeal,
      ...result.popular,
      ...result.priceDropped,
      ...result.premium,
      ...result.budget,
    ].map(s => s.product.id);
    expect(allIds).not.toContain('source_id');
  });

  // ── Scoring ───────────────────────────────────────────────────────────────

  it('same brand scores higher than different brand', () => {
    const source = makeCanonical({ brand: 'Nike' });
    const sameBrand = makeCanonical({ brand: 'Nike', title: 'Nike Air Force 1 Men Shoes' });
    const diffBrand = makeCanonical({ brand: 'Adidas', title: 'Adidas Ultraboost Men Shoes' });
    const result = buildRecommendations(source, [sameBrand, diffBrand]);

    const sameBrandScore = result.similar.find(s => s.product.id === sameBrand.id)?.score ?? 0;
    const diffBrandScore = result.similar.find(s => s.product.id === diffBrand.id)?.score ?? 0;
    expect(sameBrandScore).toBeGreaterThan(diffBrandScore);
  });

  it('same gender scores higher than opposite gender', () => {
    const source = makeCanonical({ title: 'Nike Shoes Men Running' });
    const sameGender = makeCanonical({ title: 'Adidas Shoes Men Running' });
    const diffGender = makeCanonical({ title: 'Adidas Shoes Women Running' });
    const result = buildRecommendations(source, [sameGender, diffGender]);

    const sameScore = result.similar.find(s => s.product.id === sameGender.id)?.score ?? 0;
    const diffScore = result.similar.find(s => s.product.id === diffGender.id)?.score ?? 0;
    expect(sameScore).toBeGreaterThan(diffScore);
  });

  it('score is normalized between 0 and 100', () => {
    const source = makeCanonical();
    const pool = Array.from({ length: 10 }, () => makeCanonical());
    const result = buildRecommendations(source, pool);
    const allScores = [
      ...result.similar,
      ...result.betterDeal,
      ...result.popular,
      ...result.priceDropped,
      ...result.premium,
      ...result.budget,
    ].map(s => s.score);
    for (const score of allScores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('similar section is sorted descending by score', () => {
    const source = makeCanonical({ brand: 'Nike', title: 'Nike Air Max 270 Men Shoes' });
    const pool = [
      makeCanonical({ brand: 'Nike', title: 'Nike Air Force 1 Men Shoes' }),
      makeCanonical({ brand: 'Adidas', title: 'Adidas Ultraboost Men Shoes' }),
      makeCanonical({ brand: 'Puma', title: 'Puma RS-X Women Shoes' }),
    ];
    const result = buildRecommendations(source, pool);
    const scores = result.similar.map(s => s.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  // ── Better Deal ───────────────────────────────────────────────────────────

  it('betterDeal only includes products cheaper than source', () => {
    const source = makeCanonical({ offerOverrides: { price: 5000 } });
    const cheaper = makeCanonical({ title: 'Nike Air Max 270 Men Shoes', offerOverrides: { price: 3500, discount: 30 } });
    const samePrice = makeCanonical({ title: 'Nike Air Max 270 Men Shoes', offerOverrides: { price: 5000 } });
    const pricier = makeCanonical({ title: 'Nike Air Max 270 Men Shoes', offerOverrides: { price: 7000 } });
    const result = buildRecommendations(source, [cheaper, samePrice, pricier]);

    const dealIds = result.betterDeal.map(s => s.product.id);
    expect(dealIds).toContain(cheaper.id);
    expect(dealIds).not.toContain(pricier.id);
  });

  it('betterDeal reason includes savings amount', () => {
    const source = makeCanonical({ offerOverrides: { price: 5000 } });
    const cheaper = makeCanonical({
      title: 'Nike Air Max 270 Men Shoes',
      offerOverrides: { price: 3000, discount: 40 },
    });
    const result = buildRecommendations(source, [cheaper]);
    const deal = result.betterDeal[0];
    expect(deal?.reason).toMatch(/2,000|save/i);
  });

  it('betterDeal sorted by savings descending', () => {
    const source = makeCanonical({ offerOverrides: { price: 5000 } });
    const save500 = makeCanonical({ title: 'Nike Shoes Men', offerOverrides: { price: 4500, discount: 10 } });
    const save2000 = makeCanonical({ title: 'Nike Shoes Men', offerOverrides: { price: 3000, discount: 40 } });
    const result = buildRecommendations(source, [save500, save2000]);
    expect(result.betterDeal[0]?.product.id).toBe(save2000.id);
  });

  // ── Budget Alternative ────────────────────────────────────────────────────

  it('budget only includes products at least 10% cheaper', () => {
    const source = makeCanonical({ offerOverrides: { price: 5000 } });
    // 10% cheaper = 4500 — exactly on boundary, should be included
    const budget = makeCanonical({ title: 'Nike Air Max Men Shoes', offerOverrides: { price: 4000 } });
    // Only 5% cheaper — should NOT be in budget
    const slightlyCheaper = makeCanonical({ title: 'Nike Air Max Men Shoes', offerOverrides: { price: 4800 } });
    const result = buildRecommendations(source, [budget, slightlyCheaper]);

    const budgetIds = result.budget.map(s => s.product.id);
    expect(budgetIds).toContain(budget.id);
    expect(budgetIds).not.toContain(slightlyCheaper.id);
  });

  it('budget reason shows percentage cheaper', () => {
    const source = makeCanonical({ offerOverrides: { price: 5000 } });
    const cheap = makeCanonical({ title: 'Nike Air Max Men Shoes', offerOverrides: { price: 2500 } });
    const result = buildRecommendations(source, [cheap]);
    expect(result.budget[0]?.reason).toMatch(/50%/);
  });

  it('budget sorted by price ascending', () => {
    const source = makeCanonical({ offerOverrides: { price: 5000 } });
    const p1 = makeCanonical({ title: 'Nike Shoes Men', offerOverrides: { price: 3000 } });
    const p2 = makeCanonical({ title: 'Nike Shoes Men', offerOverrides: { price: 2000 } });
    const p3 = makeCanonical({ title: 'Nike Shoes Men', offerOverrides: { price: 4000 } });
    const result = buildRecommendations(source, [p1, p2, p3]);
    const prices = result.budget.map(s => s.product.offers[0]?.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i - 1]!).toBeLessThanOrEqual(prices[i]!);
    }
  });

  // ── Premium Upgrade ───────────────────────────────────────────────────────

  it('premium only includes products at least 10% more expensive', () => {
    const source = makeCanonical({ offerOverrides: { price: 5000, rating: 4.0 } });
    const premium = makeCanonical({ title: 'Nike Air Max Men Shoes', offerOverrides: { price: 7000, rating: 4.5 } });
    const samePrice = makeCanonical({ title: 'Nike Air Max Men Shoes', offerOverrides: { price: 5100, rating: 4.5 } });
    const result = buildRecommendations(source, [premium, samePrice]);

    const premiumIds = result.premium.map(s => s.product.id);
    expect(premiumIds).toContain(premium.id);
    expect(premiumIds).not.toContain(samePrice.id);
  });

  it('premium reason shows rating when better', () => {
    const source = makeCanonical({ offerOverrides: { price: 5000, rating: 3.5 } });
    const prem = makeCanonical({ title: 'Nike Air Max Men Shoes', offerOverrides: { price: 7000, rating: 4.8 } });
    const result = buildRecommendations(source, [prem]);
    expect(result.premium[0]?.reason).toMatch(/4\.8/);
  });

  // ── Price Dropped ─────────────────────────────────────────────────────────

  it('priceDropped only includes products with ≥10% drop', () => {
    const source = makeCanonical();
    // 37.5% drop — should appear
    const dropped = makeCanonical({ offerOverrides: { price: 5000, originalPrice: 8000, discount: 37 } });
    // 5% drop — should NOT appear
    const smallDrop = makeCanonical({ offerOverrides: { price: 9500, originalPrice: 10000, discount: 5 } });
    // No original price — should NOT appear
    const noDrop = makeCanonical({ offerOverrides: { price: 5000, originalPrice: undefined } });
    const result = buildRecommendations(source, [dropped, smallDrop, noDrop]);

    const droppedIds = result.priceDropped.map(s => s.product.id);
    expect(droppedIds).toContain(dropped.id);
    expect(droppedIds).not.toContain(smallDrop.id);
    expect(droppedIds).not.toContain(noDrop.id);
  });

  it('priceDropped sorted by drop percentage descending', () => {
    const source = makeCanonical();
    const drop20 = makeCanonical({ offerOverrides: { price: 8000, originalPrice: 10000, discount: 20 } });
    const drop50 = makeCanonical({ offerOverrides: { price: 5000, originalPrice: 10000, discount: 50 } });
    const result = buildRecommendations(source, [drop20, drop50]);
    expect(result.priceDropped[0]?.product.id).toBe(drop50.id);
  });

  it('priceDropped reason shows drop percentage', () => {
    const source = makeCanonical();
    const dropped = makeCanonical({ offerOverrides: { price: 5000, originalPrice: 10000, discount: 50 } });
    const result = buildRecommendations(source, [dropped]);
    expect(result.priceDropped[0]?.reason).toMatch(/50%/);
  });

  // ── Popular ───────────────────────────────────────────────────────────────

  it('popular section is populated from pool', () => {
    const source = makeCanonical();
    const pool = Array.from({ length: 5 }, (_, i) =>
      makeCanonical({ offerOverrides: { discount: (i + 1) * 10 } })
    );
    const result = buildRecommendations(source, pool);
    expect(result.popular.length).toBeGreaterThan(0);
  });

  it('popular sorted by discount descending', () => {
    const source = makeCanonical();
    const p1 = makeCanonical({ offerOverrides: { discount: 10 } });
    const p2 = makeCanonical({ offerOverrides: { discount: 50 } });
    const p3 = makeCanonical({ offerOverrides: { discount: 30 } });
    const result = buildRecommendations(source, [p1, p2, p3]);
    const discounts = result.popular.map(s => s.product.offers[0]?.discount ?? 0);
    for (let i = 1; i < discounts.length; i++) {
      expect(discounts[i - 1]).toBeGreaterThanOrEqual(discounts[i]);
    }
  });

  // ── Limit ─────────────────────────────────────────────────────────────────

  it('respects the limit parameter', () => {
    const source = makeCanonical({ brand: 'Nike', title: 'Nike Air Max Men Shoes' });
    const pool = Array.from({ length: 20 }, () =>
      makeCanonical({ brand: 'Nike', title: 'Nike Air Max Men Shoes' })
    );
    const result = buildRecommendations(source, pool, 3);
    expect(result.similar.length).toBeLessThanOrEqual(3);
    expect(result.popular.length).toBeLessThanOrEqual(3);
  });

  // ── Token overlap ─────────────────────────────────────────────────────────

  it('higher token overlap produces higher similarity score', () => {
    const source = makeCanonical({ title: 'Nike Air Max 270 Men Running Shoes', brand: undefined });
    const highOverlap = makeCanonical({ title: 'Nike Air Max 270 Men Running Shoes Blue', brand: undefined });
    const lowOverlap = makeCanonical({ title: 'Adidas Ultraboost Women Yoga Pants', brand: undefined });
    const result = buildRecommendations(source, [highOverlap, lowOverlap]);

    const highScore = result.similar.find(s => s.product.id === highOverlap.id)?.score ?? 0;
    const lowScore = result.similar.find(s => s.product.id === lowOverlap.id)?.score ?? 0;
    expect(highScore).toBeGreaterThan(lowScore);
  });
});

// ─── useRecommendations hook ──────────────────────────────────────────────────

vi.mock('../../src/services/api', () => ({
  default: { get: vi.fn() },
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecommendations, _recCache } from '../../src/hooks/useRecommendations';
import api from '../../src/services/api';

const mockGet = (api as any).get as ReturnType<typeof vi.fn>;

function makeApiResponse() {
  const product = makeCanonical();
  return {
    similar:      [{ product, score: 80, type: 'similar', reason: 'Similar product' }],
    betterDeal:   [{ product, score: 70, type: 'better_deal', reason: 'Save 1,000' }],
    popular:      [{ product, score: 60, type: 'popular', reason: 'Trending deal' }],
    priceDropped: [{ product, score: 50, type: 'price_dropped', reason: '20% price drop' }],
    premium:      [{ product, score: 40, type: 'premium', reason: '4.8★ rated' }],
    budget:       [{ product, score: 30, type: 'budget', reason: '30% cheaper' }],
  };
}

describe('useRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _recCache.clear();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useRecommendations());
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('fetches and populates all sections on success', async () => {
    mockGet.mockResolvedValueOnce({ data: makeApiResponse() });

    const { result } = renderHook(() => useRecommendations());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.data?.similar).toHaveLength(1);
    expect(result.current.data?.betterDeal).toHaveLength(1);
    expect(result.current.data?.popular).toHaveLength(1);
    expect(result.current.data?.priceDropped).toHaveLength(1);
    expect(result.current.data?.premium).toHaveLength(1);
    expect(result.current.data?.budget).toHaveLength(1);
  });

  it('sets status to empty when all sections are empty', async () => {
    mockGet.mockResolvedValueOnce({ data: {
      similar: [], betterDeal: [], popular: [], priceDropped: [], premium: [], budget: [],
    }});

    const { result } = renderHook(() => useRecommendations());
    await act(async () => { result.current.fetch('canon_empty'); });
    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('sets status to error on network failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRecommendations());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('serves cached result on second fetch — no extra API calls', async () => {
    mockGet.mockResolvedValueOnce({ data: makeApiResponse() });

    const { result } = renderHook(() => useRecommendations());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    const callsBefore = mockGet.mock.calls.length;
    await act(async () => { result.current.fetch('canon_abc'); });
    expect(mockGet.mock.calls.length).toBe(callsBefore);
  });

  it('handles missing sections gracefully (defaults to empty arrays)', async () => {
    mockGet.mockResolvedValueOnce({ data: { similar: [{ product: makeCanonical(), score: 80, type: 'similar', reason: 'x' }] } });

    const { result } = renderHook(() => useRecommendations());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.data?.betterDeal).toEqual([]);
    expect(result.current.data?.popular).toEqual([]);
  });

  it('sets loading state while fetching', () => {
    let resolve!: (v: unknown) => void;
    mockGet.mockReturnValueOnce(new Promise(r => { resolve = r; }));

    const { result } = renderHook(() => useRecommendations());
    act(() => { result.current.fetch('canon_abc'); });
    expect(result.current.status).toBe('loading');
    resolve({ data: makeApiResponse() });
  });

  it('ignores stale response when id changes mid-flight', async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstPending = new Promise(r => { resolveFirst = r; });
    const secondResponse = makeApiResponse();
    secondResponse.similar[0].reason = 'Second result';

    mockGet
      .mockReturnValueOnce(firstPending)
      .mockResolvedValueOnce({ data: secondResponse });

    const { result } = renderHook(() => useRecommendations());
    act(() => { result.current.fetch('canon_first'); });
    await act(async () => { result.current.fetch('canon_second'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    resolveFirst({ data: makeApiResponse() });
    await new Promise(r => setTimeout(r, 50));

    expect(result.current.data?.similar[0]?.reason).toBe('Second result');
  });

  // Accessibility — data shape for aria-label
  it('each scored product has a reason string for aria labels', async () => {
    mockGet.mockResolvedValueOnce({ data: makeApiResponse() });

    const { result } = renderHook(() => useRecommendations());
    await act(async () => { result.current.fetch('canon_abc'); });
    await waitFor(() => expect(result.current.status).toBe('success'));

    for (const section of Object.values(result.current.data!)) {
      for (const item of section) {
        expect(typeof item.reason).toBe('string');
        expect(item.reason.length).toBeGreaterThan(0);
      }
    }
  });
});
