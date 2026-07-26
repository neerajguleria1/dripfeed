import { useEffect, useRef, useState } from 'react';
import { ProductCard } from './ProductCard';
import { ProductSkeleton } from '../ui/ProductSkeleton';
import { useSimilarProducts } from '../../hooks/useSimilarProducts';

interface SimilarProductsSectionProps {
  canonicalId: string;
}

/**
 * SimilarProductsSection
 *
 * Lazy-loads similar products when the section scrolls into view.
 * Reuses ProductCard, ProductSkeleton, and useSimilarProducts hook.
 */
export function SimilarProductsSection({ canonicalId }: SimilarProductsSectionProps) {
  const { products, status, fetch } = useSimilarProducts();
  const sectionRef = useRef<HTMLElement>(null);
  const [triggered, setTriggered] = useState(false);

  // Lazy load: trigger fetch only when section enters viewport
  useEffect(() => {
    if (triggered) return;
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTriggered(true);
          fetch(canonicalId);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canonicalId, fetch, triggered]);

  // Re-fetch if canonicalId changes after initial trigger
  useEffect(() => {
    if (triggered) {
      setTriggered(false);
    }
  }, [canonicalId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = status === 'idle' || status === 'loading';

  return (
    <section ref={sectionRef} aria-label="Similar Products" aria-busy={isLoading} className="mb-6">
      <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em] mb-4">
        Similar Products
      </h2>

      {/* Loading skeleton — 8 cards matching ProductCard layout */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Results grid */}
      {status === 'success' && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {products.map(p => {
            const offer = p.offers[0];
            if (!offer) return null;
            return (
              <ProductCard
                key={p.id}
                product={{
                  id: p.id,
                  title: p.title,
                  brand: p.brand,
                  imageUrl: offer.imageUrl,
                  price: offer.price,
                  originalPrice: offer.originalPrice,
                  discount: offer.discount,
                  platform: offer.platform,
                  url: offer.affiliateUrl || offer.productUrl,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {(status === 'empty' || status === 'error') && (
        <p className="text-[13px] text-neutral-400 text-center py-6">
          No similar products found right now.
        </p>
      )}
    </section>
  );
}
