/**
 * DealsPage (HomePage) — Primary landing page for TagCheck.
 * Displays real validated products from the useHomeFeed hook in a masonry grid.
 * No seed data is referenced or rendered.
 *
 * Features:
 * - Category chips for filtering (All, Women, Men, Kids, Ethnic, Western, Footwear, Accessories)
 * - SkeletonLoader during loading state
 * - MasonryGrid with ProductCard components for loaded products
 * - 400ms ease-out category transition animation via framer-motion
 * - Lazy-loaded DiscoveryFeed below the fold for infinite scroll
 *
 * @validates Requirements 1.1, 1.2, 1.3, 3.4, 3.7, 5.1
 */

import React, { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHomeFeed } from '../hooks/useHomeFeed';
import { ProductCard } from '../components/product/ProductCard';
import { MasonryGrid } from '../components/layout/MasonryGrid';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';

// ─── Lazy-loaded DiscoveryFeed (below-the-fold code splitting) ────────────────
const DiscoveryFeed = React.lazy(() => import('../components/feed/DiscoveryFeed'));

// ─── Category Definitions ─────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'women', label: 'Women' },
  { id: 'men', label: 'Men' },
  { id: 'kids', label: 'Kids' },
  { id: 'ethnic', label: 'Ethnic' },
  { id: 'western', label: 'Western' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'accessories', label: 'Accessories' },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DealsPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { products, loading, error } = useHomeFeed(activeCategory);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ── Category Chips ─────────────────────────────────────────────────── */}
      <section className="bg-white/95 backdrop-blur-sm border-b border-neutral-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={[
                  'px-4 py-2.5 sm:py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200 min-h-[44px] sm:min-h-0 flex-shrink-0 cursor-pointer',
                  'focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40 focus:ring-offset-1',
                  'active:scale-[0.97]',
                  activeCategory === cat.id
                    ? 'bg-[#C9A96E] text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                    : 'bg-white text-neutral-600 border border-neutral-200 hover:border-[#C9A96E]/50 hover:text-[#0F0F1A]',
                ].join(' ')}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content Area with Category Transition Animation ─────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* Loading state */}
            {loading && (
              <SkeletonLoader count={8} variant="card" />
            )}

            {/* Empty state — error set and not loading */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-[15px] text-neutral-500 max-w-md">
                  No products available for this category. Results are being indexed.
                </p>
              </div>
            )}

            {/* Products loaded */}
            {!loading && !error && products.length > 0 && (
              <MasonryGrid>
                {products.map((product, i) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    eagerLoad={i < 8}
                    priority={i < 4}
                  />
                ))}
              </MasonryGrid>
            )}

            {/* No products and no error (edge case) */}
            {!loading && !error && products.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-[15px] text-neutral-500 max-w-md">
                  No products available for this category. Results are being indexed.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* ── Discovery Feed (below the fold, lazy-loaded) ───────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <Suspense fallback={<SkeletonLoader count={4} variant="discovery" />}>
          <DiscoveryFeed category={activeCategory} initialOffset={20} />
        </Suspense>
      </section>
    </div>
  );
}
