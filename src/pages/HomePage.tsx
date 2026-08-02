import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/common/SEOHead';
import StickyHeader from '../components/homepage/StickyHeader';
import CategoryChips from '../components/homepage/CategoryChips';
import GeoBanner from '../components/homepage/GeoBanner';
import { HomeProductGrid } from '../components/homepage/HomeProductGrid';
import BackToTopButton from '../components/homepage/BackToTopButton';
import { useHomeFeed } from '../hooks/useHomeFeed';
import { useGeoRegion } from '../hooks/useGeoRegion';
import { HOMEPAGE_CATEGORIES } from '../data/categories';
import type { HomeFeedProduct } from '../types/homeFeed';
import type { ValidatedProduct } from '../utils/validateProduct';

// Lazy-load DiscoveryFeed — it's below the fold and not needed for initial render
const DiscoveryFeed = React.lazy(() => import('../components/homepage/DiscoveryFeed'));

/** Skeleton fallback shown while the DiscoveryFeed chunk loads. */
function DiscoverySkeleton() {
  return (
    <section aria-label="Loading discovery feed" className="mt-6 px-4">
      <div className="h-5 bg-neutral-100 rounded-full w-40 mb-3 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            <div className="aspect-[3/4] bg-neutral-100 animate-pulse" />
            <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
              <div className="h-3 bg-neutral-100 rounded-full w-3/4 animate-pulse" />
              <div className="h-3 bg-neutral-100 rounded-full w-1/2 animate-pulse" />
              <div className="h-4 bg-neutral-100 rounded-full w-1/3 mt-2 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('all');

  // Derive the query string from the active category
  const categoryQuery =
    HOMEPAGE_CATEGORIES.find((c) => c.id === activeCategory)?.query ?? '';

  // Fetch home feed products based on selected category
  const { products, loading } = useHomeFeed(categoryQuery);

  // Map ValidatedProduct[] → HomeFeedProduct[] for HomeProductGrid compatibility
  const homeFeedProducts: HomeFeedProduct[] = useMemo(() => {
    return products.map((p: ValidatedProduct): HomeFeedProduct => {
      const cheapest = p.offers[0] ?? { platform: 'unknown', price: p.lowestPrice, url: '' };
      return {
        id: p.id,
        title: p.title,
        brand: p.brand,
        imageUrl: p.imageUrl,
        price: p.lowestPrice,
        originalPrice: p.highestOriginalPrice,
        discount: p.discountPercent ?? 0,
        savings: p.highestOriginalPrice && p.highestOriginalPrice > p.lowestPrice
          ? p.highestOriginalPrice - p.lowestPrice
          : undefined,
        platform: cheapest.platform,
        url: cheapest.url,
        offers: p.offers.map((o) => ({
          platform: o.platform,
          price: o.price,
          originalPrice: o.originalPrice,
          url: o.url,
          affiliateUrl: o.affiliateUrl,
          imageUrl: o.imageUrl,
        })),
      };
    });
  }, [products]);

  // Geo detection for banner visibility
  const { isIndia, dismissed, dismiss } = useGeoRegion();

  // Preload first 8 product images when products are served from cache (not during skeleton state)
  useEffect(() => {
    if (loading || products.length === 0) return;

    const preloadLinks: HTMLLinkElement[] = [];

    products
      .filter((p) => p.imageUrl)
      .slice(0, 8)
      .forEach((product) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = product.imageUrl!;
        document.head.appendChild(link);
        preloadLinks.push(link);
      });

    // Cleanup: remove preload links on unmount or when products change
    return () => {
      preloadLinks.forEach((link) => {
        document.head.removeChild(link);
      });
    };
  }, [loading, products]);

  return (
    <div className="min-h-[100dvh] bg-white">
      <SEOHead
        title="TagCheck — Compare Fashion Prices Across 5 Indian Platforms"
        description="Never overpay for fashion. Compare prices across Ajio, Amazon, Flipkart, Myntra & Meesho in one click."
        url="https://dripfeed-v21.vercel.app/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'TagCheck India',
            url: 'https://dripfeed-v21.vercel.app',
            logo: 'https://dripfeed-v21.vercel.app/logo.png',
            description:
              'AI-powered fashion price comparison platform for India, comparing prices across 3+ e-commerce platforms.',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'TagCheck India',
            url: 'https://dripfeed-v21.vercel.app',
            potentialAction: {
              '@type': 'SearchAction',
              target:
                'https://dripfeed-v21.vercel.app/search?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />

      {/* Fixed sticky header */}
      <StickyHeader />

      {/* Main content area — offset for sticky header height */}
      <main className="pt-14 md:pt-16">
        {/* Category filter chips */}
        <CategoryChips
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        {/* Geo banner — shown only for non-India users who haven't dismissed */}
        <GeoBanner isIndia={isIndia} dismissed={dismissed} onDismiss={dismiss} />

        {/* Above-the-fold product grid */}
        <section aria-label="Products" className="px-4">
          <HomeProductGrid products={homeFeedProducts} loading={loading} />
        </section>

        {/* Infinite scroll discovery feed (lazy-loaded below the fold) */}
        <Suspense fallback={<DiscoverySkeleton />}>
          <DiscoveryFeed category={categoryQuery} />
        </Suspense>
      </main>

      {/* Floating back-to-top button */}
      <BackToTopButton />

      {/* Minimal footer */}
      <footer className="px-5 sm:px-8 py-10 pb-24 sm:pb-10 bg-white border-t border-neutral-100">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-neutral-400">
            © 2026 TagCheck India
          </p>
          <div className="flex gap-6 text-[13px] text-neutral-400">
            <button
              onClick={() => navigate('/privacy')}
              className="hover:text-[#171310] transition-colors min-h-[44px] flex items-center"
            >
              Privacy
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="hover:text-[#171310] transition-colors min-h-[44px] flex items-center"
            >
              Terms
            </button>
            <button
              onClick={() => navigate('/affiliate-disclosure')}
              className="hover:text-[#171310] transition-colors min-h-[44px] flex items-center"
            >
              Disclosure
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
