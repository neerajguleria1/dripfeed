import { useState, useMemo } from 'react';
import { formatPrice } from '../../utils/formatPrice';

export interface PriceHistoryPoint {
  date: string;
  price: number;
  platform: string;
}

export interface PriceHistoryProps {
  history: PriceHistoryPoint[];
  className?: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  myntra: '#FF3F6C',
  ajio: '#000000',
  amazon: '#FF9900',
  flipkart: '#2874F0',
  nykaa: '#FC2779',
  meesho: '#570A57',
  bewakoof: '#FDD835',
  shein: '#333333',
  tatacliq: '#1F2937',
};

function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform.toLowerCase()] || '#6B7280';
}

export function PriceHistory({ history, className = '' }: PriceHistoryProps) {
  const [hoverPoint, setHoverPoint] = useState<{
    x: number;
    y: number;
    date: string;
    price: number;
    platform: string;
  } | null>(null);

  const { platforms, minPrice, maxPrice, dateLabels, lowestPoint } = useMemo(() => {
    if (!history || history.length === 0) {
      return { platforms: [], minPrice: 0, maxPrice: 0, dateLabels: [], lowestPoint: null };
    }

    const grouped: Record<string, PriceHistoryPoint[]> = {};
    history.forEach((point) => {
      if (!grouped[point.platform]) grouped[point.platform] = [];
      grouped[point.platform].push(point);
    });

    const allPrices = history.map((p) => p.price);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);

    // Sort each platform's points by date
    Object.values(grouped).forEach((points) =>
      points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    );

    // Date labels: first, middle, last from sorted dates
    const sortedDates = [...new Set(history.map((p) => p.date))].sort();
    const labels: string[] = [];
    if (sortedDates.length >= 1) labels.push(sortedDates[0]);
    if (sortedDates.length >= 3) labels.push(sortedDates[Math.floor(sortedDates.length / 2)]);
    if (sortedDates.length >= 2) labels.push(sortedDates[sortedDates.length - 1]);

    // Find lowest point
    const lowest = history.reduce((low, p) => (p.price < low.price ? p : low), history[0]);

    return {
      platforms: grouped,
      minPrice: min,
      maxPrice: max,
      dateLabels: labels,
      lowestPoint: lowest,
    };
  }, [history]);

  if (!history || history.length === 0) {
    return (
      <div className={['bg-gray-50 rounded-xl p-6 text-center', className].filter(Boolean).join(' ')}>
        <p className="text-sm text-gray-400">
          Price history will appear after tracking begins
        </p>
      </div>
    );
  }

  const svgWidth = 600;
  const svgHeight = 160;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const drawWidth = svgWidth - padding.left - padding.right;
  const drawHeight = svgHeight - padding.top - padding.bottom;
  const priceRange = maxPrice - minPrice || 1;

  // Sort all dates for x-axis mapping
  const allDates = [...new Set(history.map((p) => p.date))].sort();
  const dateCount = allDates.length;

  function getX(date: string): number {
    const index = allDates.indexOf(date);
    return padding.left + (index / Math.max(dateCount - 1, 1)) * drawWidth;
  }

  function getY(price: number): number {
    return padding.top + drawHeight - ((price - minPrice) / priceRange) * drawHeight;
  }

  function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-40"
        onMouseLeave={() => setHoverPoint(null)}
      >
        {/* Y-axis labels */}
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" className="text-[10px] fill-gray-400">
          {formatPrice(maxPrice)}
        </text>
        <text x={padding.left - 8} y={padding.top + drawHeight + 4} textAnchor="end" className="text-[10px] fill-gray-400">
          {formatPrice(minPrice)}
        </text>

        {/* X-axis date labels */}
        {dateLabels.map((date, i) => (
          <text
            key={i}
            x={getX(date)}
            y={svgHeight - 5}
            textAnchor="middle"
            className="text-[10px] fill-gray-400"
          >
            {formatDateLabel(date)}
          </text>
        ))}

        {/* Grid lines */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left + drawWidth}
          y2={padding.top}
          stroke="#E5E7EB"
          strokeWidth="0.5"
          strokeDasharray="4"
        />
        <line
          x1={padding.left}
          y1={padding.top + drawHeight}
          x2={padding.left + drawWidth}
          y2={padding.top + drawHeight}
          stroke="#E5E7EB"
          strokeWidth="0.5"
          strokeDasharray="4"
        />

        {/* Platform lines */}
        {Object.entries(platforms).map(([platform, points]) => {
          const color = getPlatformColor(platform);
          const pathData = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.date)} ${getY(p.price)}`)
            .join(' ');

          return (
            <g key={platform}>
              <path
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Hover circles */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={getX(p.date)}
                  cy={getY(p.price)}
                  r="4"
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth="8"
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setHoverPoint({
                      x: getX(p.date),
                      y: getY(p.price),
                      date: p.date,
                      price: p.price,
                      platform: p.platform,
                    })
                  }
                />
              ))}
            </g>
          );
        })}

        {/* Lowest point green dot */}
        {lowestPoint && (
          <circle
            cx={getX(lowestPoint.date)}
            cy={getY(lowestPoint.price)}
            r="4"
            fill="#22C55E"
            stroke="white"
            strokeWidth="2"
          />
        )}

        {/* Hover tooltip */}
        {hoverPoint && (
          <g>
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4" fill={getPlatformColor(hoverPoint.platform)} stroke="white" strokeWidth="2" />
            <rect
              x={hoverPoint.x - 55}
              y={hoverPoint.y - 40}
              width="110"
              height="30"
              rx="4"
              fill="white"
              stroke="#E5E7EB"
              strokeWidth="1"
            />
            <text x={hoverPoint.x} y={hoverPoint.y - 26} textAnchor="middle" className="text-[9px] fill-gray-600 font-medium">
              {hoverPoint.platform} · {formatPrice(hoverPoint.price)}
            </text>
            <text x={hoverPoint.x} y={hoverPoint.y - 15} textAnchor="middle" className="text-[8px] fill-gray-400">
              {formatDateLabel(hoverPoint.date)}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 px-2">
        {Object.keys(platforms).map((platform) => (
          <div key={platform} className="flex items-center gap-1.5">
            <span
              className="w-3 h-0.5 rounded-full"
              style={{ backgroundColor: getPlatformColor(platform) }}
            />
            <span className="text-xs text-gray-500 capitalize">{platform}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PriceHistory;
