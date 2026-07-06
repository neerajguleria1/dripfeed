/**
 * Property 6: Lowest-Price Listing Identification
 * Validates: Requirements 4.2, 4.3
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface PlatformListing {
  platform: string;
  price: number;
  inStock: boolean;
  deliveryDays: number;
}

const listingArb = fc.record({
  platform: fc.constantFrom('myntra', 'ajio', 'flipkart', 'amazon', 'nykaa', 'tatacliq', 'meesho', 'snapdeal'),
  price: fc.integer({ min: 100, max: 50000 }),
  inStock: fc.boolean(),
  deliveryDays: fc.integer({ min: 1, max: 14 }),
});

function findBestPrice(listings: PlatformListing[]): PlatformListing | null {
  const inStock = listings.filter((l) => l.inStock);
  if (inStock.length === 0) return null;
  return inStock.reduce((best, curr) => (curr.price < best.price ? curr : best));
}

function sortByPrice(listings: PlatformListing[]): PlatformListing[] {
  return [...listings].sort((a, b) => a.price - b.price);
}

describe('Property 6: Lowest-Price Listing Identification', () => {
  it('best price is always the minimum among in-stock listings', () => {
    fc.assert(
      fc.property(
        fc.array(listingArb, { minLength: 2, maxLength: 8 }),
        (listings) => {
          // Ensure at least one is in stock
          if (!listings.some((l) => l.inStock)) {
            listings[0].inStock = true;
          }

          const best = findBestPrice(listings);
          expect(best).not.toBeNull();

          const inStockPrices = listings.filter((l) => l.inStock).map((l) => l.price);
          expect(best!.price).toBe(Math.min(...inStockPrices));
        },
      ),
    );
  });

  it('returns null when no listings are in stock', () => {
    fc.assert(
      fc.property(
        fc.array(listingArb, { minLength: 1, maxLength: 8 }),
        (listings) => {
          // Force all out of stock
          const outOfStock = listings.map((l) => ({ ...l, inStock: false }));
          const best = findBestPrice(outOfStock);
          expect(best).toBeNull();
        },
      ),
    );
  });

  it('sorted listings have ascending price order', () => {
    fc.assert(
      fc.property(
        fc.array(listingArb, { minLength: 2, maxLength: 8 }),
        (listings) => {
          const sorted = sortByPrice(listings);
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].price).toBeLessThanOrEqual(sorted[i + 1].price);
          }
        },
      ),
    );
  });

  it('best price listing is always first in sorted order (if in stock)', () => {
    fc.assert(
      fc.property(
        fc.array(listingArb, { minLength: 2, maxLength: 8 }),
        (listings) => {
          if (!listings.some((l) => l.inStock)) {
            listings[0].inStock = true;
          }

          const best = findBestPrice(listings);
          const sorted = sortByPrice(listings.filter((l) => l.inStock));

          if (best && sorted.length > 0) {
            expect(sorted[0].price).toBe(best.price);
          }
        },
      ),
    );
  });
});
