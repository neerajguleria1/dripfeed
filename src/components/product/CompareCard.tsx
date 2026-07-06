import { motion } from 'framer-motion';
import PlatformBadge from '../ui/PlatformBadge';
import PriceDisplay from '../ui/PriceDisplay';
import AffiliateButton from '../ui/AffiliateButton';
import { formatPrice } from '../../utils/formatPrice';

export interface CompareCardProps {
  platform: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  url: string;
  productName: string;
  delivery?: string;
  returnPolicy?: string;
  isLowest?: boolean;
  maxPrice?: number;
  className?: string;
}

export function CompareCard({
  platform,
  price,
  originalPrice,
  url,
  productName,
  delivery,
  returnPolicy,
  isLowest = false,
  maxPrice,
  className = '',
}: CompareCardProps) {
  const savings = maxPrice && maxPrice > price ? maxPrice - price : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={[
        'bg-white/55 backdrop-blur-sm rounded-2xl p-4',
        'flex flex-col sm:flex-row sm:items-center gap-4',
        'border-2 transition-all',
        isLowest
          ? 'border-l-4 border-green-500 shadow-md shadow-green-100'
          : 'border-gray-200/60',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Best price badge - mobile */}
      {isLowest && (
        <div className="flex items-center gap-1 sm:hidden">
          <span className="inline-flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
            BEST PRICE
          </span>
        </div>
      )}

      {/* Platform badge (left) */}
      <div className="flex items-center gap-3 sm:w-28 flex-shrink-0">
        <PlatformBadge platform={platform} size="md" />
        {/* Best price badge - desktop */}
        {isLowest && (
          <span className="hidden sm:inline-flex items-center gap-1 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
            BEST PRICE
          </span>
        )}
      </div>

      {/* Price info (center) */}
      <div className="flex-1 min-w-0">
        <PriceDisplay
          price={price}
          originalPrice={originalPrice}
          size="lg"
          showDiscount
        />
        <div className="flex flex-wrap items-center gap-3 mt-1">
          {delivery && (
            <span className="text-xs text-gray-500">{delivery}</span>
          )}
          {returnPolicy && (
            <span className="text-xs text-gray-500">{returnPolicy}</span>
          )}
          {savings > 0 && (
            <span className="text-xs text-green-600 font-medium">
              Save {formatPrice(savings)}
            </span>
          )}
        </div>
      </div>

      {/* Affiliate button (right) */}
      <div className="flex-shrink-0 w-full sm:w-44">
        <AffiliateButton
          platform={platform}
          url={url}
          productTitle={productName}
          fullWidth
        />
      </div>
    </motion.div>
  );
}

export default CompareCard;
