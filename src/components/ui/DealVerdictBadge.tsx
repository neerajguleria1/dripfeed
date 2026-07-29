/**
 * DealVerdictBadge — displays a coloured pill badge based on a DealVerdict.
 *
 * Renders nothing for null verdicts or 'insufficient_data'.
 * Uses only Tailwind CSS classes — no inline styles, no new CSS files.
 * Fully accessible: aria-label combines badge and detail text.
 */

import type React from 'react';
import type { DealVerdict } from '../../utils/dealVerdict';

interface DealVerdictBadgeProps {
  verdict: DealVerdict | null;
}

const VERDICT_STYLES: Record<string, string> = {
  genuine:     'bg-emerald-50 text-emerald-700 border border-emerald-100',
  inflated_mrp: 'bg-red-50 text-red-700 border border-red-100',
  suspicious:  'bg-amber-50 text-amber-700 border border-amber-100',
};

export function DealVerdictBadge({ verdict }: DealVerdictBadgeProps): React.ReactElement | null {
  if (!verdict || verdict.verdict === 'insufficient_data') return null;

  const colorClass = VERDICT_STYLES[verdict.verdict] ?? '';

  return (
    <span
      className={`inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium leading-tight ${colorClass}`}
      aria-label={`${verdict.badge}: ${verdict.detail}`}
    >
      <span className="font-semibold">{verdict.badge}</span>
      <span className="opacity-80 text-[10px]">{verdict.detail}</span>
    </span>
  );
}

export default DealVerdictBadge;
