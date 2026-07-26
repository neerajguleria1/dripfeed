/**
 * tests/unit/formatPriceConsolidation.test.ts
 *
 * Regression test for price formatter consolidation.
 *
 * Before: Three separate formatters existed:
 *   - src/utils/formatPrice.ts  — formatPrice, calculateDiscount, formatSavings
 *   - src/utils/format.ts       — formatINR, discountPercent (duplicate logic)
 *   - SearchPage.tsx            — inline function formatPrice (third duplicate)
 *
 * After: All logic lives in formatPrice.ts.
 *   - format.ts is a pure re-export shim (backward compat)
 *   - formatINR is an alias for formatPrice
 *   - discountPercent is a backward-compat alias with null-return semantics
 *   - SearchPage.tsx imports from formatPrice.ts
 *
 * This test verifies:
 *   1. formatPrice and formatINR produce identical output.
 *   2. Both handle edge cases: 0, negative, non-finite.
 *   3. discountPercent returns null when no discount (original format.ts contract).
 *   4. calculateDiscount returns 0 when no discount (formatPrice.ts contract).
 *   5. Both are importable from their respective canonical paths.
 */

import { describe, it, expect } from 'vitest';
import { formatPrice, formatINR, calculateDiscount, discountPercent, formatSavings } from '../../src/utils/formatPrice';
import { formatINR as formatINRFromFormat, discountPercent as discountPercentFromFormat } from '../../src/utils/format';

// ─── formatPrice / formatINR identity ────────────────────────────────────────

describe('formatPrice and formatINR produce identical output', () => {
  const cases: [number, string][] = [
    [0,       '₹0'],
    [100,     '₹100'],
    [999,     '₹999'],
    [1000,    '₹1,000'],
    [10000,   '₹10,000'],
    [100000,  '₹1,00,000'],
    [1499.9,  '₹1,500'],   // rounds
    [1499.4,  '₹1,499'],   // rounds
  ];

  for (const [input, expected] of cases) {
    it(`formatPrice(${input}) === "${expected}"`, () => {
      expect(formatPrice(input)).toBe(expected);
    });
    it(`formatINR(${input}) === "${expected}" (alias equality)`, () => {
      expect(formatINR(input)).toBe(formatPrice(input));
    });
  }
});

describe('formatPrice edge cases', () => {
  it('returns ₹0 for negative values', () => {
    expect(formatPrice(-500)).toBe('₹0');
  });
  it('returns ₹0 for NaN', () => {
    expect(formatPrice(NaN)).toBe('₹0');
  });
  it('returns ₹0 for Infinity', () => {
    expect(formatPrice(Infinity)).toBe('₹0');
  });
});

// ─── formatINR from format.ts re-export ──────────────────────────────────────

describe('format.ts re-exports are identical to formatPrice.ts exports', () => {
  it('formatINR from format.ts === formatINR from formatPrice.ts', () => {
    expect(formatINRFromFormat).toBe(formatINR);
  });

  it('discountPercent from format.ts === discountPercent from formatPrice.ts', () => {
    expect(discountPercentFromFormat).toBe(discountPercent);
  });
});

// ─── discountPercent (backward-compat, null-returning) ───────────────────────

describe('discountPercent — backward compat with original format.ts contract', () => {
  it('returns null when no discount (original = current)', () => {
    expect(discountPercent(1000, 1000)).toBeNull();
  });
  it('returns null when original < current (price went up)', () => {
    expect(discountPercent(500, 1000)).toBeNull();
  });
  it('returns null when original is 0', () => {
    expect(discountPercent(0, 100)).toBeNull();
  });
  it('returns correct percentage for 50% discount', () => {
    expect(discountPercent(1000, 500)).toBe(50);
  });
  it('returns correct percentage for 33% discount', () => {
    expect(discountPercent(3000, 2000)).toBe(33);
  });
});

// ─── calculateDiscount (0-returning, formatPrice.ts contract) ────────────────

describe('calculateDiscount — formatPrice.ts contract', () => {
  it('returns 0 when no discount', () => {
    expect(calculateDiscount(1000, 1000)).toBe(0);
  });
  it('returns 0 when price went up', () => {
    expect(calculateDiscount(500, 1000)).toBe(0);
  });
  it('returns correct percentage for 50% off', () => {
    expect(calculateDiscount(1000, 500)).toBe(50);
  });
});

// ─── formatSavings ────────────────────────────────────────────────────────────

describe('formatSavings', () => {
  it('returns empty string when no savings', () => {
    expect(formatSavings(500, 500)).toBe('');
    expect(formatSavings(500, 600)).toBe('');
  });
  it('returns formatted savings string', () => {
    const result = formatSavings(1000, 500);
    expect(result).toContain('₹500');
    expect(result).toContain('50%');
  });
});
