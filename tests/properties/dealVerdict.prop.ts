/**
 * Property-based tests for the Deal Verdict Engine (analyzeDeal).
 *
 * Properties 1–9 verify the pure classification logic.
 * Each fc.assert runs a minimum of 100 iterations (fast-check default).
 *
 * Validates: Requirements 1.1-1.9, 2.1-2.5, 7.1-7.6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { analyzeDeal } from '../../src/utils/dealVerdict';
import { formatPrice } from '../../src/utils/formatPrice';
import type { PriceStats } from '../../src/hooks/usePriceHistory';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates a valid PriceStats object where lowestPrice <= highestPrice.
 */
const priceStatsArb: fc.Arbitrary<PriceStats> = fc
  .tuple(
    fc.integer({ min: 1, max: 50000 }),
    fc.integer({ min: 1, max: 50000 }),
  )
  .map(([a, b]) => {
    const lowestPrice = Math.min(a, b);
    const highestPrice = Math.max(a, b);
    return {
      lowestPrice,
      highestPrice,
      latestPrice: lowestPrice,
      firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastUpdated: new Date().toISOString(),
    };
  });

const validVerdictCodes = new Set(['genuine', 'inflated_mrp', 'suspicious', 'insufficient_data']);

// ─── Properties ───────────────────────────────────────────────────────────────

describe('analyzeDeal — Property-Based Tests', () => {

  // Feature: fake-discount-detector, Property 1: Insufficient data always wins
  it('P1 — snapshotCount < 3 always returns insufficient_data regardless of prices', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),          // snapshotCount < 3
        fc.integer({ min: 1, max: 100000 }),      // currentPrice
        fc.option(fc.integer({ min: 1, max: 200000 }), { nil: undefined }), // platformOriginalPrice
        priceStatsArb,
        (snapshotCount, currentPrice, platformOriginalPrice, stats) => {
          const result = analyzeDeal(currentPrice, platformOriginalPrice, stats, snapshotCount);
          expect(result).not.toBeNull();
          expect(result!.verdict).toBe('insufficient_data');
        },
      ),
    );
  });

  // Feature: fake-discount-detector, Property 2: Genuine deal classification
  it('P2 — currentPrice within 5% of lowestPrice with snapshotCount >= 3 returns genuine', () => {
    fc.assert(
      fc.property(
        priceStatsArb,
        fc.integer({ min: 3, max: 100 }),         // snapshotCount >= 3
        (stats, snapshotCount) => {
          // currentPrice at or below lowestPrice * 1.05
          const currentPrice = Math.floor(stats.lowestPrice * 1.05);
          if (currentPrice <= 0) return; // skip degenerate case
          const result = analyzeDeal(currentPrice, undefined, stats, snapshotCount);
          expect(result).not.toBeNull();
          expect(result!.verdict).toBe('genuine');
        },
      ),
    );
  });

  // Feature: fake-discount-detector, Property 3: Inflated MRP classification
  it('P3 — platformOriginalPrice > highestPrice * 1.5 with snapshotCount >= 3 and non-genuine price returns inflated_mrp', () => {
    fc.assert(
      fc.property(
        priceStatsArb,
        fc.integer({ min: 3, max: 100 }),
        (stats, snapshotCount) => {
          // currentPrice strictly above genuine threshold
          const currentPrice = Math.ceil(stats.lowestPrice * 1.06);
          // platformOriginalPrice strictly above inflated threshold
          const platformOriginalPrice = Math.ceil(stats.highestPrice * 1.51);
          if (currentPrice <= 0 || platformOriginalPrice <= 0) return;
          const result = analyzeDeal(currentPrice, platformOriginalPrice, stats, snapshotCount);
          expect(result).not.toBeNull();
          expect(result!.verdict).toBe('inflated_mrp');
        },
      ),
    );
  });

  // Feature: fake-discount-detector, Property 4: Suspicious classification
  it('P4 — price 30%+ above historical low, not genuine, not inflated, with a claimed discount, returns suspicious', () => {
    fc.assert(
      fc.property(
        priceStatsArb,
        fc.integer({ min: 3, max: 100 }),
        (stats, snapshotCount) => {
          // currentPrice above suspicious threshold, above genuine threshold
          const currentPrice = Math.ceil(stats.lowestPrice * 1.31);
          // platformOriginalPrice above currentPrice but NOT above inflated threshold
          const platformOriginalPrice = Math.ceil(stats.highestPrice * 1.4);
          // Guard: platformOriginalPrice must be > currentPrice for suspicious to trigger
          if (platformOriginalPrice <= currentPrice) return;
          // Guard: must not be inflated_mrp
          if (platformOriginalPrice > stats.highestPrice * 1.5) return;
          // Guard: must not be genuine
          if (currentPrice <= stats.lowestPrice * 1.05) return;
          if (currentPrice <= 0 || platformOriginalPrice <= 0) return;
          const result = analyzeDeal(currentPrice, platformOriginalPrice, stats, snapshotCount);
          expect(result).not.toBeNull();
          expect(result!.verdict).toBe('suspicious');
        },
      ),
    );
  });

  // Feature: fake-discount-detector, Property 5: Output is always a valid verdict or null
  it('P5 — for any inputs, result is null or has a valid verdict code', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.option(fc.integer({ min: 1, max: 200000 }), { nil: undefined }),
        priceStatsArb,
        fc.integer({ min: 0, max: 200 }),
        (currentPrice, platformOriginalPrice, stats, snapshotCount) => {
          const result = analyzeDeal(currentPrice, platformOriginalPrice, stats, snapshotCount);
          if (result === null) return; // null is always valid
          expect(validVerdictCodes.has(result.verdict)).toBe(true);
        },
      ),
    );
  });

  // Feature: fake-discount-detector, Property 6: saving is always >= 0
  it('P6 — saving is always non-negative for any non-null verdict', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.option(fc.integer({ min: 1, max: 200000 }), { nil: undefined }),
        priceStatsArb,
        fc.integer({ min: 0, max: 200 }),
        (currentPrice, platformOriginalPrice, stats, snapshotCount) => {
          const result = analyzeDeal(currentPrice, platformOriginalPrice, stats, snapshotCount);
          if (result === null) return;
          expect(result.saving).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });

  // Feature: fake-discount-detector, Property 7: saving matches expected arithmetic
  it('P7 — saving equals max(0, platformOriginalPrice - currentPrice) when defined', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.option(fc.integer({ min: 1, max: 200000 }), { nil: undefined }),
        priceStatsArb,
        fc.integer({ min: 0, max: 200 }),
        (currentPrice, platformOriginalPrice, stats, snapshotCount) => {
          const result = analyzeDeal(currentPrice, platformOriginalPrice, stats, snapshotCount);
          // insufficient_data always has saving=0 by spec; skip arithmetic check for it
          if (result === null || result.verdict === 'insufficient_data') return;
          const expectedSaving =
            platformOriginalPrice !== undefined && platformOriginalPrice > currentPrice
              ? platformOriginalPrice - currentPrice
              : 0;
          expect(result.saving).toBe(Math.max(0, expectedSaving));
        },
      ),
    );
  });

  // Feature: fake-discount-detector, Property 8: inflated_mrp detail string embeds both prices
  it('P8 — inflated_mrp detail contains platformOriginalPrice and highestPrice values', () => {
    fc.assert(
      fc.property(
        priceStatsArb,
        fc.integer({ min: 3, max: 100 }),
        (stats, snapshotCount) => {
          const currentPrice = Math.ceil(stats.lowestPrice * 1.06);
          const platformOriginalPrice = Math.ceil(stats.highestPrice * 1.51);
          if (currentPrice <= 0 || platformOriginalPrice <= 0) return;
          const result = analyzeDeal(currentPrice, platformOriginalPrice, stats, snapshotCount);
          if (!result || result.verdict !== 'inflated_mrp') return;
          // Detail must mention the original price value — using formatPrice to match engine output
          expect(result.detail).toContain(formatPrice(platformOriginalPrice).replace('₹', ''));
          // Detail must mention the highest recorded price value
          expect(result.detail).toContain(formatPrice(stats.highestPrice).replace('₹', ''));
        },
      ),
    );
  });

  // Feature: fake-discount-detector, Property 9: suspicious detail string embeds lowestPrice
  it('P9 — suspicious detail contains lowestPrice value', () => {
    fc.assert(
      fc.property(
        priceStatsArb,
        fc.integer({ min: 3, max: 100 }),
        (stats, snapshotCount) => {
          const currentPrice = Math.ceil(stats.lowestPrice * 1.31);
          const platformOriginalPrice = Math.ceil(stats.highestPrice * 1.4);
          if (platformOriginalPrice <= currentPrice) return;
          if (platformOriginalPrice > stats.highestPrice * 1.5) return;
          if (currentPrice <= stats.lowestPrice * 1.05) return;
          if (currentPrice <= 0 || platformOriginalPrice <= 0) return;
          const result = analyzeDeal(currentPrice, platformOriginalPrice, stats, snapshotCount);
          if (!result || result.verdict !== 'suspicious') return;
          expect(result.detail).toContain(formatPrice(stats.lowestPrice).replace('₹', ''));
        },
      ),
    );
  });

});
