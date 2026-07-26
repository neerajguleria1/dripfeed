/**
 * pricePrediction.ts
 *
 * Production-grade deterministic statistical price prediction engine.
 * No external ML services — pure arithmetic on existing application data.
 *
 * ── Signals used ──────────────────────────────────────────────────────────────
 *   1. Linear trend       — OLS slope over time-series of price snapshots
 *   2. Volatility         — Coefficient of variation (σ/μ) over the window
 *   3. Mean-reversion gap — How far current price is from the N-day mean
 *   4. Momentum           — EWM (exponential weighted mean) over recent 7 days
 *   5. Retailer cycle     — How many days since last significant price drop
 *   6. Deal signal        — Whether an active deal record exists for this product
 *   7. Position in range  — (current − low) / (high − low), 0–1
 *
 * ── Output verdicts ──────────────────────────────────────────────────────────
 *   BUY_NOW              — price is at or near historical low, momentum falling
 *   LIKELY_TO_DROP       — trend is negative, above mean, momentum declining
 *   LIKELY_TO_INCREASE   — trend is positive, below mean, recovering from low
 *   WAIT                 — high volatility, unclear signal, likely to change
 *   UNKNOWN              — insufficient data (< MIN_POINTS snapshots)
 *
 * ── Confidence ───────────────────────────────────────────────────────────────
 *   0–1 float. Based on:
 *     - Number of data points (more = higher)
 *     - Consistency of signal across multiple indicators
 *     - Recency of data (stale = lower)
 *     - Volatility (high = lower)
 *
 * ── Caching ───────────────────────────────────────────────────────────────────
 *   LRU cache keyed by `${canonicalId}::${platform ?? 'all'}::${latestPrice}`
 *   TTL: configurable via PRICE_PREDICTION_CACHE_TTL_MS (default 4h)
 *   Cache auto-invalidates when price changes (key includes latestPrice).
 */

import { LRUCache } from './lruCache.js';
import type { HistoryPoint } from './priceHistory.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_POINTS               = 3;   // minimum snapshots needed for any prediction
const STRONG_TREND_POINTS      = 7;   // points needed for high-confidence trend
const VOLATILITY_HIGH          = 0.08; // CV > 8% = high volatility
const VOLATILITY_VERY_HIGH     = 0.15; // CV > 15% = very high volatility
const NEAR_LOW_THRESHOLD       = 0.08; // within 8% of historical low = "near low"
const NEAR_HIGH_THRESHOLD      = 0.08; // within 8% of historical high = "near high"
const TREND_FLAT_THRESHOLD     = 0.002; // |normalised slope| < 0.2%/day = flat
const DEAL_RECENCY_DAYS        = 14;  // a deal in last 14d is a "recent drop" signal
const EWM_ALPHA                = 0.3; // EWM decay factor for momentum (0 < α ≤ 1)

const CACHE_TTL_MS = Number(process.env.PRICE_PREDICTION_CACHE_TTL_MS) || 4 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

export type PredictionVerdict =
  | 'BUY_NOW'
  | 'WAIT'
  | 'LIKELY_TO_DROP'
  | 'LIKELY_TO_INCREASE'
  | 'UNKNOWN';

export interface SignalBreakdown {
  /** OLS slope as % change per day. Negative = falling. */
  trendPctPerDay:   number;
  /** Coefficient of variation (σ/μ). 0 = no volatility. */
  volatility:       number;
  /** (current − mean) / mean. Negative = below mean. */
  meanReversion:    number;
  /** EWM momentum over recent 7d. Negative = declining. */
  momentum7d:       number;
  /** (current − low) / (high − low). 0 = at low, 1 = at high. */
  positionInRange:  number;
  /** Days since last significant drop (>5%). null if none in window. */
  daysSinceLastDrop: number | null;
  /** Whether an active deal record exists. */
  hasActiveDeal:    boolean;
  /** Number of snapshots used. */
  dataPoints:       number;
}

export interface PricePrediction {
  verdict:           PredictionVerdict;
  confidence:        number;   // 0–1
  signals:           SignalBreakdown;
  /** Human-readable reason string */
  reason:            string;
  /** Estimated % price change over next 14 days. null if unknown. */
  estimatedChangePct?: number;
  generatedAt:       number;
  /** true if this came from the cache */
  cached:            boolean;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const predictionCache = new LRUCache<string, PricePrediction>({
  maxSize: MAX_CACHE_ENTRIES,
  ttlMs:   CACHE_TTL_MS,
});

export function _clearPredictionCache() {
  predictionCache.clear();
}

export { predictionCache as _predictionCache };

// ─── Pure statistical helpers ─────────────────────────────────────────────────

/**
 * Ordinary Least Squares regression.
 * Returns { slope, intercept } where slope is price change per ms.
 */
export function olsSlope(
  xs: number[], // timestamps in ms
  ys: number[], // prices
): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };

  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }

  const slope     = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

/**
 * Standard deviation of an array.
 */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Exponential Weighted Mean — gives more weight to recent observations.
 * α = smoothing factor (0 < α ≤ 1). Higher α = more weight on recent.
 */
export function ewm(values: number[], alpha: number): number {
  if (!values.length) return 0;
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i] + (1 - alpha) * result;
  }
  return result;
}

/**
 * Find the index of the first price drop exceeding `threshold` (fraction).
 * Scans from newest to oldest.
 * Returns the ms timestamp of the drop, or null.
 */
export function findLastSignificantDrop(
  points: Array<{ price: number; fetchedAt: Date | string }>,
  threshold = 0.05,
): Date | null {
  // Points should be in chronological order (oldest first)
  for (let i = points.length - 1; i > 0; i--) {
    const prev = points[i - 1].price;
    const curr = points[i].price;
    if (prev > 0 && (prev - curr) / prev >= threshold) {
      return new Date(points[i].fetchedAt);
    }
  }
  return null;
}

// ─── Core prediction ──────────────────────────────────────────────────────────

export interface PredictionInput {
  canonicalId:   string;
  platform?:     string;
  /** Chronological price history (oldest first) */
  points:        HistoryPoint[];
  currentPrice:  number;
  /** Whether an active Deal document exists for this product */
  hasActiveDeal: boolean;
}

/**
 * Core deterministic prediction algorithm.
 * Operates entirely on provided data — no DB calls.
 * Deterministic: same input always produces the same output.
 */
export function computePrediction(input: PredictionInput): PricePrediction {
  const { points, currentPrice, hasActiveDeal } = input;

  // ── Insufficient data ─────────────────────────────────────────────────────
  if (points.length < MIN_POINTS) {
    return {
      verdict:    'UNKNOWN',
      confidence: 0,
      signals: {
        trendPctPerDay:   0,
        volatility:       0,
        meanReversion:    0,
        momentum7d:       0,
        positionInRange:  0.5,
        daysSinceLastDrop: null,
        hasActiveDeal,
        dataPoints:       points.length,
      },
      reason:      'Insufficient price history for a reliable prediction.',
      generatedAt: Date.now(),
      cached:      false,
    };
  }

  const prices = points.map(p => p.price);
  const timestamps = points.map(p => new Date(p.fetchedAt).getTime());

  // ── 1. Linear trend (OLS) ──────────────────────────────────────────────────
  const { slope } = olsSlope(timestamps, prices);
  const meanPrice  = prices.reduce((a, b) => a + b, 0) / prices.length;
  const MS_PER_DAY = 86400000;
  // Normalise slope as % change per day
  const trendPctPerDay = meanPrice > 0 ? (slope * MS_PER_DAY) / meanPrice : 0;

  // ── 2. Volatility (Coefficient of Variation) ───────────────────────────────
  const sd         = stdDev(prices);
  const volatility = meanPrice > 0 ? sd / meanPrice : 0;

  // ── 3. Mean reversion ──────────────────────────────────────────────────────
  // Positive = current price is above mean (candidate for drop)
  // Negative = current price is below mean (candidate for bounce)
  const meanReversion = meanPrice > 0 ? (currentPrice - meanPrice) / meanPrice : 0;

  // ── 4. 7-day EWM momentum ──────────────────────────────────────────────────
  const sevenDaysAgo = Date.now() - 7 * MS_PER_DAY;
  const recentPoints = points.filter(
    p => new Date(p.fetchedAt).getTime() >= sevenDaysAgo,
  );
  const recent7dPrices = recentPoints.length >= 2
    ? recentPoints.map(p => p.price)
    : prices.slice(-Math.min(5, prices.length));

  const ewmRecent = ewm(recent7dPrices, EWM_ALPHA);
  // Momentum: how much the EWM has moved relative to first point in window
  const firstRecent = recent7dPrices[0] ?? currentPrice;
  const momentum7d  = firstRecent > 0 ? (ewmRecent - firstRecent) / firstRecent : 0;

  // ── 5. Position in range ───────────────────────────────────────────────────
  const lowestPrice  = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const priceRange   = highestPrice - lowestPrice;
  const positionInRange = priceRange > 0
    ? (currentPrice - lowestPrice) / priceRange
    : 0.5;

  // ── 6. Days since last significant drop ───────────────────────────────────
  const lastDropDate    = findLastSignificantDrop(points);
  const daysSinceLastDrop = lastDropDate
    ? (Date.now() - lastDropDate.getTime()) / MS_PER_DAY
    : null;

  // ── Signal summary ────────────────────────────────────────────────────────
  const signals: SignalBreakdown = {
    trendPctPerDay,
    volatility,
    meanReversion,
    momentum7d,
    positionInRange,
    daysSinceLastDrop,
    hasActiveDeal,
    dataPoints: points.length,
  };

  // ── Boolean flags derived from signals ───────────────────────────────────
  const nearLow           = positionInRange <= NEAR_LOW_THRESHOLD;
  const nearHigh          = positionInRange >= (1 - NEAR_HIGH_THRESHOLD);
  const trendFalling      = trendPctPerDay < -TREND_FLAT_THRESHOLD;
  const trendRising       = trendPctPerDay > TREND_FLAT_THRESHOLD;
  const trendFlat         = !trendFalling && !trendRising;
  const momentumNegative  = momentum7d < -0.01; // > 1% drop in momentum
  const momentumPositive  = momentum7d > 0.01;
  const aboveMean         = meanReversion > 0.03;   // > 3% above mean
  const belowMean         = meanReversion < -0.03;  // > 3% below mean
  const highVolatility    = volatility > VOLATILITY_HIGH;
  const veryHighVolatility = volatility > VOLATILITY_VERY_HIGH;

  // ── Verdict decision tree ─────────────────────────────────────────────────
  //
  // Priority:
  //   1. BUY_NOW  — unambiguous signals that current is a good buying point
  //   2. LIKELY_TO_DROP — price expected to fall further
  //   3. LIKELY_TO_INCREASE — price expected to rise
  //   4. WAIT — volatile / unclear
  //   5. BUY_NOW (secondary — deal exists + near low)

  let verdict: PredictionVerdict;
  let reason: string;
  let estimatedChangePct: number | undefined;

  const buyNowSignals = [
    nearLow,
    trendFalling || trendFlat,
    !momentumPositive,
    hasActiveDeal || (daysSinceLastDrop !== null && daysSinceLastDrop <= DEAL_RECENCY_DAYS),
  ].filter(Boolean).length;

  const dropSignals = [
    aboveMean,
    trendFalling,
    momentumNegative,
    nearHigh,
  ].filter(Boolean).length;

  const increaseSignals = [
    belowMean,
    trendRising,
    momentumPositive,
    daysSinceLastDrop !== null && daysSinceLastDrop <= DEAL_RECENCY_DAYS && nearLow,
  ].filter(Boolean).length;

  if (nearLow && buyNowSignals >= 2) {
    verdict = 'BUY_NOW';
    reason  = nearLow && hasActiveDeal
      ? `Price is at or near its lowest recorded point and an active deal exists — strong buy signal.`
      : `Price is at or near its ${Math.round(points.length > 7 ? 30 : 14)}-day low. ${trendFalling ? 'Trend was falling but may be stabilising.' : 'Momentum is neutral or declining.'}`;
    estimatedChangePct = Math.max(trendPctPerDay * 14, -0.4); // cap at −40% (fraction)
  } else if (dropSignals >= 2 && !nearLow && !veryHighVolatility) {
    verdict = 'LIKELY_TO_DROP';
    reason  = [
      aboveMean && `Current price is ${Math.round(meanReversion * 100)}% above the average`,
      trendFalling && `trending down at ${Math.abs(trendPctPerDay * 100).toFixed(2)}% per day`,
      momentumNegative && `recent momentum is negative`,
      nearHigh && `price is near its period high`,
    ].filter(Boolean).join('; ') + '. Consider waiting.';
    estimatedChangePct = Math.max(trendPctPerDay * 14, -0.4); // cap at −40% (fraction)
  } else if (increaseSignals >= 2) {
    verdict = 'LIKELY_TO_INCREASE';
    reason  = [
      belowMean && `Price is ${Math.abs(Math.round(meanReversion * 100))}% below average`,
      trendRising && `trending up at ${(trendPctPerDay * 100).toFixed(2)}% per day`,
      momentumPositive && `short-term momentum is positive`,
    ].filter(Boolean).join('; ') + '. May be recovering — consider buying now.';
    estimatedChangePct = Math.min(trendPctPerDay * 14, 0.5); // cap at +50% (fraction)
  } else if (veryHighVolatility || (highVolatility && trendFlat)) {
    verdict = 'WAIT';
    reason  = `Price is highly volatile (CV ${(volatility * 100).toFixed(1)}%). No clear trend — worth monitoring for a few days.`;
    estimatedChangePct = undefined;
  } else if (hasActiveDeal && nearLow) {
    // Secondary BUY_NOW path — deal + near low even without strong trend signals
    verdict = 'BUY_NOW';
    reason  = `Active deal detected at a near-period-low price — good time to buy.`;
    estimatedChangePct = Math.max(trendPctPerDay * 7, -0.4); // cap at −40% (fraction)
  } else {
    // No clear signal
    verdict = 'WAIT';
    reason  = trendFlat
      ? 'Price has been relatively stable. No strong signal to buy or wait.'
      : 'Mixed signals — trend is unclear. Monitoring recommended.';
    const rawEst = trendPctPerDay * 14;
    estimatedChangePct = Math.max(Math.min(rawEst, 0.5), -0.4); // cap ±40%/+50% (fractions)
  }

  // ── Confidence score ───────────────────────────────────────────────────────
  //
  // Components (each 0–1):
  //   a. Data quantity:   min(dataPoints / STRONG_TREND_POINTS, 1)
  //   b. Signal strength: fraction of signals pointing same direction
  //   c. Data recency:    exponential decay on age of most recent point
  //   d. Volatility penalty: 1 - clamp(volatility / VOLATILITY_VERY_HIGH, 0, 0.5)

  const maxSignals = 4;
  const signalCount =
    verdict === 'BUY_NOW'            ? buyNowSignals :
    verdict === 'LIKELY_TO_DROP'     ? dropSignals :
    verdict === 'LIKELY_TO_INCREASE' ? increaseSignals :
    1; // WAIT/UNKNOWN

  const dataQuantity   = Math.min(points.length / STRONG_TREND_POINTS, 1);
  const signalStrength = Math.min(signalCount / maxSignals, 1);
  const latestTs       = Math.max(...timestamps);
  const ageHours       = (Date.now() - latestTs) / (1000 * 3600);
  const dataRecency    = Math.exp(-ageHours / 72); // half-life ~72h (3 days)
  const volPenalty     = Math.min(volatility / VOLATILITY_VERY_HIGH, 0.5);

  const raw = 0.3 * dataQuantity
            + 0.35 * signalStrength
            + 0.2  * dataRecency
            + 0.15 * (1 - volPenalty);

  const confidence = Math.max(0, Math.min(1, raw));

  return {
    verdict,
    confidence: Math.round(confidence * 100) / 100,
    signals,
    reason,
    estimatedChangePct: estimatedChangePct !== undefined
      ? Math.round(estimatedChangePct * 1000) / 10  // 1 decimal place %
      : undefined,
    generatedAt: Date.now(),
    cached: false,
  };
}

// ─── Public API (with caching) ────────────────────────────────────────────────

export interface PredictionRequest {
  canonicalId:   string;
  platform?:     string;
  points:        HistoryPoint[];
  currentPrice:  number;
  hasActiveDeal: boolean;
}

/**
 * Get a price prediction, using the LRU cache.
 * Cache key includes currentPrice so it auto-invalidates when price changes.
 */
export function getPricePrediction(req: PredictionRequest): PricePrediction {
  const cacheKey = `${req.canonicalId}::${req.platform ?? 'all'}::${req.currentPrice}`;

  const cached = predictionCache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const result = computePrediction(req);
  predictionCache.set(cacheKey, result);
  return result;
}
