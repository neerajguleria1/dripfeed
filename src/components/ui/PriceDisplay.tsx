import { formatPrice, calculateDiscount } from '../../utils/formatPrice';

export interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDiscount?: boolean;
  className?: string;
}

const sizeClasses: Record<NonNullable<PriceDisplayProps['size']>, { price: string; original: string }> = {
  sm: { price: 'text-sm', original: 'text-xs' },
  md: { price: 'text-base', original: 'text-sm' },
  lg: { price: 'text-xl font-bold', original: 'text-sm' },
  xl: { price: 'text-2xl font-bold', original: 'text-base' },
};

export function PriceDisplay({
  price,
  originalPrice,
  size = 'md',
  showDiscount = false,
  className = '',
}: PriceDisplayProps) {
  const { price: priceClass, original: originalClass } = sizeClasses[size];
  const discount = originalPrice ? calculateDiscount(originalPrice, price) : 0;

  return (
    <span
      className={[
        'inline-flex items-center gap-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={priceClass}
        style={{ color: 'var(--df-accent-navy)' }}
      >
        {formatPrice(price)}
      </span>

      {originalPrice && originalPrice > price && (
        <span className={['line-through text-gray-400', originalClass].join(' ')}>
          {formatPrice(originalPrice)}
        </span>
      )}

      {showDiscount && discount > 0 && (
        <span className="text-xs font-medium bg-green-500 text-white px-1.5 py-0.5 rounded-full">
          {discount}% off
        </span>
      )}
    </span>
  );
}

export default PriceDisplay;
