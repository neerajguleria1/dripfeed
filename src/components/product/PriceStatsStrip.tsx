import { useEffect } from 'react';
import { usePriceHistory } from '../../hooks/usePriceHistory';
import { PriceInsightBadge } from './PriceInsightBadge';
import { formatPrice } from '../../utils/formatPrice';

interface PriceStatsStripProps {
  canonicalId: string;
  currentPrice: number;
  /** Called when the strip is expanded — parent can use to lazy-mount */
  className?: string;
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Compact price stats strip shown inside a product card.
 * Fetches on mount (called only when the card is expanded).
 */
export function PriceStatsStrip({ canonicalId, currentPrice, className = '' }: PriceStatsStripProps) {
  const { stats, status, days, fetch } = usePriceHistory();

  useEffect(() => {
    fetch(canonicalId);
  }, [canonicalId, fetch]);

  if (status === 'loading') {
    return (
      <div className={['animate-pulse space-y-1.5', className].join(' ')} aria-busy="true">
        <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-3/4" />
        <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-1/2" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <p className={['text-[11px] text-neutral-400', className].join(' ')}>
        History unavailable
      </p>
    );
  }

  if (status === 'empty' || !stats) {
    return (
      <p className={['text-[11px] text-neutral-400 italic', className].join(' ')}>
        No history yet — tracking started
      </p>
    );
  }

  return (
    <div className={['space-y-1.5', className].join(' ')}>
      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {formatPrice(stats.lowestPrice)}
          </span>
          {' '}low ({days}d)
        </span>
        <span className="text-neutral-300 dark:text-neutral-600" aria-hidden>·</span>
        <span>
          <span className="font-medium text-neutral-600 dark:text-neutral-300">
            {formatPrice(stats.highestPrice)}
          </span>
          {' '}high
        </span>
        <span className="text-neutral-300 dark:text-neutral-600" aria-hidden>·</span>
        <span>Updated {ago(stats.lastUpdated)}</span>
      </div>

      {/* Buy signal badge */}
      <PriceInsightBadge currentPrice={currentPrice} stats={stats} days={days} />
    </div>
  );
}

export default PriceStatsStrip;
