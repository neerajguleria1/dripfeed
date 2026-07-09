import { formatPrice, calculateDiscount } from '../../utils/formatPrice';

export interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Show discount badge (e.g., "47% off") */
  showDiscount?: boolean;
  /** Show savings line (e.g., "Save ₹1,700") */
  showSavings?: boolean;
  /** Optional platform name for savings context */
  platform?: string;
  /** Layout direction */
  layout?: 'inline' | 'stacked';
  className?: string;
}

const sizeConfig = {
  xs: { price: 'text-xs font-bold', original: 'text-[10px]', badge: 'text-[10px] px-1.5 py-0.5', savings: 'text-[10px]' },
  sm: { price: 'text-sm font-bold', original: 'text-xs', badge: 'text-[11px] px-1.5 py-0.5', savings: 'text-[11px]' },
  md: { price: 'text-base font-bold', original: 'text-sm', badge: 'text-xs px-2 py-0.5', savings: 'text-xs' },
  lg: { price: 'text-xl font-bold', original: 'text-sm', badge: 'text-xs px-2 py-0.5', savings: 'text-xs' },
  xl: { price: 'text-2xl font-bold', original: 'text-base', badge: 'text-sm px-2.5 py-1', savings: 'text-sm' },
};

/**
 * Unified pricing component used across all product cards.
 * Renders: Current Price | Original Price (strikethrough) | Discount % | Savings
 * Ensures consistent spacing, no overlap, and responsive sizing.
 */
export function PriceDisplay({
  price,
  originalPrice,
  size = 'md',
  showDiscount = true,
  showSavings = false,
  platform,
  layout = 'inline',
  className = '',
}: PriceDisplayProps) {
  const config = sizeConfig[size];
  const discount = originalPrice && originalPrice > price
    ? calculateDiscount(originalPrice, price)
    : 0;
  const savings = originalPrice && originalPrice > price
    ? originalPrice - price
    : 0;

  const isStacked = layout === 'stacked';

  return (
    <div className={`flex ${isStacked ? 'flex-col gap-1' : 'flex-wrap items-baseline gap-2'} ${className}`}>
      {/* Row 1: Current price + Original price + Discount badge */}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`${config.price} text-[#0F0F1A] tabular-nums tracking-tight`}>
          {formatPrice(price)}
        </span>

        {originalPrice && originalPrice > price && (
          <span className={`${config.original} text-neutral-400 line-through tabular-nums`}>
            {formatPrice(originalPrice)}
          </span>
        )}

        {showDiscount && discount > 0 && (
          <span className={`${config.badge} inline-flex items-center bg-emerald-50 text-emerald-700 font-medium rounded-full whitespace-nowrap`}>
            {discount}% off
          </span>
        )}
      </div>

      {/* Row 2 (optional): Savings line */}
      {showSavings && savings > 0 && (
        <p className={`${config.savings} text-emerald-600 font-medium`}>
          Save {formatPrice(savings)}{platform ? ` on ${platform}` : ''}
        </p>
      )}
    </div>
  );
}

export default PriceDisplay;
