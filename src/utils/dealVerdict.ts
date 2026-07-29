/**
 * dealVerdict.ts — pure client-side deal classification engine.
 *
 * Exposes `analyzeDeal()` which classifies a product offer into one of four
 * verdict states based on real price history stored in TagCheck's database.
 * This exposes fake discounts where platforms inflate MRP to make deals look
 * bigger than they really are.
 *
 * No side effects, no I/O, no React — pure function only.
 * Designed to be called with PriceStats already fetched by usePriceHistory.
 */

import { formatPrice } from './formatPrice';
import type { PriceStats } from '../hooks/usePriceHistory';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerdictCode =
  | 'genuine'
  | 'inflated_mrp'
  | 'suspicious'
  | 'insufficient_data';

export interface DealVerdict {
  /** Classification of the deal */
  verdict: VerdictCode;
  /** Short emoji + label for the badge, e.g. "🟢 Genuine Deal" */
  badge: string;
  /** Longer contextual sentence explaining the verdict */
  detail: string;
  /** platformOriginalPrice − currentPrice, floored at 0 (in rupees) */
  saving: number;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** currentPrice must be within this multiplier of historical low to be "genuine" */
const GENUINE_THRESHOLD = 1.05;

/** platformOriginalPrice must exceed historical high by this multiplier to flag as inflated MRP */
const INFLATED_MRP_THRESHOLD = 1.5;

/** currentPrice must exceed historical low by this multiplier AND platform claims a discount to flag as suspicious */
const SUSPICIOUS_THRESHOLD = 1.30;

/** Minimum number of historical price snapshots required before any verdict (other than insufficient_data) */
const MIN_SNAPSHOT_COUNT = 3;

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Classify a product offer based on its current price, the platform's claimed
 * original price (MRP), and TagCheck's real price history stats.
 *
 * Priority evaluation order (first match wins):
 *   1. insufficient_data — fewer than MIN_SNAPSHOT_COUNT history points
 *   2. genuine           — current price within 5% of all-time historical low
 *   3. inflated_mrp      — platform MRP > 1.5× historical high (fabricated MRP)
 *   4. suspicious        — price is 30%+ above historical low while claiming a discount
 *   5. null              — no notable verdict (neutral)
 *
 * @param currentPrice          The selling price shown by the platform right now (INR)
 * @param platformOriginalPrice The MRP / "original price" the platform displays crossed out
 * @param stats                 Price history aggregate stats from usePriceHistory
 * @param snapshotCount         Number of price history data points (points.length from usePriceHistory)
 * @returns DealVerdict or null if no verdict applies
 */
export function analyzeDeal(
  currentPrice: number,
  platformOriginalPrice: number | undefined,
  stats: PriceStats,
  snapshotCount: number,
): DealVerdict | null {

  // Compute saving upfront — used by all verdict branches
  const saving = (
    platformOriginalPrice !== undefined && platformOriginalPrice > currentPrice
  )
    ? platformOriginalPrice - currentPrice
    : 0;

  // Priority 1: Not enough data to make a reliable verdict
  if (snapshotCount < MIN_SNAPSHOT_COUNT) {
    return {
      verdict: 'insufficient_data',
      badge: '⏳ Not Enough Data',
      detail: 'Less than 3 price records available',
      saving: 0,
    };
  }

  // Priority 2: Genuine deal — current price is at or near the historical low
  if (currentPrice <= stats.lowestPrice * GENUINE_THRESHOLD) {
    return {
      verdict: 'genuine',
      badge: '🟢 Genuine Deal',
      detail: 'Lowest price in 30 days',
      saving,
    };
  }

  // Priority 3: Inflated MRP — platform's "original price" was never close to reality
  if (
    platformOriginalPrice !== undefined &&
    platformOriginalPrice > stats.highestPrice * INFLATED_MRP_THRESHOLD
  ) {
    return {
      verdict: 'inflated_mrp',
      badge: '🔴 Suspicious Discount',
      detail: `Platform claims ${formatPrice(platformOriginalPrice)} MRP, but highest recorded price was ${formatPrice(stats.highestPrice)}`,
      saving,
    };
  }

  // Priority 4: Suspicious — price is significantly above historical low while claiming discount
  if (
    currentPrice > stats.lowestPrice * SUSPICIOUS_THRESHOLD &&
    platformOriginalPrice !== undefined &&
    platformOriginalPrice > currentPrice
  ) {
    return {
      verdict: 'suspicious',
      badge: '⚠️ Price Increased Before Sale',
      detail: `Was cheaper — lowest recorded: ${formatPrice(stats.lowestPrice)}`,
      saving,
    };
  }

  // No verdict — neutral, don't show a badge
  return null;
}
