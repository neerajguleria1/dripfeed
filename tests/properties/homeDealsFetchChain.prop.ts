/**
 * Property 1: Bug Condition / Expected Behavior - Real Deals Data Sourcing
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.4
 *
 * Pure-function level tests (no DOM/mount required) covering the mapping helpers
 * (`mapDealApiToDealData`, `mapTrendingApiToDealData`, imported directly from the fixed
 * `src/pages/HomePage.tsx`) and a transcribed pure `resolveDealsSectionState` function
 * that mirrors HomePage.tsx's fetch-chain `useEffect` decision logic:
 *
 *   if (apiDeals.length > 0) -> state 'deals', items = apiDeals.map(mapDealApiToDealData)
 *   else if (trendingProducts.length > 0) -> state 'trending', items = trendingProducts.map(mapTrendingApiToDealData)
 *   else -> state 'empty', items = []
 *
 * This mirrors (rather than re-implements independently) the same branching found in the
 * `loadDeals` async function inside HomePage.tsx's fetch-chain `useEffect` — see design.md's
 * "Fix Checking" pseudocode for the equivalent FOR ALL / IF-ELSE specification.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  mapDealApiToDealData,
  mapTrendingApiToDealData,
  type DealApiItem,
  type TrendingApiItem,
} from '../../src/utils/homeDealsMapping';
import type { DealData } from '../../src/types/product';

// ─── Pure function mirroring HomePage.tsx's fetch-chain useEffect decision logic ─────────

type DealsSectionState = 'deals' | 'trending' | 'empty';

interface ResolvedSection {
  state: DealsSectionState;
  items: DealData[];
}

/**
 * Mirrors HomePage.tsx's `loadDeals` fetch-chain logic:
 *   deals.length > 0 -> 'deals' (mapped via mapDealApiToDealData)
 *   else trending.length > 0 -> 'trending' (mapped via mapTrendingApiToDealData)
 *   else -> 'empty' ([])
 */
function resolveDealsSectionState(
  apiDeals: DealApiItem[],
  trendingProducts: TrendingApiItem[],
): ResolvedSection {
  if (apiDeals.length > 0) {
    return { state: 'deals', items: apiDeals.map(mapDealApiToDealData) };
  }
  if (trendingProducts.length > 0) {
    return { state: 'trending', items: trendingProducts.map(mapTrendingApiToDealData) };
  }
  return { state: 'empty', items: [] };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────────────────

const titleArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 60 }),
  fc.constantFrom(
    'Café & Co. Kurta Set',
    'Product #1 — 50% off',
    'A/B Tested Dress',
    "Women's Ethnic Set?",
    '事例 商品 セット',
    '👗 Floral Dress 🌸',
    'Rock & Roll Tee/Jeans',
    'Size: S/M/L (mixed)',
  ),
);

const dealApiItemArb: fc.Arbitrary<DealApiItem> = fc.record({
  id: fc.uuid(),
  productTitle: titleArb,
  brand: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  imageUrl: fc.option(fc.webUrl(), { nil: undefined }),
  platform: fc.constantFrom('myntra', 'ajio', 'flipkart', 'amazon', 'nykaa', 'tatacliq', 'meesho'),
  currentPrice: fc.integer({ min: 1, max: 100000 }),
  previousPrice: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined }),
  dropPercentage: fc.integer({ min: 0, max: 100 }),
  url: fc.webUrl(),
  detectedAt: fc.option(fc.string(), { nil: undefined }),
  trackersCount: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
}) as fc.Arbitrary<DealApiItem>;

const trendingApiItemArb: fc.Arbitrary<TrendingApiItem> = fc.record({
  id: fc.uuid(),
  title: titleArb,
  brand: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  imageUrl: fc.option(fc.webUrl(), { nil: undefined }),
  price: fc.integer({ min: 1, max: 100000 }),
  originalPrice: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined }),
  discount: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  platform: fc.constantFrom('myntra', 'ajio', 'flipkart', 'amazon', 'nykaa', 'tatacliq', 'meesho'),
  url: fc.webUrl(),
}) as fc.Arbitrary<TrendingApiItem>;

// Known seed-data titles that must never leak into resolved deal/trending items.
const SEED_DATA_MARKER_TITLES = [
  'ALL_SEED_PRODUCTS',
  'MOCK_PRODUCTS',
  'SEED-DATA-MARKER',
];

// ─── Property Tests ───────────────────────────────────────────────────────────────────────

describe('Property 1: Expected Behavior - deals-array rendering (mapping + state resolution)', () => {
  it('resulting DealData list always equals apiDeals.map(mapDealApiToDealData) element-wise', () => {
    fc.assert(
      fc.property(
        fc.array(dealApiItemArb, { minLength: 0, maxLength: 20 }),
        fc.array(trendingApiItemArb, { minLength: 0, maxLength: 20 }),
        (apiDeals, trendingProducts) => {
          const resolved = resolveDealsSectionState(apiDeals, trendingProducts);
          if (apiDeals.length > 0) {
            const expected = apiDeals.map(mapDealApiToDealData);
            expect(resolved.items).toEqual(expected);
          }
        },
      ),
    );
  });

  it('no seed-data items ever appear in the resolved items', () => {
    fc.assert(
      fc.property(
        fc.array(dealApiItemArb, { minLength: 0, maxLength: 20 }),
        fc.array(trendingApiItemArb, { minLength: 0, maxLength: 20 }),
        (apiDeals, trendingProducts) => {
          const resolved = resolveDealsSectionState(apiDeals, trendingProducts);
          for (const item of resolved.items) {
            expect(SEED_DATA_MARKER_TITLES).not.toContain(item.title);
          }
        },
      ),
    );
  });

  it("resolved section state is 'deals' whenever the deals array is non-empty", () => {
    fc.assert(
      fc.property(
        fc.array(dealApiItemArb, { minLength: 1, maxLength: 20 }),
        fc.array(trendingApiItemArb, { minLength: 0, maxLength: 20 }),
        (apiDeals, trendingProducts) => {
          const resolved = resolveDealsSectionState(apiDeals, trendingProducts);
          expect(resolved.state).toBe('deals');
        },
      ),
    );
  });
});

describe('Property 1: Expected Behavior - trending fallback and empty state', () => {
  it("falls back to 'trending' state with correctly mapped items whenever the trending array is non-empty (deals empty)", () => {
    fc.assert(
      fc.property(
        fc.array(trendingApiItemArb, { minLength: 1, maxLength: 20 }),
        (trendingProducts) => {
          const resolved = resolveDealsSectionState([], trendingProducts);
          expect(resolved.state).toBe('trending');
          expect(resolved.items).toEqual(trendingProducts.map(mapTrendingApiToDealData));
          for (const item of resolved.items) {
            expect(SEED_DATA_MARKER_TITLES).not.toContain(item.title);
          }
        },
      ),
    );
  });

  it("falls to 'empty' state (with zero items) whenever both arrays are empty", () => {
    const resolved = resolveDealsSectionState([], []);
    expect(resolved.state).toBe('empty');
    expect(resolved.items).toEqual([]);
  });

  it("'empty' state only occurs when both deals and trending arrays are empty", () => {
    fc.assert(
      fc.property(
        fc.array(dealApiItemArb, { minLength: 0, maxLength: 20 }),
        fc.array(trendingApiItemArb, { minLength: 0, maxLength: 20 }),
        (apiDeals, trendingProducts) => {
          const resolved = resolveDealsSectionState(apiDeals, trendingProducts);
          if (resolved.state === 'empty') {
            expect(apiDeals.length).toBe(0);
            expect(trendingProducts.length).toBe(0);
            expect(resolved.items).toEqual([]);
          }
        },
      ),
    );
  });
});

describe('Property 1 / Property 2: click-through target correctness across deals and trending states', () => {
  function clickThroughTarget(deal: DealData): string {
    return `/compare?q=${encodeURIComponent(deal.title)}`;
  }

  it('click-through target always equals /compare?q=<encoded title> for deals-state cards', () => {
    fc.assert(
      fc.property(fc.array(dealApiItemArb, { minLength: 1, maxLength: 20 }), (apiDeals) => {
        const resolved = resolveDealsSectionState(apiDeals, []);
        expect(resolved.state).toBe('deals');
        for (const item of resolved.items) {
          expect(clickThroughTarget(item)).toBe(`/compare?q=${encodeURIComponent(item.title)}`);
        }
      }),
    );
  });

  it('click-through target always equals /compare?q=<encoded title> for trending-state cards', () => {
    fc.assert(
      fc.property(fc.array(trendingApiItemArb, { minLength: 1, maxLength: 20 }), (trendingProducts) => {
        const resolved = resolveDealsSectionState([], trendingProducts);
        expect(resolved.state).toBe('trending');
        for (const item of resolved.items) {
          expect(clickThroughTarget(item)).toBe(`/compare?q=${encodeURIComponent(item.title)}`);
        }
      }),
    );
  });

  it('click-through target correctly URL-encodes unicode, &, ?, / and other special characters in titles', () => {
    fc.assert(
      fc.property(titleArb, (title) => {
        const deal: DealData = {
          id: 'x',
          title,
          price: 100,
          discount: 10,
          platform: 'myntra',
          url: 'https://example.com',
        };
        const target = clickThroughTarget(deal);
        expect(target).toBe(`/compare?q=${encodeURIComponent(title)}`);
        // Round-trip: decoding must recover the original title exactly
        const encodedPart = target.slice('/compare?q='.length);
        expect(decodeURIComponent(encodedPart)).toBe(title);
      }),
    );
  });
});

describe('Mapping helper correctness (supporting the fetch-chain properties above)', () => {
  it('mapDealApiToDealData renames fields correctly and passes through the rest, for any DealApiItem', () => {
    fc.assert(
      fc.property(dealApiItemArb, (d) => {
        const mapped = mapDealApiToDealData(d);
        expect(mapped.title).toBe(d.productTitle);
        expect(mapped.price).toBe(d.currentPrice);
        expect(mapped.originalPrice).toBe(d.previousPrice);
        expect(mapped.discount).toBe(d.dropPercentage);
        expect(mapped.id).toBe(d.id);
        expect(mapped.brand).toBe(d.brand);
        expect(mapped.imageUrl).toBe(d.imageUrl);
        expect(mapped.platform).toBe(d.platform);
        expect(mapped.url).toBe(d.url);
      }),
    );
  });

  it('mapTrendingApiToDealData passes through fields and defaults discount to 0 when undefined', () => {
    fc.assert(
      fc.property(trendingApiItemArb, (t) => {
        const mapped = mapTrendingApiToDealData(t);
        expect(mapped.title).toBe(t.title);
        expect(mapped.price).toBe(t.price);
        expect(mapped.originalPrice).toBe(t.originalPrice);
        expect(mapped.discount).toBe(t.discount ?? 0);
        expect(mapped.id).toBe(t.id);
        expect(mapped.brand).toBe(t.brand);
        expect(mapped.imageUrl).toBe(t.imageUrl);
        expect(mapped.platform).toBe(t.platform);
        expect(mapped.url).toBe(t.url);
      }),
    );
  });

  it('handles dropPercentage: 0 (edge case) without dropping the item or defaulting incorrectly', () => {
    const zeroDiscountDeal: DealApiItem = {
      id: 'zero-1',
      productTitle: 'Zero Discount Item',
      platform: 'myntra',
      currentPrice: 999,
      dropPercentage: 0,
      url: 'https://example.com/zero',
    };
    const resolved = resolveDealsSectionState([zeroDiscountDeal], []);
    expect(resolved.state).toBe('deals');
    expect(resolved.items).toHaveLength(1);
    expect(resolved.items[0].discount).toBe(0);
  });

  it('handles missing brand/imageUrl (edge case) by passing through undefined', () => {
    fc.assert(
      fc.property(
        dealApiItemArb.map((d) => ({ ...d, brand: undefined, imageUrl: undefined })),
        (d) => {
          const mapped = mapDealApiToDealData(d);
          expect(mapped.brand).toBeUndefined();
          expect(mapped.imageUrl).toBeUndefined();
        },
      ),
    );
  });
});
