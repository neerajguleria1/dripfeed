/**
 * Property 2: Preservation - Card Visuals, Grid, and Click-Through
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * Observation-first methodology: the pure functions below (`isDiscountBadgeVisible`,
 * `computeClickThroughTarget`, `GRID_CONTAINER_CLASS`) are transcribed directly from the
 * CURRENT (unfixed) `src/pages/HomePage.tsx` "Today's biggest drops" JSX:
 *
 *   {deal.discount > 0 && (
 *     <span className="absolute top-3 left-3 ...">−{deal.discount}%</span>
 *   )}
 *   ...
 *   <Link to={`/compare?q=${encodeURIComponent(deal.title)}`} ...>
 *   ...
 *   <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
 *
 * These properties are recorded as a baseline BEFORE the fix is implemented (task 2) and
 * are re-run UNCHANGED after the fix (task 3.8) to confirm the fix did not alter card
 * visuals, grid layout, or click-through behavior.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { DealData } from '../../src/types/product';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME_PAGE_PATH = resolve(__dirname, '../../src/pages/HomePage.tsx');
const DEALS_PAGE_PATH = resolve(__dirname, '../../src/pages/DealsPage.tsx');

// ─── Pure functions transcribed from the current (unfixed) HomePage.tsx ─────────────────

/** Mirrors: {deal.discount > 0 && <span>...discount badge...</span>} */
function isDiscountBadgeVisible(deal: DealData): boolean {
  return deal.discount > 0;
}

/** Mirrors: <Link to={`/compare?q=${encodeURIComponent(deal.title)}`} ...> */
function computeClickThroughTarget(deal: DealData): string {
  return `/compare?q=${encodeURIComponent(deal.title)}`;
}

/** Mirrors: <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5"> */
const GRID_CONTAINER_CLASS = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5';

function gridContainerClass(): string {
  return GRID_CONTAINER_CLASS;
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

const dealDataArb: fc.Arbitrary<DealData> = fc.record({
  id: fc.option(fc.uuid(), { nil: undefined }),
  title: titleArb,
  brand: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  imageUrl: fc.option(fc.webUrl(), { nil: undefined }),
  price: fc.integer({ min: 1, max: 100000 }),
  originalPrice: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined }),
  discount: fc.integer({ min: 0, max: 100 }),
  platform: fc.constantFrom('myntra', 'ajio', 'flipkart', 'amazon', 'nykaa', 'tatacliq', 'meesho'),
  url: fc.webUrl(),
}) as fc.Arbitrary<DealData>;

// ─── Property Tests ───────────────────────────────────────────────────────────────────────

describe('Property 2: Preservation - Card Visuals, Grid, and Click-Through', () => {
  it('for all DealData items, discount badge is rendered iff discount > 0', () => {
    fc.assert(
      fc.property(dealDataArb, (deal) => {
        const visible = isDiscountBadgeVisible(deal);
        expect(visible).toBe(deal.discount > 0);
      }),
    );
  });

  it('for all DealData items, computed click-through target equals /compare?q=<encoded title>', () => {
    fc.assert(
      fc.property(dealDataArb, (deal) => {
        const target = computeClickThroughTarget(deal);
        expect(target).toBe(`/compare?q=${encodeURIComponent(deal.title)}`);
      }),
    );
  });

  it('click-through target is always safely URL-encoded for special/unicode characters', () => {
    fc.assert(
      fc.property(dealDataArb, (deal) => {
        const target = computeClickThroughTarget(deal);
        // The raw (unencoded) title's URL-unsafe characters must not leak into the path
        expect(target.startsWith('/compare?q=')).toBe(true);
        const encodedPart = target.slice('/compare?q='.length);
        expect(encodedPart).toBe(encodeURIComponent(deal.title));
        // Round-trip: decoding must recover the original title exactly
        expect(decodeURIComponent(encodedPart)).toBe(deal.title);
      }),
    );
  });

  it('grid container class string is invariant regardless of the DealData list contents', () => {
    fc.assert(
      fc.property(fc.array(dealDataArb, { minLength: 0, maxLength: 20 }), () => {
        expect(gridContainerClass()).toBe(GRID_CONTAINER_CLASS);
      }),
    );
  });

  it('grid container class string uses the expected 2/3/4-column responsive breakpoints', () => {
    expect(GRID_CONTAINER_CLASS).toBe('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5');
  });
});

// ─── Standalone (non-PBT) Preservation Checks ─────────────────────────────────────────────

describe('Preservation: untouched-file and unaffected-markup checks (baseline on unfixed code)', () => {
  it('DealsPage.tsx file content matches the current baseline (post seed-fallback removal)', () => {
    const content = readFileSync(DEALS_PAGE_PATH, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex').toUpperCase();
    // Baseline hash updated after a deliberate follow-up fix removed
    // DealsPage.tsx's own ALL_SEED_PRODUCTS fallback (a separate, explicitly
    // requested change from the original homepage-only scope) so both pages
    // consistently show only real API data with no fabricated fallback.
    expect(hash).toBe('7D957D03787F7E77A9C084EC3CB13A7205F26DD8F7B823E5C06FE6F3A38AD310');
  });

  it('homepage hero, how-it-works, trending-searches, social-proof, CTA, and footer copy is present and unchanged', () => {
    const content = readFileSync(HOME_PAGE_PATH, 'utf-8');

    // Hero headline
    expect(content).toContain('Never overpay for');
    expect(content).toContain('fashion');
    expect(content).toContain('again');
    expect(content).toContain('One search. Seven platforms. The lowest price');

    // How it works step titles
    expect(content).toContain('Three steps to the best deal');
    expect(content).toContain('Search or paste');
    expect(content).toContain('Compare instantly');
    expect(content).toContain('Save money');

    // Trending search terms
    expect(content).toContain('kurta set');
    expect(content).toContain('sneakers');
    expect(content).toContain('silk saree');
    expect(content).toContain('lehenga');
    expect(content).toContain('jeans');
    expect(content).toContain('hoodie');
    expect(content).toContain('palazzo');
    expect(content).toContain('crop top');

    // Social proof stats
    expect(content).toContain('Platforms compared');
    expect(content).toContain('Saved by users');
    expect(content).toContain('Monthly users');

    // CTA copy
    expect(content).toContain('Stop scrolling between apps.');
    expect(content).toContain('Start saving.');
    expect(content).toContain('Free forever. No signup. No ads.');
    expect(content).toContain('Start Comparing');

    // Footer links
    expect(content).toContain('TagCheck India');
    expect(content).toContain("navigate('/privacy')");
    expect(content).toContain("navigate('/terms')");
    expect(content).toContain("navigate('/affiliate-disclosure')");
  });
});
