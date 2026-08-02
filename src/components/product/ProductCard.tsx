/**
 * ProductCard — Premium product card with multi-platform price comparison.
 * Renders product image at 3:4 aspect ratio, brand/title/price typography,
 * discount badge, platform badges sorted by price, and hover elevation.
 *
 * Handles image loading (shimmer skeleton), image error (neutral placeholder
 * with ShoppingBag icon), and navigates to ComparePage on tap.
 *
 * @validates Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.9, 3.10, 4.1, 4.3, 4.5, 4.6, 4.7, 4.8
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { PlatformBadge } from './PlatformBadge';
import type { ValidatedProduct, PlatformOffer } from '../../utils/validateProduct';

// ─── Legacy type support ───
// Pre-existing components pass ProductData which has a different shape.
// We accept both and normalize internally.

/** Loose product shape accepted from legacy components (ProductData, RecentItem, etc.) */
interface LegacyProduct {
  id?: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price?: number;
  originalPrice?: number;
  discount?: number;
  platform?: string;
  url?: string;
  offers?: PlatformOffer[];
  lowestPrice?: number;
  highestPrice?: number;
  highestOriginalPrice?: number;
  discountPercent?: number;
}

type ProductInput = ValidatedProduct | LegacyProduct;

// ─── Props ───

export interface ProductCardProps {
  product: ProductInput;
  eagerLoad?: boolean;
  priority?: boolean;
  onTap?: (product: ValidatedProduct) => void;
  /** Legacy prop from pre-existing components — fires on compare action */
  onCompare?: () => void;
}

/** Normalize any product input to a ValidatedProduct-like shape for rendering */
function normalizeProduct(input: ProductInput): ValidatedProduct {
  // Already a ValidatedProduct (has offers array and lowestPrice)
  if ('offers' in input && Array.isArray(input.offers) && input.offers.length > 0 && 'lowestPrice' in input && typeof input.lowestPrice === 'number') {
    return input as ValidatedProduct;
  }

  // Legacy ProductData: synthesize offers from the single platform entry
  const legacy = input as LegacyProduct;
  const price = legacy.price ?? legacy.lowestPrice ?? 0;
  const platform = (legacy.platform ?? 'unknown') as PlatformOffer['platform'];
  const url = legacy.url ?? '';

  const syntheticOffer: PlatformOffer = {
    platform: (['flipkart', 'myntra', 'amazon', 'meesho', 'ajio'].includes(platform) ? platform : 'flipkart') as PlatformOffer['platform'],
    price,
    originalPrice: legacy.originalPrice,
    url,
  };

  return {
    id: legacy.id ?? `legacy-${Date.now()}`,
    title: legacy.title ?? '',
    brand: legacy.brand,
    imageUrl: legacy.imageUrl ?? '',
    offers: legacy.offers && legacy.offers.length > 0 ? legacy.offers : [syntheticOffer],
    lowestPrice: legacy.lowestPrice ?? price,
    highestPrice: legacy.highestPrice ?? price,
    highestOriginalPrice: legacy.highestOriginalPrice ?? legacy.originalPrice,
    discountPercent: legacy.discountPercent ?? legacy.discount,
  };
}

// ─── Shimmer Keyframes (injected once) ───

const SHIMMER_STYLE_ID = 'product-card-shimmer';

function ensureShimmerStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes pc-shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Component ───

export function ProductCard({ product: rawProduct, eagerLoad = false, priority = false, onTap }: ProductCardProps) {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Normalize input to ValidatedProduct shape
  const product = normalizeProduct(rawProduct);

  // Ensure shimmer keyframes exist in document
  ensureShimmerStyle();

  // Sort offers by ascending price
  const sortedOffers = [...product.offers].sort((a, b) => a.price - b.price);
  const isMultiPlatform = sortedOffers.length > 1;

  // Navigation handler
  const handleTap = () => {
    if (onTap) {
      onTap(product);
    }
    navigate(`/compare?id=${encodeURIComponent(product.id)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTap();
    }
  };

  // Image handlers
  const handleImageLoad = useCallback(() => setImageLoaded(true), []);
  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true); // Stop shimmer
  }, []);

  // Format price with Indian locale
  const formatPrice = (amount: number): string =>
    `₹${amount.toLocaleString('en-IN')}`;

  return (
    <div
      onClick={handleTap}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${product.title} - ${formatPrice(product.lowestPrice)}`}
      className={[
        'group relative flex flex-col bg-white rounded-xl overflow-hidden cursor-pointer',
        'border border-neutral-100',
        'hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)]',
        'hover:scale-[1.02]',
        'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
      ].join(' ')}
    >
      {/* ─── Image Container ─── */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-xl">
        {/* Shimmer skeleton — visible while loading */}
        {!imageLoaded && !imageError && (
          <div
            className="absolute inset-0 rounded-t-xl"
            style={{
              background: 'linear-gradient(90deg, #f5f5f5 25%, #e5e5e5 50%, #f5f5f5 75%)',
              backgroundSize: '800px 100%',
              animation: 'pc-shimmer 1.5s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
        )}

        {/* Actual image */}
        {!imageError && (
          <img
            src={product.imageUrl}
            alt={product.title}
            loading={eagerLoad || priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={[
              'w-full h-full object-cover rounded-[12px]',
              'transition-opacity duration-300',
              imageLoaded ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          />
        )}

        {/* Error placeholder — neutral-200 with ShoppingBag icon */}
        {imageError && (
          <div className="absolute inset-0 bg-neutral-200 flex items-center justify-center rounded-t-xl">
            <ShoppingBag className="w-10 h-10 text-neutral-400" strokeWidth={1.5} />
          </div>
        )}

        {/* Discount badge — top-left */}
        {product.discountPercent != null && product.discountPercent > 0 && (
          <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[11px] font-bold px-2 py-0.5 rounded">
            −{product.discountPercent}%
          </span>
        )}
      </div>

      {/* ─── Content ─── */}
      <div className="p-3 flex flex-col gap-0.5">
        {/* Brand */}
        {product.brand && (
          <p className="text-[11px] uppercase tracking-[0.5px] text-neutral-400 leading-tight">
            {product.brand}
          </p>
        )}

        {/* Title */}
        <p className="text-[14px] font-medium text-neutral-800 line-clamp-2 leading-snug">
          {product.title}
        </p>

        {/* Primary price (lowest) */}
        <p className="text-[16px] font-bold font-serif text-neutral-900 mt-1">
          {formatPrice(product.lowestPrice)}
        </p>

        {/* Price range — only for multi-platform products */}
        {isMultiPlatform && (
          <p className="text-[12px] text-neutral-500">
            {formatPrice(product.lowestPrice)} – {formatPrice(product.highestPrice)}
          </p>
        )}

        {/* Platform badges — sorted by ascending price, max 5 */}
        <div className="flex gap-1 mt-2">
          {sortedOffers.slice(0, 5).map((offer, i) => (
            <PlatformBadge
              key={offer.platform}
              platform={offer.platform}
              size="sm"
              isLowest={isMultiPlatform && i === 0}
              showName={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
