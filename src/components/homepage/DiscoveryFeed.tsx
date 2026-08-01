import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useDiscoveryFeed } from '../../hooks/useDiscoveryFeed';
import HomeFeedCard from './HomeFeedCard';
import type { FeedSection, HomeFeedProduct } from '../../types/homeFeed';

interface DiscoveryFeedProps {
  category: string;
}

/** Skeleton card placeholder used while loading more discovery content. */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="aspect-[3/4] bg-neutral-100 animate-pulse" />
      <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
        <div className="h-3 bg-neutral-100 rounded-full w-3/4 animate-pulse" />
        <div className="h-3 bg-neutral-100 rounded-full w-1/2 animate-pulse" />
        <div className="h-4 bg-neutral-100 rounded-full w-1/3 mt-2 animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Infinite-scroll discovery feed rendered below the initial product grid.
 * Displays themed sections (e.g. "Today's Deals", "Under ₹999") with product grids
 * that auto-load as the user scrolls toward the bottom.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
export default function DiscoveryFeed({ category }: DiscoveryFeedProps) {
  const { sections, loading, hasMore, triggerRef } = useDiscoveryFeed(category);

  return (
    <section aria-label="Discovery feed" className="mt-6">
      {/* Themed sections */}
      {sections.map((section: FeedSection) => (
        <div key={section.id} className="mb-8">
          <h2 className="px-4 mb-3 text-lg font-semibold text-neutral-800">
            {section.title}
          </h2>
          <div className="px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {section.products.map((product: HomeFeedProduct) => (
              <HomeFeedCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ))}

      {/* Loading state: 3 skeleton cards */}
      {loading && (
        <div className="px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* End-of-feed message */}
      {!hasMore && sections.length > 0 && (
        <div className="py-10 px-4 text-center">
          <p className="text-neutral-500 text-sm mb-3">
            You've seen it all! Try searching for something specific
          </p>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-100 text-neutral-700 text-sm font-medium hover:bg-neutral-200 transition-colors"
          >
            <Search className="w-4 h-4" />
            Search products
          </Link>
        </div>
      )}

      {/* IntersectionObserver trigger — the hook's triggerRef fires loadNext when visible */}
      <div ref={triggerRef} className="h-1" aria-hidden="true" />
    </section>
  );
}
