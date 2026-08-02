/**
 * Discount computation utilities for TagCheck.
 * Provides discount percentage calculation and price extraction helpers
 * for multi-platform product offers.
 *
 * Requirements: 4.6, 4.8
 */

import type { PlatformOffer } from './validateProduct';

// ─── Main Discount Calculation ───

/**
 * Computes the discount percentage as a whole number (floored).
 *
 * Formula: Math.floor((highestOriginalPrice - lowestCurrentPrice) / highestOriginalPrice * 100)
 *
 * Returns `undefined` when:
 * - highestOriginalPrice is 0 or undefined/NaN
 * - highestOriginalPrice <= lowestCurrentPrice (no real discount)
 *
 * @param lowestCurrentPrice - The lowest current price across all platform offers
 * @param highestOriginalPrice - The highest original (MRP) price across all platform offers
 * @returns Discount percentage as a whole number (0–99), or undefined if not applicable
 */
export function computeDiscountPercent(
  lowestCurrentPrice: number,
  highestOriginalPrice: number
): number | undefined {
  // Guard: highestOriginalPrice must be a positive, finite number
  if (
    highestOriginalPrice === undefined ||
    highestOriginalPrice === null ||
    !Number.isFinite(highestOriginalPrice) ||
    highestOriginalPrice <= 0
  ) {
    return undefined;
  }

  // Guard: lowestCurrentPrice must be a finite number
  if (!Number.isFinite(lowestCurrentPrice)) {
    return undefined;
  }

  // No discount if original price is not greater than current price
  if (highestOriginalPrice <= lowestCurrentPrice) {
    return undefined;
  }

  return Math.floor(
    ((highestOriginalPrice - lowestCurrentPrice) / highestOriginalPrice) * 100
  );
}

// ─── Price Extraction Helpers ───

/**
 * Extracts the lowest current price from an array of platform offers.
 * Only considers offers with positive, finite prices.
 *
 * @param offers - Array of PlatformOffer objects
 * @returns The lowest price, or undefined if no valid prices exist
 */
export function computeLowestPrice(offers: PlatformOffer[]): number | undefined {
  if (!Array.isArray(offers) || offers.length === 0) return undefined;

  const validPrices = offers
    .map((o) => o.price)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0);

  if (validPrices.length === 0) return undefined;

  return Math.min(...validPrices);
}

/**
 * Extracts the highest original price from an array of platform offers.
 * Only considers offers that have a defined, positive originalPrice.
 *
 * @param offers - Array of PlatformOffer objects
 * @returns The highest original price, or undefined if no valid original prices exist
 */
export function computeHighestPrice(offers: PlatformOffer[]): number | undefined {
  if (!Array.isArray(offers) || offers.length === 0) return undefined;

  const validOriginalPrices = offers
    .map((o) => o.originalPrice)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0);

  if (validOriginalPrices.length === 0) return undefined;

  return Math.max(...validOriginalPrices);
}
