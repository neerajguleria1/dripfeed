import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { ProductSkeleton } from '../ui/ProductSkeleton';
import type { RecentItem } from '../../hooks/useRecentlyViewed';

interface RecentlyViewedSectionProps {
  items: RecentItem[];
  loading?: boolean;
  /** Compact variant for the product detail page (no section heading padding) */
  compact?: boolean;
}

/**
 * RecentlyViewedSection
 *
 * Horizontal scroll on mobile, 4-column grid on desktop.
 * Reuses ProductCard and ProductSkeleton — no new card components.
 */
export function RecentlyViewedSection({
  items,
  loading = false,
  compact = false,
}: RecentlyViewedSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!loading && !items.length) return null;

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  }

  return (
    <section
      aria-label="Recently Viewed"
      className={compact ? 'mb-6' : 'py-10 sm:py-14 bg-[#FAFAFA] border-t border-neutral-100'}
    >
      <div className={compact ? '' : 'max-w-6xl mx-auto px-5 sm:px-8'}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={compact
            ? 'text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em]'
            : 'text-[18px] sm:text-[22px] font-bold text-[#171310] tracking-[-0.01em]'
          }>
            Recently Viewed
          </h2>
          {!compact && (
            <div className="flex gap-1" role="group" aria-label="Scroll recently viewed">
              <button
                onClick={() => scroll('left')}
                aria-label="Scroll left"
                className="w-8 h-8 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:border-[#C9A96E] transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-neutral-500" />
              </button>
              <button
                onClick={() => scroll('right')}
                aria-label="Scroll right"
                className="w-8 h-8 rounded-full bg-white border border-neutral-200 flex items-center justify-center hover:border-[#C9A96E] transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
          )}
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[160px] sm:w-[180px]">
                <ProductSkeleton />
              </div>
            ))}
          </div>
        )}

        {/* Items — horizontal scroll on mobile, grid on sm+ */}
        {!loading && items.length > 0 && (
          <div
            ref={scrollRef}
            role="list"
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-5 px-5 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 lg:grid-cols-5 sm:overflow-visible"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {items.map(item => (
              <div
                key={item.id}
                role="listitem"
                className="flex-shrink-0 w-[160px] sm:w-auto"
                style={{ scrollSnapAlign: 'start' }}
              >
                <ProductCard product={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
