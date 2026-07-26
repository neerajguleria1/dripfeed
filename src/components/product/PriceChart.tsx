import { useState, useMemo, useCallback, useId } from 'react';
import type { HistoryPoint } from '../../hooks/usePriceHistory';
import { formatPrice } from '../../utils/formatPrice';

const PLATFORM_COLORS: Record<string, string> = {
  'amazon india': '#FF9900',
  amazon:         '#FF9900',
  flipkart:       '#2874F0',
  myntra:         '#FF3F6C',
  ajio:           '#1A1A1A',
  meesho:         '#570741',
};

function platformColor(p: string): string {
  return PLATFORM_COLORS[p.toLowerCase()] ?? '#6B7280';
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export interface PriceChartProps {
  points: HistoryPoint[];
  days: 30 | 90;
  onDaysChange: (d: 30 | 90) => void;
  className?: string;
}

interface TooltipState {
  x: number;
  y: number;
  price: number;
  platform: string;
  date: string;
  side: 'left' | 'right';
}

const W = 560;
const H = 140;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };
const DW = W - PAD.left - PAD.right;
const DH = H - PAD.top - PAD.bottom;

export function PriceChart({ points, days, onDaysChange, className = '' }: PriceChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const gradId = useId().replace(/:/g, '');

  const { byPlatform, allDates, minP, maxP, lowestPoint } = useMemo(() => {
    if (!points.length) return { byPlatform: {} as Record<string, HistoryPoint[]>, allDates: [] as string[], minP: 0, maxP: 0, lowestPoint: null as HistoryPoint | null };

    const grouped: Record<string, HistoryPoint[]> = {};
    for (const pt of points) {
      const key = pt.platform.toLowerCase();
      (grouped[key] ??= []).push(pt);
    }
    for (const arr of Object.values(grouped)) {
      arr.sort((a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime());
    }

    const prices = points.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    const dates = [...new Set(points.map(p => p.fetchedAt))].sort();
    const lowest = points.reduce((l, p) => p.price < l.price ? p : l, points[0]);

    return { byPlatform: grouped, allDates: dates, minP: min, maxP: max, lowestPoint: lowest };
  }, [points]);

  const getX = useCallback((iso: string) => {
    const i = allDates.indexOf(iso);
    return PAD.left + (i / Math.max(allDates.length - 1, 1)) * DW;
  }, [allDates]);

  const getY = useCallback((price: number) => {
    const range = maxP - minP || 1;
    return PAD.top + DH - ((price - minP) / range) * DH;
  }, [minP, maxP]);

  const axisLabels = useMemo(() => {
    if (allDates.length === 0) return [];
    const out: string[] = [allDates[0]];
    if (allDates.length > 2) out.push(allDates[Math.floor(allDates.length / 2)]);
    if (allDates.length > 1) out.push(allDates[allDates.length - 1]);
    return out;
  }, [allDates]);

  if (!points.length) return null;

  return (
    <div className={className}>
      {/* Period tabs */}
      <div className="flex items-center gap-1 mb-3" role="group" aria-label="History period">
        {([30, 90] as const).map(d => (
          <button
            key={d}
            onClick={() => onDaysChange(d)}
            aria-pressed={days === d}
            className={[
              'px-3 py-1 rounded-full text-[11px] font-semibold transition-colors',
              days === d
                ? 'bg-[#171310] text-white dark:bg-white dark:text-[#171310]'
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300',
            ].join(' ')}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 140 }}
        onMouseLeave={() => setTooltip(null)}
        role="img"
        aria-label={`Price history chart for the last ${days} days`}
      >
        <defs>
          <linearGradient id={`grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A96E" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#C9A96E" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map(t => {
          const y = PAD.top + t * DH;
          const price = maxP - t * (maxP - minP);
          return (
            <g key={t}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + DW} y2={y}
                stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"
                className="text-neutral-900 dark:text-white"
              />
              <text
                x={PAD.left - 6} y={y + 4}
                textAnchor="end"
                fontSize="9"
                className="fill-neutral-400 dark:fill-neutral-500"
              >
                {formatPrice(price)}
              </text>
            </g>
          );
        })}

        {/* X-axis date labels */}
        {axisLabels.map(date => (
          <text
            key={date}
            x={getX(date)} y={H - 6}
            textAnchor="middle"
            fontSize="9"
            className="fill-neutral-400 dark:fill-neutral-500"
          >
            {fmtDate(date)}
          </text>
        ))}

        {/* Platform lines + area fill for first platform */}
        {Object.entries(byPlatform).map(([platform, pts], idx) => {
          const color = platformColor(platform);
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${getX(p.fetchedAt)},${getY(p.price)}`).join(' ');

          // Area fill only for the first (or only) platform
          const areaD = idx === 0 && pts.length > 1
            ? `${d} L${getX(pts[pts.length - 1].fetchedAt)},${PAD.top + DH} L${getX(pts[0].fetchedAt)},${PAD.top + DH} Z`
            : null;

          return (
            <g key={platform}>
              {areaD && (
                <path d={areaD} fill={`url(#grad-${gradId})`} />
              )}
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Invisible wide hit targets for hover */}
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={getX(p.fetchedAt)}
                  cy={getY(p.price)}
                  r="8"
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => {
                    const cx = getX(p.fetchedAt);
                    setTooltip({
                      x: cx, y: getY(p.price),
                      price: p.price, platform, date: p.fetchedAt,
                      side: cx > W * 0.65 ? 'left' : 'right',
                    });
                  }}
                />
              ))}
            </g>
          );
        })}

        {/* Lowest price green dot */}
        {lowestPoint && (
          <g>
            <circle
              cx={getX(lowestPoint.fetchedAt)}
              cy={getY(lowestPoint.price)}
              r="5"
              fill="#22C55E"
              stroke="white"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Hover tooltip */}
        {tooltip && (() => {
          const TW = 108, TH = 34;
          const tx = tooltip.side === 'left' ? tooltip.x - TW - 8 : tooltip.x + 8;
          const ty = Math.max(PAD.top, tooltip.y - TH / 2);
          return (
            <g>
              <line
                x1={tooltip.x} y1={PAD.top}
                x2={tooltip.x} y2={PAD.top + DH}
                stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"
                strokeDasharray="3"
                className="text-neutral-900 dark:text-white"
              />
              <circle
                cx={tooltip.x} cy={tooltip.y} r="4"
                fill={platformColor(tooltip.platform)}
                stroke="white" strokeWidth="2"
              />
              <rect
                x={tx} y={ty} width={TW} height={TH} rx="6"
                fill="white" stroke="#E5E7EB" strokeWidth="1"
                className="drop-shadow-sm"
              />
              <text x={tx + TW / 2} y={ty + 13} textAnchor="middle" fontSize="10" fontWeight="600"
                className="fill-neutral-800">
                {formatPrice(tooltip.price)}
              </text>
              <text x={tx + TW / 2} y={ty + 26} textAnchor="middle" fontSize="9"
                className="fill-neutral-400">
                {fmtDateFull(tooltip.date)} · {tooltip.platform}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Platform legend */}
      {Object.keys(byPlatform).length > 1 && (
        <div className="flex flex-wrap gap-3 mt-2 px-1" aria-label="Platform legend">
          {Object.keys(byPlatform).map(p => (
            <div key={p} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: platformColor(p) }} />
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 capitalize">{p}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Lowest</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PriceChart;
