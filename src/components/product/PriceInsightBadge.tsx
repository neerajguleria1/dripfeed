import type { PriceStats } from '../../hooks/usePriceHistory';

export type PriceSignal = 'at-lowest' | 'dropped' | 'near-high' | 'normal';

/**
 * Derives the buy-signal from stats + current price.
 *
 * at-lowest  — current price ≤ lowest ever recorded (within 1% tolerance)
 * dropped    — current price dropped ≥ 5% vs highest in period
 * near-high  — current price ≥ 90% of highest ever recorded
 * normal     — no strong signal
 */
export function deriveSignal(currentPrice: number, stats: PriceStats): PriceSignal {
  const { lowestPrice, highestPrice } = stats;
  if (highestPrice <= 0) return 'normal';

  const atLowest = currentPrice <= lowestPrice * 1.01;
  if (atLowest) return 'at-lowest';

  const nearHigh = currentPrice >= highestPrice * 0.90;
  if (nearHigh) return 'near-high';

  const dropPct = (highestPrice - currentPrice) / highestPrice;
  if (dropPct >= 0.05) return 'dropped';

  return 'normal';
}

interface PriceInsightBadgeProps {
  currentPrice: number;
  stats: PriceStats;
  days: 30 | 90;
  className?: string;
}

const SIGNAL_CONFIG = {
  'at-lowest': {
    icon: '🟢',
    label: (_days: number) => `Lowest price in ${_days} days`,
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  },
  'dropped': {
    icon: '📉',
    label: (_days: number, current: number, high: number) => {
      const drop = Math.round(high - current);
      return `Price dropped ₹${drop.toLocaleString('en-IN')} from peak`;
    },
    classes: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
  },
  'near-high': {
    icon: '⚠️',
    label: () => 'Prices are currently high',
    classes: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  },
  'normal': null,
} as const;

export function PriceInsightBadge({ currentPrice, stats, days, className = '' }: PriceInsightBadgeProps) {
  const signal = deriveSignal(currentPrice, stats);
  const config = SIGNAL_CONFIG[signal];
  if (!config) return null;

  const label = signal === 'dropped'
    ? (config.label as (d: number, c: number, h: number) => string)(days, currentPrice, stats.highestPrice)
    : (config.label as (d: number) => string)(days);

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border',
        config.classes,
        className,
      ].join(' ')}
      role="status"
      aria-label={label}
    >
      <span aria-hidden="true">{config.icon}</span>
      {label}
    </span>
  );
}

export default PriceInsightBadge;
