/**
 * Property 1: INR Price Formatting
 * Validates: Requirement 1.7
 *
 * For any positive finite number, formatPrice must:
 * - Return a string starting with ₹
 * - Use Indian grouping (lakhs/crores, not millions)
 * - Round to nearest integer (no decimals)
 * - Return ₹0 for negative/NaN/Infinity
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatPrice, calculateDiscount, formatSavings } from '../../src/utils/formatPrice';

describe('Property 1: INR Price Formatting', () => {
  it('always starts with ₹ symbol for any positive number', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1e9, noNaN: true }), (amount) => {
        const result = formatPrice(amount);
        expect(result).toMatch(/^₹/);
      }),
    );
  });

  it('never contains decimals (always rounds to integer)', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1e9, noNaN: true }), (amount) => {
        const result = formatPrice(amount);
        // After ₹ and removing commas, should be a pure integer
        const numericPart = result.slice(1).replace(/,/g, '');
        expect(Number.isInteger(Number(numericPart))).toBe(true);
      }),
    );
  });

  it('uses Indian grouping (first group of 3, then groups of 2)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 100000, max: 999999999 }), (amount) => {
        const result = formatPrice(amount);
        const numericPart = result.slice(1); // Remove ₹
        // Indian format: last group is 3 digits, preceding groups are 2 digits
        // e.g., 1,00,000 or 10,00,000 or 1,00,00,000
        const parts = numericPart.split(',');
        // Last group should be exactly 3 digits
        expect(parts[parts.length - 1]).toHaveLength(3);
        // All other groups should be 1-2 digits (first can be 1-2, middle must be 2)
        if (parts.length > 2) {
          for (let i = 1; i < parts.length - 1; i++) {
            expect(parts[i]).toHaveLength(2);
          }
        }
      }),
    );
  });

  it('returns ₹0 for negative numbers', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000000, max: -1 }), (amount) => {
        expect(formatPrice(amount)).toBe('₹0');
      }),
    );
  });

  it('returns ₹0 for NaN and Infinity', () => {
    expect(formatPrice(NaN)).toBe('₹0');
    expect(formatPrice(Infinity)).toBe('₹0');
    expect(formatPrice(-Infinity)).toBe('₹0');
  });
});

describe('Property 19: Price Drop Percentage Calculation', () => {
  it('discount is always 0-100 for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        (original, current) => {
          const discount = calculateDiscount(original, current);
          expect(discount).toBeGreaterThanOrEqual(0);
          expect(discount).toBeLessThanOrEqual(100);
        },
      ),
    );
  });

  it('discount is 0 when current >= original', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        (base, extra) => {
          const original = base;
          const current = base + extra; // current >= original
          expect(calculateDiscount(original, current)).toBe(0);
        },
      ),
    );
  });

  it('discount is proportional: (original - current) / original * 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 100000 }),
        fc.integer({ min: 1, max: 99 }),
        (original, percentDrop) => {
          const current = Math.round(original * (1 - percentDrop / 100));
          const discount = calculateDiscount(original, current);
          // Should be within 1% of expected due to rounding
          expect(Math.abs(discount - percentDrop)).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it('formatSavings returns empty string when no savings', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), (price) => {
        expect(formatSavings(price, price)).toBe('');
        expect(formatSavings(price, price + 100)).toBe('');
      }),
    );
  });

  it('formatSavings includes ₹ amount and percentage for valid drops', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100000 }),
        fc.integer({ min: 10, max: 90 }),
        (original, percentDrop) => {
          const current = Math.round(original * (1 - percentDrop / 100));
          const result = formatSavings(original, current);
          expect(result).toContain('Save ₹');
          expect(result).toContain('% off');
        },
      ),
    );
  });
});
