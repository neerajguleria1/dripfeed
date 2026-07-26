/**
 * InterpretedFiltersBar.tsx
 *
 * Displays removable filter chips derived from the AI query interpreter.
 * Shown below the search bar when the interpreter produces results.
 *
 * Each chip has a dismiss (×) button that calls onRemoveFilter so the
 * parent can re-run the search without that specific dimension.
 */

import { Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FilterChip, InterpretedFilters } from '../../types/queryInterpreter';

interface InterpretedFiltersBarProps {
  chips:            FilterChip[];
  confidence:       number;
  provider:         string;
  onRemoveFilter:   (key: keyof InterpretedFilters) => void;
  onClearAll:       () => void;
  /** If true, show a loading skeleton */
  loading?:         boolean;
}

const CHIP_COLORS: Record<string, string> = {
  category:         'bg-violet-50 border-violet-200 text-violet-700',
  brand:            'bg-blue-50 border-blue-200 text-blue-700',
  color:            'bg-pink-50 border-pink-200 text-pink-700',
  size:             'bg-emerald-50 border-emerald-200 text-emerald-700',
  gender:           'bg-cyan-50 border-cyan-200 text-cyan-700',
  style:            'bg-amber-50 border-amber-200 text-amber-700',
  minPrice:         'bg-green-50 border-green-200 text-green-700',
  maxPrice:         'bg-green-50 border-green-200 text-green-700',
  minDiscount:      'bg-orange-50 border-orange-200 text-orange-700',
  retailer:         'bg-indigo-50 border-indigo-200 text-indigo-700',
  sort:             'bg-neutral-50 border-neutral-200 text-neutral-700',
  comparisonIntent: 'bg-teal-50 border-teal-200 text-teal-700',
};

export function InterpretedFiltersBar({
  chips,
  confidence,
  provider: _provider,
  onRemoveFilter,
  onClearAll,
  loading = false,
}: InterpretedFiltersBarProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-1 animate-pulse">
        <div className="w-4 h-4 bg-neutral-100 rounded-full" />
        <div className="h-6 w-20 bg-neutral-100 rounded-full" />
        <div className="h-6 w-24 bg-neutral-100 rounded-full" />
        <div className="h-6 w-16 bg-neutral-100 rounded-full" />
      </div>
    );
  }

  if (chips.length === 0) return null;

  const confidencePct = Math.round(confidence * 100);
  const isHighConfidence = confidence >= 0.7;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-2 flex-wrap"
      aria-label="Interpreted search filters"
    >
      {/* AI badge */}
      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border flex-shrink-0 ${
        isHighConfidence
          ? 'bg-[#C9A96E]/10 border-[#C9A96E]/30 text-[#C9A96E]'
          : 'bg-neutral-50 border-neutral-200 text-neutral-500'
      }`}>
        <Sparkles className="w-2.5 h-2.5" />
        AI Interpreted · {confidencePct}%
      </div>

      {/* Filter chips */}
      <AnimatePresence mode="popLayout">
        {chips.map(chip => {
          const colorClass = CHIP_COLORS[chip.key] ?? 'bg-neutral-50 border-neutral-200 text-neutral-700';
          return (
            <motion.div
              key={chip.key}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${colorClass}`}
            >
              <span className="opacity-60 text-[9px] uppercase tracking-wide">{chip.label}:</span>
              <span className="capitalize">{chip.value}</span>
              <button
                onClick={() => onRemoveFilter(chip.key)}
                aria-label={`Remove ${chip.label} filter`}
                className="ml-0.5 hover:opacity-70 transition-opacity flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Clear all */}
      {chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors border border-neutral-150 hover:border-neutral-300"
          aria-label="Clear all interpreted filters"
        >
          <X className="w-2.5 h-2.5" /> Clear
        </button>
      )}
    </motion.div>
  );
}

export default InterpretedFiltersBar;
