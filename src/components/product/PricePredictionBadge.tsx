/**
 * PricePredictionBadge.tsx
 *
 * Compact badge shown on ProductDetailPage below the price comparison section.
 * Lazy-loads prediction on first render (IntersectionObserver).
 *
 * Verdict → label + color:
 *   BUY_NOW              → green  "Buy Now"
 *   LIKELY_TO_DROP       → blue   "Likely to Drop"
 *   LIKELY_TO_INCREASE   → amber  "Likely to Increase"
 *   WAIT                 → orange "Wait"
 *   UNKNOWN              → grey   "Unknown"
 */

import { useEffect, useRef, useState } from 'react';
import { TrendingDown, TrendingUp, ShoppingCart, Clock, HelpCircle } from 'lucide-react';
import { usePricePrediction } from '../../hooks/usePricePrediction';
import type { PredictionVerdict } from '../../hooks/usePricePrediction';

// ─── Config ───────────────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<PredictionVerdict, {
  label:   string;
  color:   string;
  bg:      string;
  border:  string;
  Icon:    typeof TrendingDown;
}> = {
  BUY_NOW: {
    label:  'Buy Now',
    color:  'text-emerald-700',
    bg:     'bg-emerald-50',
    border: 'border-emerald-200',
    Icon:   ShoppingCart,
  },
  LIKELY_TO_DROP: {
    label:  'Likely to Drop',
    color:  'text-blue-700',
    bg:     'bg-blue-50',
    border: 'border-blue-200',
    Icon:   TrendingDown,
  },
  LIKELY_TO_INCREASE: {
    label:  'Likely to Increase',
    color:  'text-amber-700',
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    Icon:   TrendingUp,
  },
  WAIT: {
    label:  'Wait',
    color:  'text-orange-700',
    bg:     'bg-orange-50',
    border: 'border-orange-200',
    Icon:   Clock,
  },
  UNKNOWN: {
    label:  'Unknown',
    color:  'text-neutral-500',
    bg:     'bg-neutral-50',
    border: 'border-neutral-200',
    Icon:   HelpCircle,
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 70 ? 'bg-emerald-400' :
    pct >= 40 ? 'bg-amber-400'   :
    'bg-neutral-300';

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      <span className="text-[10px] text-neutral-400 font-medium tabular-nums w-7 text-right">
        {pct}%
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PricePredictionBadgeProps {
  canonicalId: string;
  platform?:   string;
}

export function PricePredictionBadge({ canonicalId, platform }: PricePredictionBadgeProps) {
  const { prediction, status, fetch } = usePricePrediction();
  const ref     = useRef<HTMLDivElement>(null);
  const loaded  = useRef(false);
  const [expanded, setExpanded] = useState(false);

  // Lazy load via IntersectionObserver
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loaded.current) {
          loaded.current = true;
          fetch(canonicalId, platform);
        }
      },
      { rootMargin: '150px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalId, platform]);

  return (
    <div ref={ref} className="mb-6">
      {/* Loading skeleton */}
      {status === 'loading' && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neutral-100 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-neutral-100 rounded-full w-24" />
              <div className="h-2 bg-neutral-100 rounded-full w-40" />
            </div>
          </div>
        </div>
      )}

      {/* Error / no data */}
      {status === 'error' && null /* silent fail — not critical */}

      {/* Success */}
      {status === 'success' && prediction && prediction.verdict !== 'UNKNOWN' && (() => {
        const cfg = VERDICT_CONFIG[prediction.verdict];
        const Icon = cfg.Icon;

        return (
          <div className={`bg-white rounded-2xl border ${cfg.border} overflow-hidden`}>
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center gap-3 p-4 text-left min-h-[56px]"
              aria-expanded={expanded}
            >
              {/* Icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                <Icon className={`w-4 h-4 ${cfg.color}`} />
              </div>

              {/* Label + reason */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[12px] font-bold uppercase tracking-[0.06em] ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  {prediction.estimatedChangePct !== undefined && (
                    <span className={`text-[11px] font-semibold ${prediction.estimatedChangePct < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {prediction.estimatedChangePct > 0 ? '+' : ''}{prediction.estimatedChangePct.toFixed(1)}% est. 14d
                    </span>
                  )}
                </div>
                {!expanded && (
                  <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">
                    {prediction.reason}
                  </p>
                )}
              </div>

              {/* Confidence pill */}
              <span className="text-[10px] font-semibold text-neutral-400 flex-shrink-0">
                {Math.round(prediction.confidence * 100)}% conf.
              </span>
            </button>

            {/* Expanded detail */}
            {expanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-neutral-50 pt-3">
                <p className="text-[12px] text-neutral-600 leading-relaxed">
                  {prediction.reason}
                </p>

                <ConfidenceBar confidence={prediction.confidence} />

                {prediction.signals && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      {
                        label: 'Trend',
                        value: prediction.signals.trendPctPerDay > 0.001
                          ? `+${(prediction.signals.trendPctPerDay * 100).toFixed(2)}%/d`
                          : prediction.signals.trendPctPerDay < -0.001
                          ? `${(prediction.signals.trendPctPerDay * 100).toFixed(2)}%/d`
                          : 'Flat',
                      },
                      {
                        label: 'Volatility',
                        value: `${(prediction.signals.volatility * 100).toFixed(1)}%`,
                      },
                      {
                        label: 'vs Average',
                        value: prediction.signals.meanReversion > 0
                          ? `+${(prediction.signals.meanReversion * 100).toFixed(1)}%`
                          : `${(prediction.signals.meanReversion * 100).toFixed(1)}%`,
                      },
                      {
                        label: 'In Range',
                        value: `${Math.round(prediction.signals.positionInRange * 100)}%`,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-neutral-50 rounded-lg p-2.5">
                        <p className="text-[10px] text-neutral-400 uppercase tracking-wide">{label}</p>
                        <p className="text-[12px] font-semibold text-[#0F0F1A] mt-0.5 tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-neutral-300">
                  Based on {prediction.signals?.dataPoints ?? '–'} price snapshots · Statistical prediction only
                </p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default PricePredictionBadge;
