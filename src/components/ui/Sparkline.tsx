export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showLowestDot?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color,
  showLowestDot = false,
  className = '',
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const strokeColor = color || 'var(--df-accent-navy)';

  // Normalize data points to SVG coordinates with small padding
  const padding = 2;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * drawWidth;
    const y = padding + drawHeight - ((value - min) / range) * drawHeight;
    return { x, y, value };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Find lowest point for the optional dot
  const minPoint = points.reduce(
    (lowest, p) => (p.value < lowest.value ? p : lowest),
    points[0],
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {showLowestDot && (
        <circle
          cx={minPoint.x}
          cy={minPoint.y}
          r="2"
          fill="#22C55E"
        />
      )}
    </svg>
  );
}

export default Sparkline;
