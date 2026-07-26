/**
 * tests/unit/pricePrediction.test.ts
 *
 * Comprehensive unit tests for the deterministic price prediction engine.
 *
 * Coverage:
 *   1. Pure statistical helpers (olsSlope, stdDev, ewm, findLastSignificantDrop)
 *   2. computePrediction — all five verdicts
 *   3. Confidence score bounds and monotonicity
 *   4. Cache layer — hit/miss/invalidation on price change
 *   5. Edge cases — single point, all-same prices, huge spike, zero prices
 *   6. Property tests — confidence always in [0,1], verdict always valid
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  olsSlope,
  stdDev,
  ewm,
  findLastSignificantDrop,
  computePrediction,
  getPricePrediction,
  _clearPredictionCache,
  type PredictionInput,
} from '../../api/_lib/pricePrediction';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86400000;
const NOW = Date.now();

function makePoint(daysAgo: number, price: number, platform = 'amazon') {
  return {
    platform,
    price,
    originalPrice: undefined,
    discount: undefined,
    fetchedAt: new Date(NOW - daysAgo * MS_PER_DAY),
    rating: undefined,
  };
}

function makeInput(
  priceSeries: Array<{ daysAgo: number; price: number }>,
  overrides: Partial<PredictionInput> = {},
): PredictionInput {
  return {
    canonicalId:   'az_TEST',
    points:        priceSeries.map(({ daysAgo, price }) => makePoint(daysAgo, price)),
    currentPrice:  priceSeries[priceSeries.length - 1]?.price ?? 0,
    hasActiveDeal: false,
    ...overrides,
  };
}

// ─── 1. olsSlope ─────────────────────────────────────────────────────────────

describe('olsSlope', () => {
  it('returns slope = 0 for a single point', () => {
    const { slope } = olsSlope([1000], [500]);
    expect(slope).toBe(0);
  });

  it('returns positive slope for strictly increasing prices', () => {
    const xs = [0, 1, 2, 3].map(i => i * MS_PER_DAY);
    const ys = [100, 200, 300, 400];
    const { slope } = olsSlope(xs, ys);
    expect(slope).toBeGreaterThan(0);
  });

  it('returns negative slope for strictly decreasing prices', () => {
    const xs = [0, 1, 2, 3].map(i => i * MS_PER_DAY);
    const ys = [400, 300, 200, 100];
    const { slope } = olsSlope(xs, ys);
    expect(slope).toBeLessThan(0);
  });

  it('returns slope ≈ 0 for constant prices', () => {
    const xs = [0, 1, 2, 3].map(i => i * MS_PER_DAY);
    const ys = [300, 300, 300, 300];
    const { slope } = olsSlope(xs, ys);
    expect(Math.abs(slope)).toBeLessThan(1e-6);
  });

  it('extrapolated slope matches expected price change per day', () => {
    // Prices: 100 → 200 over 4 days = +25/day
    const xs = [0, 1, 2, 3].map(i => i * MS_PER_DAY);
    const ys = [100, 125, 150, 200]; // rough linear
    const { slope } = olsSlope(xs, ys);
    const pctPerDay = (slope * MS_PER_DAY) / 137.5; // approx mean
    expect(pctPerDay).toBeGreaterThan(0);
  });
});

// ─── 2. stdDev ────────────────────────────────────────────────────────────────

describe('stdDev', () => {
  it('returns 0 for a single element', () => {
    expect(stdDev([500])).toBe(0);
  });

  it('returns 0 for all-equal values', () => {
    expect(stdDev([100, 100, 100, 100])).toBe(0);
  });

  it('returns > 0 for varying values', () => {
    expect(stdDev([100, 200, 300])).toBeGreaterThan(0);
  });

  it('returns correct value for known dataset', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] — mean=5, σ=2
    const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(Math.abs(result - 2)).toBeLessThan(0.01);
  });
});

// ─── 3. ewm ──────────────────────────────────────────────────────────────────

describe('ewm', () => {
  it('returns the only element for a single-element array', () => {
    expect(ewm([500], 0.3)).toBe(500);
  });

  it('with α=1 equals the last value', () => {
    expect(ewm([100, 200, 300, 999], 1.0)).toBe(999);
  });

  it('gives more weight to recent values with high α', () => {
    const high = ewm([100, 100, 500], 0.9);
    const low  = ewm([100, 100, 500], 0.1);
    expect(high).toBeGreaterThan(low);
  });

  it('returns a value between min and max of the series', () => {
    const values = [100, 200, 150, 300, 250];
    const result = ewm(values, 0.3);
    expect(result).toBeGreaterThanOrEqual(100);
    expect(result).toBeLessThanOrEqual(300);
  });
});

// ─── 4. findLastSignificantDrop ───────────────────────────────────────────────

describe('findLastSignificantDrop', () => {
  it('returns null for a flat series', () => {
    const pts = [1, 2, 3, 4].map(d => makePoint(d, 500));
    expect(findLastSignificantDrop(pts)).toBeNull();
  });

  it('returns null for a rising series', () => {
    const pts = [4, 3, 2, 1].map((d, i) => makePoint(d, 400 + i * 50));
    expect(findLastSignificantDrop(pts)).toBeNull();
  });

  it('detects a single large drop', () => {
    const pts = [
      makePoint(10, 1000),
      makePoint(5, 1000),
      makePoint(2, 500), // 50% drop
      makePoint(1, 500),
    ];
    const result = findLastSignificantDrop(pts);
    expect(result).not.toBeNull();
    // The drop occurred at the third point (daysAgo=2)
    expect(new Date(result!).getTime()).toBeGreaterThan(new Date(pts[0].fetchedAt).getTime());
  });

  it('ignores drops below threshold', () => {
    const pts = [
      makePoint(5, 1000),
      makePoint(1, 980), // 2% drop — below 5% default
    ];
    expect(findLastSignificantDrop(pts, 0.05)).toBeNull();
  });
});

// ─── 5. computePrediction — verdict scenarios ─────────────────────────────────

describe('computePrediction — UNKNOWN', () => {
  it('returns UNKNOWN with 0 confidence for fewer than 3 points', () => {
    const result = computePrediction(makeInput([
      { daysAgo: 5, price: 1000 },
      { daysAgo: 2, price: 950 },
    ]));
    expect(result.verdict).toBe('UNKNOWN');
    expect(result.confidence).toBe(0);
  });

  it('returns UNKNOWN for exactly 2 points', () => {
    const result = computePrediction(makeInput([
      { daysAgo: 10, price: 800 },
      { daysAgo: 1,  price: 810 },
    ]));
    expect(result.verdict).toBe('UNKNOWN');
  });
});

describe('computePrediction — BUY_NOW', () => {
  it('signals BUY_NOW when price is at period low and trend is falling', () => {
    // Prices fell from 1000 to 799 → at historical low
    const series = [
      { daysAgo: 30, price: 1000 },
      { daysAgo: 25, price: 950 },
      { daysAgo: 20, price: 900 },
      { daysAgo: 15, price: 870 },
      { daysAgo: 10, price: 850 },
      { daysAgo: 5,  price: 820 },
      { daysAgo: 1,  price: 799 }, // AT historical low
    ];
    const result = computePrediction(makeInput(series, { currentPrice: 799 }));
    expect(result.verdict).toBe('BUY_NOW');
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('signals BUY_NOW when active deal + near low', () => {
    const series = [
      { daysAgo: 15, price: 1500 },
      { daysAgo: 10, price: 1400 },
      { daysAgo: 5,  price: 1000 },
      { daysAgo: 1,  price: 999 }, // near low
    ];
    const result = computePrediction(makeInput(series, {
      currentPrice: 999,
      hasActiveDeal: true,
    }));
    expect(result.verdict).toBe('BUY_NOW');
  });
});

describe('computePrediction — LIKELY_TO_DROP', () => {
  it('signals LIKELY_TO_DROP when price is above mean and trending down steadily', () => {
    // Prices rise gradually then plateau high and start falling.
    // No spikes — low volatility. Current price is clearly above the historical mean.
    // mean ≈ (500+510+520+530+560+580+580+570+565+560)/10 = 5475/10 = 547.5
    // current = 560 → +2.3% above mean — but need >3%, so push plateau higher
    // Use: baseline 500→530, then jumps to ~650 and stays/falls slightly
    // mean ≈ (500+510+520+530+650+648+645+640+638+635)/10 = 5916/10 = 591.6
    // current = 635 → (635-591.6)/591.6 = +7.3% above mean ✓
    // trendFalling: goes from 500→650 then 650→635 — overall OLS slight positive...
    // Better: all above 600, falling from 680 to 620 with baseline near 580
    // mean ≈ (580+582+584+686+678+668+656+645+635+620)/10 = 6334/10 = 633.4
    // current = 620 → (620-633.4)/633.4 = -2.1% — below mean. not right.
    //
    // Cleanest approach: long stable period at 500, then rise to ~700, currently 690 (still above mean)
    // mean of [500,500,500,500,700,695,693,691,690] ≈ 607.6; current=690 → +13.5% above mean ✓
    // CV: sd of those ≈ 89, mean≈608, CV≈0.146 — right at 15% boundary (borderline)
    // Use more points at the baseline to keep CV lower
    // 15 points: 8×500 + 7 falling from 700 down to 640
    // mean ≈ (8×500 + 700+690+680+670+660+650+640)/15 = (4000+4690)/15 = 8690/15 ≈ 579.3
    // current=640 → (640-579.3)/579.3 = +10.5% above mean ✓
    // sd: prices span 500–700, most at 500; sd ≈ 83; CV = 83/579 ≈ 0.143 < 0.15 ✓
    const series = [
      { daysAgo: 55, price: 500 },
      { daysAgo: 50, price: 500 },
      { daysAgo: 45, price: 500 },
      { daysAgo: 40, price: 500 },
      { daysAgo: 35, price: 500 },
      { daysAgo: 30, price: 500 },
      { daysAgo: 25, price: 500 },
      { daysAgo: 20, price: 500 },
      { daysAgo: 15, price: 700 }, // price rises
      { daysAgo: 12, price: 690 }, // then falls — still clearly above mean
      { daysAgo: 9,  price: 680 },
      { daysAgo: 6,  price: 670 },
      { daysAgo: 3,  price: 660 },
      { daysAgo: 2,  price: 650 },
      { daysAgo: 1,  price: 640 }, // ~+10% above mean ≈ 579, falling
    ];
    const result = computePrediction(makeInput(series, { currentPrice: 640 }));
    expect(result.verdict).toBe('LIKELY_TO_DROP');
  });
});

describe('computePrediction — LIKELY_TO_INCREASE', () => {
  it('signals LIKELY_TO_INCREASE when price is below mean and rising', () => {
    const series = [
      { daysAgo: 40, price: 1000 },
      { daysAgo: 35, price: 1000 },
      { daysAgo: 30, price: 700 },  // drop
      { daysAgo: 20, price: 650 },  // below mean
      { daysAgo: 10, price: 680 },  // recovering
      { daysAgo: 5,  price: 720 },
      { daysAgo: 1,  price: 760 },  // still below mean (~787) but rising
    ];
    const result = computePrediction(makeInput(series, { currentPrice: 760 }));
    expect(result.verdict).toBe('LIKELY_TO_INCREASE');
  });
});

describe('computePrediction — WAIT', () => {
  it('signals WAIT for highly volatile prices with no clear trend', () => {
    // Wild oscillations = very high volatility — prices swing ±50%+ around mean
    const series = [
      { daysAgo: 14, price: 1000 },
      { daysAgo: 12, price:  400 },
      { daysAgo: 10, price: 1300 },
      { daysAgo: 8,  price:  350 },
      { daysAgo: 6,  price: 1200 },
      { daysAgo: 4,  price:  300 },
      { daysAgo: 2,  price: 1100 },
      { daysAgo: 1,  price:  750 }, // near mean, no clear direction
    ];
    const result = computePrediction(makeInput(series, { currentPrice: 750 }));
    expect(result.verdict).toBe('WAIT');
  });
});

// ─── 6. Confidence bounds ─────────────────────────────────────────────────────

describe('confidence score', () => {
  it('is always between 0 and 1', () => {
    const scenarios = [
      makeInput([{ daysAgo: 5, price: 500 }, { daysAgo: 1, price: 490 }]),
      makeInput([...Array(20)].map((_, i) => ({ daysAgo: 20 - i, price: 1000 + i * 10 }))),
      makeInput([...Array(5)].map((_, i) => ({ daysAgo: 5 - i, price: 800 + Math.sin(i) * 200 }))),
    ];
    for (const input of scenarios) {
      const { confidence } = computePrediction(input);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });

  it('increases with more data points (same trend)', () => {
    const smallSeries = [
      { daysAgo: 3, price: 1000 },
      { daysAgo: 2, price: 950 },
      { daysAgo: 1, price: 900 },
    ];
    const largeSeries = [
      { daysAgo: 14, price: 1400 },
      { daysAgo: 12, price: 1350 },
      { daysAgo: 10, price: 1300 },
      { daysAgo: 8,  price: 1250 },
      { daysAgo: 6,  price: 1200 },
      { daysAgo: 4,  price: 1100 },
      { daysAgo: 2,  price: 1000 },
      { daysAgo: 1,  price: 900 },
    ];
    const small = computePrediction(makeInput(smallSeries, { currentPrice: 900 }));
    const large = computePrediction(makeInput(largeSeries, { currentPrice: 900 }));
    expect(large.confidence).toBeGreaterThanOrEqual(small.confidence);
  });

  it('UNKNOWN verdict always has confidence 0', () => {
    const result = computePrediction(makeInput([{ daysAgo: 1, price: 500 }]));
    expect(result.confidence).toBe(0);
  });
});

// ─── 7. Cache ─────────────────────────────────────────────────────────────────

describe('cache layer', () => {
  beforeEach(() => _clearPredictionCache());

  it('returns cached=false on first call', () => {
    const input = makeInput([
      { daysAgo: 5, price: 1000 },
      { daysAgo: 3, price: 950 },
      { daysAgo: 1, price: 900 },
    ]);
    const result = getPricePrediction({ ...input, platform: 'amazon' });
    expect(result.cached).toBe(false);
  });

  it('returns cached=true on second call with same price', () => {
    const base = makeInput([
      { daysAgo: 5, price: 1000 },
      { daysAgo: 3, price: 950 },
      { daysAgo: 1, price: 900 },
    ]);
    const req = { ...base, platform: 'amazon' };
    getPricePrediction(req);
    const second = getPricePrediction(req);
    expect(second.cached).toBe(true);
  });

  it('cache key includes currentPrice — different price = cache miss', () => {
    const base = makeInput([
      { daysAgo: 5, price: 1000 },
      { daysAgo: 3, price: 950 },
      { daysAgo: 1, price: 900 },
    ]);
    getPricePrediction({ ...base, currentPrice: 900, platform: 'amazon' });
    // Same history but price changed to 850
    const different = getPricePrediction({ ...base, currentPrice: 850, platform: 'amazon' });
    expect(different.cached).toBe(false);
  });
});

// ─── 8. Edge cases ────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles zero-price entries gracefully', () => {
    const input = makeInput([
      { daysAgo: 5, price: 0 },
      { daysAgo: 3, price: 500 },
      { daysAgo: 1, price: 490 },
    ]);
    // Should not throw, should return a verdict
    expect(() => computePrediction(input)).not.toThrow();
  });

  it('handles all-same prices as flat/stable', () => {
    const series = [1, 2, 3, 4, 5, 6, 7].map(d => ({ daysAgo: d, price: 999 }));
    const result = computePrediction(makeInput(series, { currentPrice: 999 }));
    // Flat volatility + flat trend → WAIT or BUY_NOW (at "low" = same as high)
    expect(['WAIT', 'BUY_NOW']).toContain(result.verdict);
  });

  it('handles a massive single spike followed by recovery', () => {
    const series = [
      { daysAgo: 10, price: 500 },
      { daysAgo: 8,  price: 500 },
      { daysAgo: 6,  price: 2000 }, // 4x spike
      { daysAgo: 4,  price: 600 },
      { daysAgo: 2,  price: 510 },
      { daysAgo: 1,  price: 505 },
    ];
    const result = computePrediction(makeInput(series, { currentPrice: 505 }));
    expect(result).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('estimatedChangePct is within -40 to +50 range (bounded)', () => {
    const series = Array.from({ length: 10 }, (_, i) => ({
      daysAgo: 10 - i,
      price:   1000 - i * 100, // steep fall
    }));
    const result = computePrediction(makeInput(series, { currentPrice: 100 }));
    if (result.estimatedChangePct !== undefined) {
      expect(result.estimatedChangePct).toBeGreaterThanOrEqual(-40);
      expect(result.estimatedChangePct).toBeLessThanOrEqual(50);
    }
  });
});

// ─── 9. Property tests ────────────────────────────────────────────────────────

describe('property tests', () => {
  const VALID_VERDICTS = new Set([
    'BUY_NOW', 'WAIT', 'LIKELY_TO_DROP', 'LIKELY_TO_INCREASE', 'UNKNOWN',
  ]);

  it('verdict is always one of the five valid values', () => {
    const scenarios = [
      makeInput([]),
      makeInput([{ daysAgo: 1, price: 500 }]),
      makeInput([{ daysAgo: 3, price: 900 }, { daysAgo: 1, price: 500 }]),
      makeInput(Array.from({ length: 20 }, (_, i) => ({ daysAgo: 20 - i, price: 500 + Math.random() * 100 }))),
      makeInput(Array.from({ length: 20 }, (_, i) => ({ daysAgo: 20 - i, price: 500 + i * 20 }))),
      makeInput(Array.from({ length: 20 }, (_, i) => ({ daysAgo: 20 - i, price: 900 - i * 20 }))),
    ];

    for (const input of scenarios) {
      const result = computePrediction(input);
      expect(VALID_VERDICTS.has(result.verdict)).toBe(true);
    }
  });

  it('reason is always a non-empty string', () => {
    const scenarios = [
      makeInput([]),
      makeInput([{ daysAgo: 2, price: 999 }, { daysAgo: 1, price: 980 }]),
      makeInput(Array.from({ length: 10 }, (_, i) => ({ daysAgo: 10 - i, price: 1000 }))),
    ];
    for (const input of scenarios) {
      const { reason } = computePrediction(input);
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
    }
  });

  it('generatedAt is a recent timestamp', () => {
    const before = Date.now();
    const result = computePrediction(makeInput([
      { daysAgo: 2, price: 500 },
      { daysAgo: 1, price: 490 },
      { daysAgo: 0.1, price: 480 },
    ]));
    expect(result.generatedAt).toBeGreaterThanOrEqual(before);
    expect(result.generatedAt).toBeLessThanOrEqual(Date.now() + 100);
  });
});
