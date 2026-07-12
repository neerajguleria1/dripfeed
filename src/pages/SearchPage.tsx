import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SlidersHorizontal, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import { SearchFilters } from '../components/search/SearchFilters';
import { InfiniteScroll } from '../components/common/InfiniteScroll';
import { SEOHead } from '../components/common/SEOHead';
import api from '../services/api';
import { staggerChildren, staggerItem } from '../design-system/animations';
import { ALL_SEED_PRODUCTS } from '../../api/_lib/seed-data';
import type { ProductData } from '../types/product';
import type { FilterState } from '../components/search/SearchFilters';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: FilterState = {
  platforms: [],
  priceRange: 'all',
  category: 'all',
  minDiscount: 0,
  sort: 'price-asc',
};

const TRENDING_SEARCHES = [
  'kurta set',
  'sneakers',
  'silk saree',
  'lehenga',
  'oversized hoodie',
  'palazzo',
  'denim jacket',
  'crop top',
];

const CATEGORIES = [
  { name: 'Ethnic Wear', slug: 'ethnic-wear', count: '2,400+' },
  { name: 'Western', slug: 'western', count: '3,100+' },
  { name: 'Footwear', slug: 'footwear', count: '1,800+' },
  { name: 'Accessories', slug: 'accessories', count: '960+' },
  { name: 'Fusion Wear', slug: 'fusion-wear', count: '720+' },
  { name: 'Activewear', slug: 'activewear', count: '1,200+' },
];

const SORT_OPTIONS: { value: FilterState['sort']; label: string }[] = [
  { value: 'price-asc', label: 'Lowest Price' },
  { value: 'discount-desc', label: 'Highest Discount' },
  { value: 'newest', label: 'Newest First' },
  { value: 'platform', label: 'By Platform' },
];

// Platform color mapping
const PLATFORM_COLORS: Record<string, string> = {
  myntra: '#FF3F6C',
  ajio: '#1A1A1A',
  amazon: '#FF9900',
  amazonia: '#FF9900',
  flipkart: '#2874F0',
  meesho: '#570741',
  nykaa: '#FC2779',
  nykaafashion: '#FC2779',
  tata: '#6C3D9E',
  tatacliq: '#6C3D9E',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function matchesPriceRange(price: number, range: string): boolean {
  switch (range) {
    case 'under500': return price < 500;
    case '500-1000': return price >= 500 && price <= 1000;
    case '1000-2000': return price >= 1000 && price <= 2000;
    case '2000-5000': return price >= 2000 && price <= 5000;
    case '5000+': return price >= 5000;
    case 'all':
    default: return true;
  }
}

function sortProducts(products: ProductData[], sort: FilterState['sort']): ProductData[] {
  const sorted = [...products];
  switch (sort) {
    case 'price-asc': return sorted.sort((a, b) => a.price - b.price);
    case 'discount-desc': return sorted.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    case 'newest': return sorted;
    case 'platform': return sorted.sort((a, b) => a.platform.localeCompare(b.platform));
    default: return sorted;
  }
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
}

// Derive trending products from seed data for landing state
const TRENDING_PRODUCTS: ProductData[] = ALL_SEED_PRODUCTS.slice(0, 9).map((sp, i) => {
  const cheapest = sp.platforms.reduce((a, b) => (a.price < b.price ? a : b));
  return {
    id: `trending-${i}`,
    title: sp.title,
    brand: sp.brand,
    price: cheapest.price,
    originalPrice: cheapest.originalPrice,
    discount: Math.round(
      ((cheapest.originalPrice - cheapest.price) / cheapest.originalPrice) * 100
    ),
    platform: cheapest.platform,
    url: cheapest.url,
    imageUrl: sp.imageUrl,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Featured Product Card — Premium gold-accented lede card
// ─────────────────────────────────────────────────────────────────────────────

function FeaturedCard({ product }: { product: ProductData }) {
  const savings = product.originalPrice && product.originalPrice > product.price
    ? product.originalPrice - product.price
    : 0;

  return (
    <motion.a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="group col-span-full flex flex-col md:flex-row gap-5 md:gap-8
        bg-white rounded-2xl border border-neutral-100 overflow-hidden
        hover:border-[#C9A96E]/30 hover:shadow-[0_8px_32px_-8px_rgba(201,169,110,0.12)]
        transition-all duration-300 mb-8 md:mb-12 relative"
    >
      {/* Best Match badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5
        bg-[#C9A96E] text-white text-[11px] font-semibold uppercase tracking-[0.06em]
        px-3 py-1.5 rounded-full shadow-sm">
        <Sparkles className="w-3 h-3" />
        Best Match
      </div>

      {/* Image */}
      <div className="w-full md:w-[320px] lg:w-[360px] flex-shrink-0 overflow-hidden bg-neutral-50">
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full aspect-[3/4] object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="eager"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=533&fit=crop'; }}
        />
      </div>

      {/* Details */}
      <div className="flex flex-col justify-center p-5 md:p-8 md:py-10">
        {/* Platform badge pill */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-white capitalize"
            style={{ backgroundColor: PLATFORM_COLORS[product.platform.toLowerCase().replace(/\s+/g, '')] || PLATFORM_COLORS[product.platform.toLowerCase().split(' ')[0]] || '#6b7280' }}
          >
            {product.platform}
          </span>
        </div>

        <span className="text-[12px] tracking-[0.04em] text-neutral-400 font-medium">
          {product.brand}
        </span>
        <h2 className="text-[20px] md:text-[26px] font-bold text-[#0F0F1A] leading-snug mt-2 mb-3 tracking-[-0.01em]">
          {product.title}
        </h2>

        <div className="w-10 h-px bg-[#C9A96E]/40 my-3" />

        <div className="flex items-baseline gap-3 mt-2">
          <span className="text-[20px] md:text-[24px] font-bold text-[#0F0F1A] font-serif tabular-nums">
            {formatPrice(product.price)}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-[14px] text-neutral-400 line-through tabular-nums">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>

        {savings > 0 && (
          <span className="inline-flex items-center gap-1 mt-3 text-[12px] font-semibold
            text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full w-fit">
            Save {formatPrice(savings)}
          </span>
        )}
      </div>
    </motion.a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard Result Card — White card with subtle border, premium styling
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ product, index }: { product: ProductData; index: number }) {
  const savings = product.originalPrice && product.originalPrice > product.price
    ? product.originalPrice - product.price
    : 0;

  return (
    <motion.a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.4, 0, 0.2, 1] }}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden
        border border-neutral-100 hover:border-[#C9A96E]/30
        hover:shadow-[0_4px_20px_-4px_rgba(201,169,110,0.1)]
        transition-all duration-300 min-h-[44px]"
    >
      <div className="overflow-hidden bg-neutral-50 relative">
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full aspect-[3/4] object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=533&fit=crop'; }}
        />
        {/* Savings badge */}
        {savings > 0 && (
          <span className="absolute top-3 right-3 text-[11px] font-semibold
            text-emerald-700 bg-emerald-50 border border-emerald-100
            px-2.5 py-1 rounded-full">
            Save {formatPrice(savings)}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        {/* Platform badge pill */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white capitalize"
            style={{ backgroundColor: PLATFORM_COLORS[product.platform.toLowerCase().replace(/\s+/g, '')] || PLATFORM_COLORS[product.platform.toLowerCase().split(' ')[0]] || '#6b7280' }}
          >
            {product.platform}
          </span>
        </div>

        <span className="text-[11px] tracking-[0.04em] text-neutral-400 font-medium">
          {product.brand}
        </span>
        <h3 className="text-[14px] font-medium text-[#0F0F1A] leading-snug mt-1.5 line-clamp-2 min-h-[40px]">
          {product.title}
        </h3>

        <div className="mt-auto pt-3 flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-[#0F0F1A] font-serif tabular-nums">
            {formatPrice(product.price)}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-[12px] text-neutral-400 line-through tabular-nums">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>
        {product.discount && product.discount > 0 && (
          <span className="text-[11px] font-semibold text-[#C9A96E] mt-1">
            {Math.round(Number(product.discount))}% off
          </span>
        )}
      </div>
    </motion.a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Loader — Premium shimmer
// ─────────────────────────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {/* Featured skeleton */}
      <div className="flex flex-col md:flex-row gap-8 bg-white rounded-2xl border border-neutral-100 overflow-hidden mb-8 animate-pulse">
        <div className="w-full md:w-[320px] flex-shrink-0 bg-neutral-100 aspect-[3/4]" />
        <div className="flex flex-col justify-center gap-3 flex-1 p-8">
          <div className="h-3 bg-neutral-100 rounded-full w-20" />
          <div className="h-6 bg-neutral-100 rounded-full w-3/4" />
          <div className="h-px bg-[#C9A96E]/20 w-10 my-2" />
          <div className="h-5 bg-neutral-100 rounded-full w-28" />
        </div>
      </div>
      {/* Grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-2xl border border-neutral-100 overflow-hidden">
            <div className="bg-neutral-100 aspect-[3/4]" />
            <div className="p-4 space-y-2">
              <div className="h-2 bg-neutral-100 rounded-full w-12" />
              <div className="h-3 bg-neutral-100 rounded-full w-3/4" />
              <div className="h-3.5 bg-neutral-100 rounded-full w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [hasMore, setHasMore] = useState(false);

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) { setProducts([]); return; }
    setLoading(true);
    setProducts([]);
    try {
      const { data } = await api.post('/search/product', { query: searchQuery });
      const fetched: ProductData[] = data.products || [];
      setProducts(fetched);
      setHasMore(false);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query) {
      // If the query is a URL, redirect to compare page
      if (query.startsWith('http://') || query.startsWith('https://')) {
        navigate(`/compare?url=${encodeURIComponent(query)}`, { replace: true });
        return;
      }
      fetchResults(query);
    } else {
      setProducts([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, fetchResults, navigate]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearch(newQuery: string) {
    const trimmed = newQuery.trim();
    if (!trimmed) return;
    // If it's a URL, route to compare page instead
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      navigate(`/compare?url=${encodeURIComponent(trimmed)}`);
    } else {
      setSearchParams({ q: trimmed });
    }
  }

  function handleFilterChange(newFilters: FilterState) {
    setFilters(newFilters);
  }

  function handleLoadMore() {
    // Pagination — future implementation
  }

  function handleTrendingClick(term: string) {
    setSearchParams({ q: term });
  }

  function handleCategoryClick(slug: string) {
    navigate(`/category/${slug}`);
  }

  // ── Client-side Filtering ─────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (filters.platforms.length > 0) {
      result = result.filter((p) =>
        filters.platforms.some(
          (plat) => p.platform.toLowerCase() === plat.toLowerCase()
        )
      );
    }

    if (filters.priceRange !== 'all') {
      result = result.filter((p) => matchesPriceRange(p.price, filters.priceRange));
    }

    if (filters.minDiscount > 0) {
      result = result.filter((p) => (p.discount || 0) >= filters.minDiscount);
    }

    return sortProducts(result, filters.sort);
  }, [products, filters]);

  const platformsSearched = useMemo(() => {
    const unique = new Set(products.map((p) => p.platform));
    return Array.from(unique);
  }, [products]);

  // ── Derived State ─────────────────────────────────────────────────────────

  const featuredProduct = filteredProducts[0] || null;
  const gridProducts = filteredProducts.slice(1);
  const showEmpty = !loading && query && filteredProducts.length === 0;
  const showResults = !loading && filteredProducts.length > 0;
  const showLanding = !query && !loading;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <SEOHead
        title={
          query
            ? `${query} — Best Prices Across Platforms`
            : 'Search Fashion Deals — DripFeed India'
        }
        description={
          query
            ? `Compare prices for "${query}" across Myntra, Ajio, Amazon, Meesho & more.`
            : 'Search and compare fashion prices across 7+ Indian platforms. Find the best deals instantly.'
        }
      />

      {/* ── Hero Search ──────────────────────────────────────────────────────── */}
      <section className="pb-8 sm:pb-10 bg-white border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
          {!query && (
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="text-[24px] sm:text-[36px] lg:text-[40px] font-bold text-[#0F0F1A]
                text-center mb-6 sm:mb-8 leading-[1.15] tracking-[-0.02em]"
            >
              What are you looking for?
            </motion.h1>
          )}

          {query && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] text-neutral-400 text-center mb-4 tracking-[0.08em] uppercase font-medium"
            >
              Search results
            </motion.p>
          )}

          {/* Search bar with gold focus ring */}
          <div className="[&_input:focus]:ring-2 [&_input:focus]:ring-[#C9A96E]/40 [&_input:focus]:border-[#C9A96E]">
            <SearchBar size="hero" initialQuery={query} onSearch={handleSearch} />
          </div>

          {/* Results summary with platform badges */}
          {query && !loading && products.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="flex flex-wrap items-center justify-center gap-2 mt-5"
            >
              <span className="text-[13px] text-neutral-500">
                {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
              </span>
              {platformsSearched.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-neutral-400">across</span>
                  {platformsSearched.map((platform) => (
                    <span
                      key={platform}
                      className="inline-flex items-center gap-1 text-[11px] font-medium
                        text-neutral-600 bg-neutral-50 border border-neutral-100
                        px-2 py-0.5 rounded-full capitalize"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: PLATFORM_COLORS[platform.toLowerCase()] || '#6b7280' }}
                      />
                      {platform}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Sticky Filter Bar ────────────────────────────────────────────────── */}
      {query && (
        <section className="bg-white/90 backdrop-blur-md border-b border-neutral-100 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-neutral-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="text-[12px] font-medium uppercase tracking-[0.06em]">
                  Filters
                </span>
              </div>

              {/* Pill-style sort with gold accent */}
              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={(e) =>
                    handleFilterChange({
                      ...filters,
                      sort: e.target.value as FilterState['sort'],
                    })
                  }
                  className="appearance-none bg-white border border-neutral-200 rounded-full
                    px-4 py-2 sm:py-1.5 pr-8 text-[13px] font-medium text-neutral-600
                    cursor-pointer hover:border-[#C9A96E]/50
                    focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/30 focus:border-[#C9A96E]
                    transition-colors tracking-wide min-h-[44px] sm:min-h-0"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-3 h-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Filter chips — horizontal scroll on mobile */}
            <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide mt-3">
              <SearchFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                resultCount={filteredProducts.length}
                platformsSearched={platformsSearched}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Results Grid ─────────────────────────────────────────────────────── */}
      {showResults && (
        <section className="bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
            <InfiniteScroll
              hasMore={hasMore}
              loading={loading}
              onLoadMore={handleLoadMore}
            >
              {featuredProduct && <FeaturedCard product={featuredProduct} />}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {gridProducts.map((product, i) => (
                  <ResultCard key={product.id || i} product={product} index={i} />
                ))}
              </div>
            </InfiniteScroll>
          </div>
        </section>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading && (
        <section className="bg-[#FAFAFA]">
          <ResultsSkeleton />
        </section>
      )}

      {/* ── Empty State ──────────────────────────────────────────────────────── */}
      {showEmpty && (
        <section className="bg-[#FAFAFA]">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Friendly emoji illustration */}
              <div className="text-[48px] mb-6">🔍</div>

              <h2 className="text-[22px] sm:text-[26px] font-bold text-[#0F0F1A] mb-3 tracking-[-0.01em]">
                No results for &ldquo;{query}&rdquo;
              </h2>
              <p className="text-[14px] text-neutral-500 mb-10 leading-relaxed max-w-sm mx-auto">
                We couldn&apos;t find matching products. Try a broader term or explore these suggestions.
              </p>

              {/* Suggestion pills with gold accent */}
              <div className="flex flex-wrap justify-center gap-2.5 mb-12">
                {TRENDING_SEARCHES.slice(0, 5).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleTrendingClick(term)}
                    className="px-5 py-2.5 rounded-full text-[13px] font-medium
                      bg-white text-neutral-600 border border-neutral-200
                      hover:border-[#C9A96E] hover:text-[#8B7340] hover:bg-[#C9A96E]/5
                      transition-all duration-200 capitalize min-h-[44px]"
                  >
                    {term}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/deals')}
                  className="inline-flex items-center gap-2 bg-[#0F0F1A] text-white
                    font-medium px-7 py-3.5 rounded-full text-[13px]
                    hover:bg-[#1A1A2E] transition-colors min-h-[44px]"
                >
                  Browse Deals <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => navigate('/category/western')}
                  className="inline-flex items-center gap-2 bg-white text-neutral-700
                    font-medium px-7 py-3.5 rounded-full text-[13px]
                    border border-neutral-200 hover:border-[#C9A96E]/50
                    transition-colors min-h-[44px]"
                >
                  Shop Categories
                </button>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Landing State ────────────────────────────────────────────────────── */}
      {showLanding && (
        <section className="bg-[#FAFAFA]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-20">

            {/* Trending Searches — gold accent pills */}
            <motion.div
              variants={staggerChildren}
              initial="hidden"
              animate="visible"
              className="mb-16 sm:mb-20"
            >
              <div className="flex items-center gap-2.5 mb-5">
                <TrendingUp className="w-4 h-4 text-[#C9A96E]" />
                <h2 className="text-[12px] font-semibold text-[#C9A96E] uppercase tracking-[0.08em]">
                  Trending now
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {TRENDING_SEARCHES.map((term) => (
                  <motion.button
                    key={term}
                    variants={staggerItem}
                    type="button"
                    onClick={() => handleTrendingClick(term)}
                    className="px-5 py-2.5 rounded-full text-[13px] font-medium
                      bg-white text-neutral-600 border border-neutral-200
                      hover:bg-[#C9A96E]/5 hover:border-[#C9A96E] hover:text-[#8B7340]
                      transition-all duration-200 capitalize
                      shadow-[0_1px_3px_rgba(0,0,0,0.02)] min-h-[44px]"
                  >
                    {term}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Category Tiles — hover gold border */}
            <motion.div
              variants={staggerChildren}
              initial="hidden"
              animate="visible"
              className="mb-16 sm:mb-20"
            >
              <h2 className="text-[22px] sm:text-[28px] font-bold text-[#0F0F1A] tracking-[-0.02em] mb-6 sm:mb-8">
                Browse by Category
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {CATEGORIES.map((cat) => (
                  <motion.button
                    key={cat.slug}
                    variants={staggerItem}
                    onClick={() => handleCategoryClick(cat.slug)}
                    className="bg-white rounded-2xl p-5 sm:p-7 text-left
                      border border-neutral-100 hover:border-[#C9A96E]
                      hover:shadow-[0_4px_16px_-4px_rgba(201,169,110,0.12)]
                      transition-all duration-300 group min-h-[44px]"
                  >
                    <span className="text-[14px] sm:text-[15px] font-semibold text-[#0F0F1A]
                      group-hover:text-[#8B7340] transition-colors leading-snug">
                      {cat.name}
                    </span>
                    <span className="block text-[12px] text-neutral-400 mt-1.5 tracking-wide">
                      {cat.count} products
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Popular Products — editorial grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[22px] sm:text-[28px] font-bold text-[#0F0F1A] tracking-[-0.02em]">
                  Popular right now
                </h2>
                <span className="text-[11px] text-[#C9A96E] font-semibold tracking-wide uppercase">
                  Updated hourly
                </span>
              </div>

              {/* Featured first product */}
              {TRENDING_PRODUCTS[0] && (
                <FeaturedCard product={TRENDING_PRODUCTS[0]} />
              )}

              {/* Remaining products grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {TRENDING_PRODUCTS.slice(1).map((product, i) => (
                  <ResultCard key={product.id} product={product} index={i} />
                ))}
              </div>
            </motion.div>

          </div>
        </section>
      )}

      {/* ── Affiliate Disclosure Footer ──────────────────────────────────────── */}
      <footer className="px-4 sm:px-8 lg:px-16 py-10 pb-24 sm:pb-10 border-t border-neutral-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-neutral-600">
            &copy; 2026 DripFeed India
          </p>
          <div className="flex gap-5 text-[13px] text-neutral-600">
            <button
              onClick={() => navigate('/privacy')}
              className="hover:text-[#C9A96E] transition-colors min-h-[44px] flex items-center"
            >
              Privacy
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="hover:text-[#C9A96E] transition-colors min-h-[44px] flex items-center"
            >
              Terms
            </button>
            <button
              onClick={() => navigate('/affiliate-disclosure')}
              className="hover:text-[#C9A96E] transition-colors min-h-[44px] flex items-center"
            >
              Affiliate Disclosure
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            #Ad: DripFeed earns commission on purchases through our links.
          </p>
        </div>
      </footer>
    </div>
  );
}
