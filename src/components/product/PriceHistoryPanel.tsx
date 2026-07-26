import { useEffect } from 'react';
import { usePriceHistory } from '../../hooks/usePriceHistory';
import { PriceChart } from './PriceChart';
import { PriceInsightBadge } from './PriceInsightBadge';
import { formatPrice } from '../../utils/formatPrice';

interface PriceHistoryPanelProps {
  canonicalId: string;
  currentPrice: number;
  className?: string;
}

function StatCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.08em] font-medium">
        {label}
      </span>
      <span className={[
        'text-[15px] font-bold tabular-nums',
        accent
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-[#0F0F1A] dark:text-white',
      ].join(' ')}>
        {value}
      </span>
    </div>
  );
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Full price history panel for the Compare page.
 * Fetches lazily — parent mounts this only when the section is visible.
 */
export function PriceHistoryPanel({ canonicalId, currentPrice, className = '' }: PriceHistoryPanelProps) {
  const { points, stats, status, days, setDays, fetch } = usePriceHistory();

  useEffect(() => {
    fetch(canonicalId);
  }, [canonicalId, fetch]);

  // Re-fetch when days changes
  useEffect(() => {
    if (status === 'idle') fetch(canonicalId);
  }, [days, status, canonicalId, fetch]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className={['space-y-4 animate-pulse', className].join(' ')} aria-busy="true" aria-label="Loading price history">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full w-16" />
              <div className="h-4 bg-neutral-100 dark:bg-neutral-800 rounded-full w-20" />
            </div>
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="h-[140px] bg-neutral-50 dark:bg-neutral-800/50 rounded-xl" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className={['text-center py-8', className].join(' ')} role="alert">
        <p className="text-[13px] text-neutral-400">
          Couldn't load price history. Try refreshing.
        </p>
      </div>
    );
  }

  // ── No history yet ───────────────────────────────────────────────────────
  if (status === 'empty' || !stats) {
    return (
      <div className={['text-center py-8', className].join(' ')}>
        <p className="text-2xl mb-2" aria-hidden>📊</p>
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
          No history yet — we've started tracking this product.
        </p>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
          Check back after the next price update.
        </p>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  return (
    <div className={['space-y-5', className].join(' ')}>

      {/* Buy signal */}
      <PriceInsightBadge currentPrice={currentPrice} stats={stats} days={days} />

      {/* Stats grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl"
        aria-label="Price statistics"
      >
        <StatCell label="Today" value={formatPrice(currentPrice)} />
        <StatCell label={`Lowest (${days}d)`} value={formatPrice(stats.lowestPrice)} accent />
        <StatCell label={`Highest (${days}d)`} value={formatPrice(stats.highestPrice)} />
        <StatCell label="Updated" value={ago(stats.lastUpdated)} />
      </div>

      {/* Chart */}
      <PriceChart
        points={points}
        days={days}
        onDaysChange={(d) => setDays(d)}
      />
    </div>
  );
}

export default PriceHistoryPanel;
