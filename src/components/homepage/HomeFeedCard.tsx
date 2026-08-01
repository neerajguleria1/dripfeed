import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import { formatPrice } from '../../utils/formatPrice';
import type { HomeFeedProduct } from '../../types/homeFeed';

export interface HomeFeedCardProps {
  product: HomeFeedProduct;
  /** When true, image loads eagerly (above-the-fold); otherwise lazy */
  eagerLoad?: boolean;
  /** When true, image gets fetchpriority="high" (first 4 visible cards) */
  priority?: boolean;
  className?: string;
}

/** Brand color mapping for platform badge dots */
const PLATFORM_COLORS: Record<string, string> = {
  ajio: '#000000',
  amazon: '#FF9900',
  flipkart: '#2874F0',
  myntra: '#FF3F6C',
  meesho: '#570741',
};

/** Capitalize first letter for display */
function platformLabel(platform: string): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
}

export function HomeFeedCard({ product, eagerLoad = false, priority = false, className = '' }: HomeFeedCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  const hasDiscount =
    product.originalPrice != null && product.originalPrice > product.price;
  const showSavingsLabel =
    product.savings != null && product.savings > 200;
  const discountText = hasDiscount ? `−${product.discount}%` : null;

  const platformColor =
    PLATFORM_COLORS[product.platform.toLowerCase()] || '#6B7280';

  function handleCardClick() {
    navigate(`/compare?q=${encodeURIComponent(product.title)}`);
  }

  function handleCompareClick(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(`/compare?q=${encodeURIComponent(product.title)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  }

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={[
        'group bg-white rounded-2xl overflow-hidden cursor-pointer flex flex-col',
        'shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_24px_-8px_rgba(0,0,0,0.08)]',
        'hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_20px_40px_-12px_rgba(0,0,0,0.12)]',
        'transition-shadow duration-200',
        'min-h-[44px]', // Touch target compliance
        className,
      ].join(' ')}
      aria-label={`${product.title} — ${formatPrice(product.price)} on ${platformLabel(product.platform)}`}
    >
      {/* Image — 3:4 aspect ratio */}
      <div className="relative aspect-[3/4] bg-neutral-50 overflow-hidden">
        {product.imageUrl && !imageError ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            loading={eagerLoad ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-4xl">🛍️</span>
              <span className="text-[10px] text-neutral-400 font-medium tracking-wide text-center px-2">
                {product.brand || product.title.slice(0, 24)}
              </span>
            </div>
          </div>
        )}

        {/* Discount badge — top-right overlay */}
        {discountText && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">
            {discountText}
          </span>
        )}

        {/* Platform badge — bottom-left overlay */}
        <div className="absolute bottom-2 left-2">
          <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-[11px] font-medium text-neutral-700 px-2 py-0.5 rounded-full">
            <span
              className="w-2 h-2 rounded-full inline-block flex-shrink-0"
              style={{ backgroundColor: platformColor }}
              aria-hidden="true"
            />
            {platformLabel(product.platform)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1 flex-1 min-w-0">
        {/* Title — 2-line clamp */}
        <p className="text-[13px] font-medium text-neutral-800 line-clamp-2 leading-[1.35]">
          {product.title}
        </p>

        {/* Price section */}
        <div className="mt-auto pt-2 flex flex-col gap-0.5">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-base font-bold text-neutral-900">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && product.originalPrice != null && (
              <span className="text-xs text-neutral-400 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>

          {/* Save ₹X label */}
          {showSavingsLabel && product.savings != null && (
            <span className="text-[11px] font-semibold text-green-600">
              Save {formatPrice(product.savings)}
            </span>
          )}
        </div>

        {/* Compare button */}
        <button
          onClick={handleCompareClick}
          aria-label={`Compare prices for ${product.title}`}
          className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-800 text-xs font-medium transition-colors min-h-[44px]"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Compare
        </button>
      </div>
    </div>
  );
}

export default HomeFeedCard;
