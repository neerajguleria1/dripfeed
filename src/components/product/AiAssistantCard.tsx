/**
 * AiAssistantCard.tsx
 *
 * AI Shopping Assistant card on the Product Detail Page.
 * Lazy-loaded by ProductDetailPage — not in the initial bundle.
 *
 * Features:
 * - Accordion-style: collapsed by default, expands on user action
 * - Shows verdict badge, summary, 7 structured insights with evidence
 * - Confidence indicators per insight
 * - Best retailer + best value call-out
 * - Regenerate button
 * - Loading skeleton
 * - Error state with retry
 * - Provider label (Groq / OpenAI / Gemini / rule-based)
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ChevronDown, ChevronUp, RefreshCw,
  ShieldCheck, Clock, TrendingDown, Store,
  AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import { useAiAssistant } from '../../hooks/useAiAssistant';
import type { AssistantInsight, AssistantResponse } from '../../hooks/useAiAssistant';
import { formatPrice } from '../../utils/formatPrice';

// ─── Verdict config ───────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  buy_now: {
    label: 'Buy Now',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot:   'bg-emerald-500',
    icon:  CheckCircle2,
  },
  good_deal: {
    label: 'Good Deal',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot:   'bg-emerald-500',
    icon:  CheckCircle2,
  },
  wait: {
    label: 'Wait a Bit',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot:   'bg-amber-500',
    icon:  Clock,
  },
  consider_alternative: {
    label: 'Consider Alternative',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot:   'bg-blue-500',
    icon:  TrendingDown,
  },
  overpriced: {
    label: 'Overpriced',
    color: 'bg-red-50 text-red-700 border-red-200',
    dot:   'bg-red-500',
    icon:  AlertTriangle,
  },
} as const;

const CONFIDENCE_COLORS = {
  high:   'text-emerald-600',
  medium: 'text-amber-600',
  low:    'text-neutral-400',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InsightRow({ insight }: { insight: AssistantInsight }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-neutral-50 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between gap-3 py-3 text-left min-h-[44px]"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-neutral-500 uppercase tracking-[0.07em] mb-0.5">
            {insight.question}
          </p>
          <p className="text-[13px] text-[#0F0F1A] leading-snug">
            {insight.answer}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
          <span className={`text-[10px] font-semibold capitalize ${CONFIDENCE_COLORS[insight.confidence]}`}>
            {insight.confidence}
          </span>
          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />}
        </div>
      </button>

      <AnimatePresence>
        {open && insight.evidence && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-3 pl-1 pr-2 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-neutral-300 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-neutral-400 leading-relaxed italic">
                {insight.evidence}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AssistantSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-24 bg-neutral-100 rounded-full" />
        <div className="h-3 w-40 bg-neutral-100 rounded-full" />
      </div>
      <div className="h-4 bg-neutral-100 rounded-full w-full" />
      <div className="h-4 bg-neutral-100 rounded-full w-5/6" />
      <div className="space-y-2 pt-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="border border-neutral-100 rounded-xl p-3 space-y-1.5">
            <div className="h-2.5 w-28 bg-neutral-100 rounded-full" />
            <div className="h-3.5 w-3/4 bg-neutral-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantError({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <div className="py-6 text-center">
      <AlertTriangle className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
      <p className="text-[13px] text-neutral-500 mb-4 max-w-xs mx-auto">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#C9A96E] hover:text-[#B8964F] transition-colors min-h-[36px]"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Try again
      </button>
    </div>
  );
}

function AssistantContent({
  response,
  onRegenerate,
  regenerating,
}: {
  response: AssistantResponse;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const verdict = VERDICT_CONFIG[response.verdict] ?? VERDICT_CONFIG.good_deal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Verdict + Summary */}
      <div className="flex items-start gap-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border flex-shrink-0 ${verdict.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${verdict.dot}`} />
          {verdict.label}
        </span>
      </div>

      <p className="text-[13px] text-[#0F0F1A] leading-relaxed">
        {response.summary}
      </p>

      {/* Best retailer & best value pills */}
      <div className="flex flex-wrap gap-2">
        {response.bestRetailer && (
          <div className="inline-flex items-center gap-1.5 bg-neutral-50 border border-neutral-100 rounded-full px-3 py-1.5">
            <Store className="w-3 h-3 text-[#C9A96E]" />
            <span className="text-[11px] font-semibold text-[#0F0F1A]">Best price: {response.bestRetailer}</span>
          </div>
        )}
        {response.bestValue && (
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span className="text-[11px] font-semibold text-emerald-700">
              Best value: {formatPrice(response.bestValue.price)} on {response.bestValue.platform}
            </span>
          </div>
        )}
      </div>

      {/* Best value reason */}
      {response.bestValue?.reason && (
        <p className="text-[11px] text-neutral-400 italic leading-relaxed">
          {response.bestValue.reason}
        </p>
      )}

      {/* Insights */}
      <div className="bg-neutral-50/80 rounded-xl border border-neutral-100 px-4 divide-y divide-neutral-100">
        {response.insights.map((insight, i) => (
          <InsightRow key={i} insight={insight} />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-neutral-300 font-medium uppercase tracking-wide">
          {response.provider === 'rule-based' ? 'Rule-based analysis' : `Powered by ${response.provider}`}
          {response.cached ? ' · Cached' : ''}
        </span>
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 hover:text-[#0F0F1A] transition-colors disabled:opacity-50 min-h-[36px]"
          aria-label="Regenerate AI analysis"
        >
          <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
          Regenerate
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AiAssistantCardProps {
  canonicalId: string;
}

export function AiAssistantCard({ canonicalId }: AiAssistantCardProps) {
  const [open, setOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { response, status, error, fetch, regenerate } = useAiAssistant();
  const hasFetched = useRef(false);

  // Fetch when user first opens the card
  useEffect(() => {
    if (open && !hasFetched.current) {
      hasFetched.current = true;
      fetch(canonicalId);
    }
  }, [open, canonicalId, fetch]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerate(canonicalId);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section
      className="bg-white rounded-2xl border border-neutral-100 hover:border-[#C9A96E]/30 transition-all mb-6"
      aria-label="AI Shopping Assistant"
    >
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 sm:p-6 min-h-[56px]"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-[#C9A96E]" />
          <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em]">
            AI Shopping Assistant
          </h2>
          {status === 'success' && response && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${VERDICT_CONFIG[response.verdict]?.color ?? ''}`}>
              {VERDICT_CONFIG[response.verdict]?.label ?? ''}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-neutral-400" />
          : <ChevronDown className="w-4 h-4 text-neutral-400" />}
      </button>

      {/* Body */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-6 pb-6">
              {status === 'loading' && <AssistantSkeleton />}
              {status === 'error' && (
                <AssistantError
                  message={error ?? 'Something went wrong. Please try again.'}
                  onRetry={() => fetch(canonicalId)}
                />
              )}
              {status === 'success' && response && (
                <AssistantContent
                  response={response}
                  onRegenerate={handleRegenerate}
                  regenerating={regenerating}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default AiAssistantCard;
