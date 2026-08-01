import { useState, useEffect, useMemo } from 'react';
import { HomeFeedCard } from './HomeFeedCard';
import type { HomeFeedProduct } from '../../types/homeFeed';

export interface HomeProductGridProps {
  products: HomeFeedProduct[];
  loading: boolean;
}

/**
 * Determines column count based on viewport width.
 * - <640px: 2 columns (mobile)
 * - 640–1024px: 3 columns (tablet)
 * - >1024px: 4 columns (desktop)
 */
function useColumns(): number {
  const [columns, setColumns] = useState(() => {
    if (typeof window === 'undefined') return 2;
    const w = window.innerWidth;
    if (w > 1024) return 4;
    if (w >= 640) return 3;
    return 2;
  });

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w > 1024) setColumns(4);
      else if (w >= 640) setColumns(3);
      else setColumns(2);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return columns;
}

/**
 * Skeleton placeholder mimicking HomeFeedCard layout:
 * 3:4 image area + title line + price line with pulse animation.
 */
function HomeFeedSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_24px_-8px_rgba(0,0,0,0.08)] animate-[pulse_1.5s_ease-in-out_infinite]">
      {/* Image placeholder — 3:4 aspect */}
      <div className="aspect-[3/4] w-full bg-neutral-100" />

      {/* Content area */}
      <div className="p-3 space-y-2.5">
        {/* Title line */}
        <div className="h-3 w-4/5 rounded bg-neutral-200" />
        {/* Price line */}
        <div className="h-4 w-1/3 rounded bg-neutral-300" />
      </div>
    </div>
  );
}

/**
 * Responsive product grid for the homepage above-the-fold area.
 *
 * - 2 columns mobile (<640px), 3 columns tablet (640–1024px), 4 columns desktop (>1024px)
 * - Gap: 8px mobile, 12px desktop
 * - Shows skeleton placeholders during loading (min 6 mobile, 8 desktop)
 * - Fade-in transition (300ms) when swapping skeletons for real cards
 * - First `columns * 2` images loaded eagerly (above fold), rest lazy
 */
export function HomeProductGrid({ products, loading }: HomeProductGridProps) {
  const columns = useColumns();
  const [showContent, setShowContent] = useState(!loading);

  // Trigger fade-in when loading completes
  useEffect(() => {
    if (!loading && products.length > 0) {
      // Small delay to ensure DOM swap triggers CSS transition
      const raf = requestAnimationFrame(() => {
        setShowContent(true);
      });
      return () => cancelAnimationFrame(raf);
    }
    if (loading) {
      setShowContent(false);
    }
  }, [loading, products.length]);

  // Skeleton count: minimum 6 on mobile, 8 on desktop
  const skeletonCount = useMemo(() => {
    if (columns <= 2) return Math.max(6, columns * 3);
    return Math.max(8, columns * 2);
  }, [columns]);

  // Above-fold threshold: first columns * 2 images are eager
  const eagerThreshold = columns * 2;

  // Grid classes: responsive columns
  const gridClasses = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3';

  if (loading) {
    return (
      <div className={gridClasses}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <HomeFeedSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${gridClasses} transition-opacity duration-300 ease-in-out`}
      style={{ opacity: showContent ? 1 : 0 }}
    >
      {products.map((product, i) => (
        <HomeFeedCard
          key={product.id}
          product={product}
          eagerLoad={i < eagerThreshold}
          priority={i < 4}
        />
      ))}
    </div>
  );
}

export default HomeProductGrid;
