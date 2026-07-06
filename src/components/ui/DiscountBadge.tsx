export interface DiscountBadgeProps {
  percentage: number;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeClasses: Record<NonNullable<DiscountBadgeProps['size']>, string> = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-0.5',
};

export function DiscountBadge({
  percentage,
  size = 'sm',
  className = '',
}: DiscountBadgeProps) {
  if (percentage <= 0) return null;

  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-bold bg-red-500 text-white',
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {percentage}% off
    </span>
  );
}

export default DiscountBadge;
