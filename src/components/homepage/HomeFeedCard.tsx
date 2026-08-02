import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, ExternalLink } from 'lucide-react';
import { formatPrice } from '../../utils/formatPrice';
import type { HomeFeedProduct, HomeFeedOffer } from '../../types/homeFeed';

export interface HomeFeedCardProps {
  product: HomeFeedProduct;
  eagerLoad?: boolean;
  priority?: boolean;
  className?: string;
}

/** Brand colors for platform badges */
const PLATFORM_COLORS: Record<string, string> = {
  ajio: '#000000',
  'amazon india': '#FF9900',
  amazon: '#FF9900',
  flipkart: '#2874F0',
  myntra: '#FF3F6C',
  meesho: '#570741',
  nykaa: '#FC2779',
};

/** Short platform name for compact display */
function shortPlatform(platform: string): string {
  const name = platform.toLowerCase();
  if (name.includes('amazon')) return 'Amazon';
  if (name.includes('flipkart')) return 'Flipkart';
  if (name.includes('myntra')) return 'Myntra';
  if (name.includes('ajio')) return 'Ajio';
  if (name.includes('meesho')) return 'Meesho';
  if (name.includes('nykaa')) return 'Nykaa';
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function getPlatformColor(platform: string): string {
  const key = platform.toLowerCase();
  return PLATFORM_COLORS[key] || 
    Object.entries(PLATFORM_COLORS).find(([k]) => key.includes(k))?.[1] || 
    '#6B7280';
}

export function HomeFeedCard({ product, eagerLoad = false, priority = false, className = '' }: HomeFeedCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  const offers = product.offers || [];
  const hasMultipleOffers = offers.length > 1;
  const bestPrice = product.price;
  const worstPrice = offers.length > 1 
    ? Math.max(...offers.map(o => o.price)) 
    : product.originalPrice || product.price;
  const maxSavings = worstPrice - bestPrice;

  function handleCardClick() {
    navigate(`/compare?q=${encodeURIComponent(product.title)}`);
  }

  function handlePlatformClick(e: React.MouseEvent, url: string) {
    e.stopPropagation();
    if (url) window.open(url, '_blank', 'noopener');
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
        'border border-neutral-100',
        'hover:border-neutral-200 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)]',
        'transition-all duration-200',
        className,
      ].join(' ')}
      aria-label={`${product.title} — from ${formatPrice(product.price)}`}
    >
      {/* Image — 4:5 aspect ratio for better product visibility */}
      <div className="relative aspect-[4/5] bg-neutral-50 overflow-hidden">
        {product.imageUrl && !imageError ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            loading={eagerLoad ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            className="w-full h-full object-contain p-2"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-100">
            <span className="text-3xl">👗</span>
          </div>
        )}

        {/* Discount badge */}
        {product.discount > 0 && (
          <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
            {product.discount}% OFF
          </span>
        )}

        {/* Platform count badge */}
        {hasMultipleOffers && (
          <span className="absolute top-2 right-2 bg-[#1A1A2E] text-white text-[10px] font-medium px-2 py-0.5 rounded-md">
            {offers.length} stores
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-3 pt-3 pb-3 flex flex-col gap-2 flex-1">
        {/* Brand */}
        {product.brand && (
          <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide truncate">
            {product.brand}
          </p>
        )}

        {/* Title */}
        <p className="text-[13px] font-medium text-neutral-800 line-clamp-2 leading-snug">
          {product.title}
        </p>

        {/* Price section — show best price prominently */}
        <div className="mt-auto pt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-bold text-neutral-900">
              {formatPrice(bestPrice)}
            </span>
            {product.originalPrice && product.originalPrice > bestPrice && (
              <span className="text-[12px] text-neutral-400 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          {maxSavings > 100 && (
            <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
              Save up to {formatPrice(maxSavings)}
            </p>
          )}
        </div>

        {/* Platform prices — the key differentiator */}
        {offers.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {offers.slice(0, 4).map((offer: HomeFeedOffer, idx: number) => (
              <div
                key={`${offer.platform}_${idx}`}
                className={[
                  'flex items-center justify-between py-1.5 px-2 rounded-lg text-[12px]',
                  idx === 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-neutral-50',
                ].join(' ')}
                onClick={(e) => handlePlatformClick(e, offer.affiliateUrl || offer.url || '')}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getPlatformColor(offer.platform) }}
                  />
                  <span className={idx === 0 ? 'font-semibold text-emerald-800' : 'text-neutral-600'}>
                    {shortPlatform(offer.platform)}
                  </span>
                  {idx === 0 && (
                    <span className="text-[9px] bg-emerald-500 text-white px-1 py-0.5 rounded font-bold uppercase">
                      Best
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className={idx === 0 ? 'font-bold text-emerald-800' : 'font-semibold text-neutral-700'}>
                    {formatPrice(offer.price)}
                  </span>
                  <ExternalLink className="w-3 h-3 text-neutral-400" />
                </div>
              </div>
            ))}
            {offers.length > 4 && (
              <p className="text-[11px] text-neutral-400 text-center">
                +{offers.length - 4} more stores
              </p>
            )}
          </div>
        )}

        {/* Compare button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
          aria-label={`Compare all prices for ${product.title}`}
          className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[#1A1A2E] hover:bg-[#2a2a4e] text-white text-[12px] font-medium transition-colors min-h-[44px]"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Compare All Prices
        </button>
      </div>
    </div>
  );
}

export default HomeFeedCard;
