import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import Analytics from '../../utils/analytics';
import type { ScoredProduct } from '../../hooks/useRecommendations';

interface RecommendationSectionProps {
  title: string;
  items: ScoredProduct[];
  'aria-label'?: string;
}

export function RecommendationSection({
  title,
  items,
  'aria-label': ariaLabel,
}: RecommendationSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);

  // Track section viewed once on mount
  useEffect(() => {
    if (!viewedRef.current && items.length > 0) {
      viewedRef.current = true;
      Analytics.recommendationSectionViewed(title);
    }
  }, [items.length, title]);

  if (!items.length) return null;

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  }

  return (
    <section aria-label={ariaLabel ?? title} className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em]">
          {title}
        </h2>
        <div className="flex gap-1" role="group" aria-label={`Scroll ${title}`}>
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            className="w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:border-[#C9A96E] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-neutral-500" />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            className="w-7 h-7 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:border-[#C9A96E] transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        role="list"
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-3 px-3 sm:mx-0 sm:px-0"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {items.map(({ product, reason }) => {
          const offer = product.offers[0];
          if (!offer) return null;
          return (
            <div
              key={product.id}
              role="listitem"
              className="flex-shrink-0 w-[160px] sm:w-[180px]"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Reason badge */}
              <div className="mb-1.5">
                <span className="inline-flex items-center text-[10px] font-semibold text-[#C9A96E] bg-[#C9A96E]/8 px-2 py-0.5 rounded-full border border-[#C9A96E]/20 truncate max-w-full">
                  {reason}
                </span>
              </div>
              <ProductCard
                product={{
                  id: product.id,
                  title: product.title,
                  brand: product.brand,
                  imageUrl: offer.imageUrl,
                  price: offer.price,
                  originalPrice: offer.originalPrice,
                  discount: offer.discount,
                  platform: offer.platform,
                  url: offer.affiliateUrl || offer.productUrl,
                }}
                onCompare={() => Analytics.recommendationClicked(product.id, title, product.title)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function RecommendationSkeleton({ title }: { title: string }) {
  return (
    <section aria-label={title} aria-busy="true" className="mb-6">
      <div className="h-3 w-32 bg-neutral-100 rounded-full mb-3 animate-pulse" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[160px] animate-pulse">
            <div className="aspect-[3/4] bg-neutral-100 rounded-2xl mb-2" />
            <div className="h-2.5 bg-neutral-100 rounded-full w-3/4 mb-1.5" />
            <div className="h-3 bg-neutral-100 rounded-full w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}
