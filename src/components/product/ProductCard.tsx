import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PlatformBadge from '../ui/PlatformBadge';
import DiscountBadge from '../ui/DiscountBadge';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import type { ProductData } from '../../types/product';

export interface ProductCardProps {
  product: ProductData;
  onCompare?: () => void;
  onSave?: () => void;
  className?: string;
}

export function ProductCard({ product, onSave, className = '' }: ProductCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const discount =
    product.discount ||
    (product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0);

  const priceDelta = product.originalPrice
    ? product.originalPrice - product.price
    : 0;

  async function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    if (saved || saving) return;
    setSaving(true);
    try {
      await api.post('/wishlist', {
        productTitle: product.title,
        imageUrl: product.imageUrl,
        brand: product.brand,
        lowestPrice: product.price,
        lowestPlatform: product.platform,
        sourceUrl: product.url,
      });
      setSaved(true);
      onSave?.();
    } catch { /* already saved */ }
    finally { setSaving(false); }
  }

  function handleCardClick() {
    navigate(`/compare?q=${encodeURIComponent(product.title)}`);
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
      className={[
        'group bg-white rounded-2xl overflow-hidden cursor-pointer flex flex-col',
        'shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_24px_-8px_rgba(0,0,0,0.08)]',
        'hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_20px_40px_-12px_rgba(0,0,0,0.12)]',
        'transition-all duration-200',
        className,
      ].join(' ')}
    >
      {/* Image — consistent 3:4 aspect, unified bg treatment */}
      <div className="relative aspect-[3/4] bg-neutral-50 overflow-hidden">
        {product.imageUrl ? (
          <>
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full object-cover saturate-[0.95] brightness-[1.01]"
              loading="lazy"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const fallback = img.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-full h-full items-center justify-center text-neutral-300 text-5xl absolute inset-0 bg-neutral-50" style={{ display: 'none' }}>
              🛍️
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 text-5xl">
            🛍️
          </div>
        )}

        {/* Subtle top gradient to unify scraped image edges */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/[0.03] to-transparent" />

        {/* Platform Badge — top left */}
        <div className="absolute top-3 left-3">
          <PlatformBadge platform={product.platform} size="sm" />
        </div>

        {/* Save Button — top right */}
        <button
          onClick={handleSave}
          aria-label={saved ? 'Saved' : 'Save to wishlist'}
          className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <Heart className={`w-4 h-4 transition-colors ${saved ? 'fill-red-400 text-red-400' : 'text-neutral-500'}`} />
        </button>

        {/* Discount — bottom left, only if significant */}
        {discount >= 20 && (
          <div className="absolute bottom-3 left-3">
            <DiscountBadge percentage={discount} size="sm" />
          </div>
        )}
      </div>

      {/* Content — asymmetric padding, price as hero */}
      <div className="px-4 pt-3 pb-4 flex flex-col gap-1 flex-1">
        {product.brand && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
            {product.brand}
          </p>
        )}
        <p className="text-[13px] font-medium text-neutral-800 line-clamp-2 leading-[1.35]">
          {product.title}
        </p>

        {/* Price as the hero element */}
        <div className="mt-auto pt-3 flex items-baseline gap-2">
          <span className="text-[20px] font-bold tracking-[-0.02em] text-neutral-900 font-mono">
            ₹{product.price.toLocaleString('en-IN')}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-[12px] text-neutral-400 line-through">
              ₹{product.originalPrice.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Specific micro-copy — delta, not generic "X% off" */}
        {priceDelta > 0 && (
          <p className="text-[11px] text-emerald-600 font-medium">
            ₹{priceDelta.toLocaleString('en-IN')} cheaper on {product.platform}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default ProductCard;
