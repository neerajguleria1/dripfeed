import { useEffect, useRef, useState } from 'react';
import { Flame, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ProductCard } from '../product/ProductCard';
import { ProductSkeleton } from '../ui/ProductSkeleton';
import { useTrending } from '../../hooks/useTrending';
import type { TrendingWindow } from '../../hooks/useTrending';

const WINDOWS: { label: string; value: TrendingWindow }[] = [
  { label: '24h',  value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

interface TrendingProductsSectionProps {
  /** Optional category slug to filter trending products. */
  category?: string;
  /** Default window to show. */
  defaultWindow?: TrendingWindow;
}

export function TrendingProductsSection({
  category,
  defaultWindow = '7d',
}: TrendingProductsSectionProps) {
  const navigate = useNavigate();
  const { products, status, fetch } = useTrending();
  const [activeWindow, setActiveWindow] = useState<TrendingWindow>(defaultWindow);
  const sectionRef = useRef<HTMLElement>(null);
  const hasLoaded = useRef(false);

  // Lazy load via IntersectionObserver
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded.current) {
          hasLoaded.current = true;
          fetch(activeWindow, category);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleWindowChange(w: TrendingWindow) {
    setActiveWindow(w);
    fetch(w, category);
  }

  const isLoading = status === 'loading' || status === 'idle';

  return (
    <section
      ref={sectionRef}
      aria-label="Trending Products"
      className="py-14 sm:py-16 bg-white border-t border-neutral-100"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-[#C9A96E]" />
            <h2 className="text-[18px] sm:text-[22px] font-bold text-[#171310] tracking-[-0.01em]">
              Trending Now
            </h2>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="text-[13px] text-[#C9A96E] font-medium flex items-center gap-1 hover:gap-2 transition-all min-h-[44px]"
          >
            See all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Window selector */}
        <div className="flex gap-2 mb-6" role="group" aria-label="Trending time window">
          {WINDOWS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleWindowChange(value)}
              className={[
                'px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors min-h-[36px]',
                activeWindow === value
                  ? 'bg-[#171310] text-white border-[#171310]'
                  : 'bg-white text-[#171310]/60 border-neutral-200 hover:border-[#171310]/30',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Skeleton */}
        {isLoading && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {status === 'empty' && (
          <p className="text-[14px] text-neutral-400 py-8 text-center">
            No trending products yet — check back soon.
          </p>
        )}

        {/* Products grid */}
        {status === 'success' && products.length > 0 && (
          <motion.div
            key={activeWindow}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          >
            {products.slice(0, 8).map((product, i) => (
              <motion.div
                key={product.id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}

export default TrendingProductsSection;
