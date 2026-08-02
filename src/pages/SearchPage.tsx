import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, ArrowRight, TrendingUp } from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import { SearchFilters } from '../components/search/SearchFilters';
import { InfiniteScroll } from '../components/common/InfiniteScroll';
import { SEOHead } from '../components/common/SEOHead';
import api from '../services/api';
import { staggerChildren, staggerItem } from '../design-system/animations';
import { ALL_SEED_PRODUCTS } from '../../api/_lib/seed-data';
import type { ProductData } from '../types/product';
import { DEFAULT_FILTERS, extractFacets, type FilterState, type Facets } from '../types/filters';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

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
  { value: 'relevance', label: 'Relevance' },
];

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
    case 'price-desc': return sorted.sort((a, b) => b.price - a.price);
    case 'discount-desc': return sorted.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    case 'newest': return sorted;
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
// Featured Product Card (lede — larger, no shadow, separated by whitespace)
// ─────────────────────────────────────────────────────────────────────────────

function FeaturedCard({ product }: { product: ProductData }) {
  return (
    <motion.a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="group col-span-full lg:col-span-2 flex flex-col sm:flex-row gap-5 sm:gap-8 pb-8 sm:pb-12 mb-8 sm:mb-12 border-b border-neutral-100"
    >
      {/* Image — full width on mobile, fixed on larger */}
      <div className="w-full sm:w-[320px] flex-shrink-0 overflow-hidden rounded-xl bg-neutral-50">
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full aspect-[3/4] object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          loading="eager"
        />
      </div>

      {/* Details */}
      <div className="flex flex-col justify-center py-2">
        <span className="text-[13px] sm:text-[11px] uppercase tracking-[0.08em] text-neutral-500 font-medium">
          {product.brand}
        </span>
        <h2 className="text-[18px] sm:text-[24px] font-medium text-neutral-900 leading-snug mt-2 mb-1 tracking-[-0.01em]">
          {product.title}
        </h2>
        {/* Hand-crafted thin rule */}
        <div className="w-12 h-px bg-neutral-200 my-3 sm:my-4" />
        <div className="flex items-baseline gap-3">
          <span className="text-[16px] sm:text-[18px] font-semibold text-neutral-900 tabular-nums">
            {formatPrice(product.price)}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-[13px] sm:text-[14px] text-neutral-400 line-through tabular-nums">
              {formatPrice(product.originalPrice)}
            </span>
          )}
          {product.discount && product.discount > 0 && (
            <span className="text-[13px] font-medium text-emerald-600">
              {product.discount}% off
            </span>
          )}
        </div>
        <span className="text-[13px] sm:text-[12px] text-neutral-400 mt-3 capitalize">
          via {product.platform}
        </span>
      </div>
    </motion.a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard Result Card (shadow, restrained type)
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ product, index }: { product: ProductData; index: number }) {
  return (
    <motion.a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.4, 0, 0.2, 1] }}
      className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_16px_32px_-8px_rgba(0,0,0,0.1)] transition-shadow duration-300 min-h-[44px]"
    >
      <div className="overflow-hidden bg-neutral-50">
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full aspect-[3/4] object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        <span className="text-[13px] sm:text-[11px] uppercase tracking-[0.08em] text-neutral-500 font-medium">
          {product.brand}
        </span>
        <h3 className="text-[14px] sm:text-[15px] font-medium text-neutral-900 leading-snug mt-1.5 line-clamp-2">
          {product.title}
        </h3>
        <div className="mt-auto pt-3 flex items-baseline gap-2">
          <span className="text-[14px] sm:text-[15px] font-semibold text-neutral-900 tabular-nums">
            {formatPrice(product.price)}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-[13px] sm:text-[12px] text-neutral-400 line-through tabular-nums">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>
        {product.discount && product.discount > 0 && (
          <span className="text-[13px] sm:text-[11px] font-medium text-emerald-600 mt-1">
            {product.discount}% off
          </span>
        )}
        <span className="text-[13px] sm:text-[11px] text-neutral-400 mt-2 capitalize">
          {product.platform}
        </span>
      </div>
    </motion.a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Loader
// ─────────────────────────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Featured skeleton */}
      <div className="flex flex-col sm:flex-row gap-8 pb-12 mb-12 border-b border-neutral-100 animate-pulse">
        <div className="w-full sm:w-[320px] flex-shrink-0 bg-neutral-100 rounded-xl aspect-[3/4]" />
        <div className="flex flex-col justify-center gap-3 flex-1">
          <div className="h-3 bg-neutral-100 rounded-full w-20" />
          <div className="h-5 bg-neutral-100 rounded-full w-3/4" />
          <div className="h-px bg-neutral-100 w-12 my-2" />
          <div className="h-4 bg-neutral-100 rounded-full w-24" />
        </div>
      </div>
      {/* Grid skeleton */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-12">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-neutral-100 rounded-xl aspect-[3/4] mb-4" />
            <div className="h-2.5 bg-neutral-100 rounded-full w-16 mb-2" />
            <div className="h-3 bg-neutral-100 rounded-full w-3/4 mb-2" />
            <div className="h-3 bg-neutral-100 rounded-full w-1/3" />
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
    if (!searchQuery.trim()) {
      setProducts([]);
      return;
    }
    setLoading(true);
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
      fetchResults(query);
    } else {
      setProducts([]);
    }
  }, [query, fetchResults]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearch(newQuery: string) {
    const trimmed = newQuery.trim();
    if (trimmed) {
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

    if (filters.pricePreset !== 'all') {
      result = result.filter((p) => matchesPriceRange(p.price, filters.pricePreset));
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
      <section className="pt-6 pb-8 sm:pt-10 sm:pb-12 bg-white border-b border-neutral-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {!query && (
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="text-[26px] sm:text-[40px] lg:text-[48px] font-bold text-neutral-900 text-center mb-6 sm:mb-8 leading-[1.12] sm:leading-[1.08] tracking-[-0.02em]"
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

          <SearchBar size="hero" initialQuery={query} onSearch={handleSearch} />

          {/* Results summary */}
          {query && !loading && products.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-[13px] text-neutral-500 text-center mt-5"
            >
              {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}{' '}
              {platformsSearched.length > 0 && (
                <span className="text-neutral-400">
                  across {platformsSearched.join(', ')}
                </span>
              )}
            </motion.p>
          )}
        </div>
      </section>

      {/* ── Sticky Filter Bar ────────────────────────────────────────────────── */}
      {query && (
        <section className="bg-white/95 backdrop-blur-sm border-b border-neutral-100 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-neutral-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="text-[13px] sm:text-[11px] font-medium uppercase tracking-[0.08em]">
                  Filters
                </span>
              </div>

              {/* Pill-style sort */}
              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={(e) =>
                    handleFilterChange({
                      ...filters,
                      sort: e.target.value as FilterState['sort'],
                    })
                  }
                  className="appearance-none bg-white border border-neutral-200 rounded-full px-4 py-2 sm:py-1.5 pr-8 text-[13px] sm:text-[11px] font-medium text-neutral-600 cursor-pointer hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900/5 transition-colors tracking-wide min-h-[44px] sm:min-h-0"
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

            {/* Filter chips with clay accent on active */}
            <div className="mt-3">
              <SearchFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onReset={() => setFilters(DEFAULT_FILTERS)}
                facets={extractFacets(products.map(p => ({
                  id: p.id,
                  title: p.title,
                  brand: p.brand,
                  price: p.price,
                  originalPrice: p.originalPrice,
                  discount: p.discount,
                  platform: p.platform,
                })))}
                resultCount={filteredProducts.length}
              />
            </div>
          </div>
        </section>
      )}

      {/* ── Editorial Results Grid ───────────────────────────────────────────── */}
      {showResults && (
        <section className="bg-[#FAFAFA]">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <InfiniteScroll
              hasMore={hasMore}
              loading={loading}
              onLoadMore={handleLoadMore}
            >
              {/* Featured lede — first result, larger */}
              {featuredProduct && <FeaturedCard product={featuredProduct} />}

              {/* Standard grid — single column on mobile, 2 on small, 3-4 on larger */}
              {gridProducts.length > 0 && (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-12">
                  {gridProducts.map((product, i) => (
                    <ResultCard key={product.id || i} product={product} index={i} />
                  ))}
                </div>
              )}
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
          <div className="max-w-2xl mx-auto px-6 py-24 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Search className="w-8 h-8 text-neutral-300 mx-auto mb-6" />
              <h2 className="text-[24px] font-bold text-neutral-900 mb-3 tracking-[-0.01em]">
                No results for &ldquo;{query}&rdquo;
              </h2>
              <p className="text-[14px] text-neutral-500 mb-12 leading-relaxed max-w-sm mx-auto">
                We couldn&apos;t find matching products. Try a broader term or browse our categories below.
              </p>

              {/* Suggestion pills */}
              <div className="flex flex-wrap justify-center gap-2.5 mb-14">
                {TRENDING_SEARCHES.slice(0, 5).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleTrendingClick(term)}
                    className="px-5 py-2.5 rounded-full text-[13px] font-medium bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-900 hover:text-neutral-900 transition-colors capitalize"
                  >
                    {term}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/deals')}
                  className="inline-flex items-center gap-2 bg-neutral-900 text-white font-medium px-7 py-3 rounded-full text-[13px] hover:bg-neutral-800 transition-colors"
                >
                  Browse Deals <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => navigate('/category/western')}
                  className="inline-flex items-center gap-2 bg-white text-neutral-700 font-medium px-7 py-3 rounded-full text-[13px] border border-neutral-200 hover:border-neutral-300 transition-colors"
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
          <div className="max-w-5xl mx-auto px-6 pt-14 pb-20">

            {/* Trending Searches */}
            <motion.div
              variants={staggerChildren}
              initial="hidden"
              animate="visible"
              className="mb-20"
            >
              <div className="flex items-center gap-2.5 mb-6">
                <TrendingUp className="w-4 h-4 text-neutral-400" />
                <h2 className="text-[11px] font-medium text-neutral-400 uppercase tracking-[0.08em]">
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
                    className="px-5 py-2.5 rounded-full text-[13px] font-medium bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition-all duration-200 capitalize shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                  >
                    {term}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Category Tiles */}
            <motion.div
              variants={staggerChildren}
              initial="hidden"
              animate="visible"
              className="mb-20"
            >
              <h2 className="text-[22px] sm:text-[26px] font-bold text-neutral-900 tracking-[-0.01em] mb-8">
                Browse by Category
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {CATEGORIES.map((cat) => (
                  <motion.button
                    key={cat.slug}
                    variants={staggerItem}
                    onClick={() => handleCategoryClick(cat.slug)}
                    className="bg-white rounded-2xl p-5 sm:p-8 text-left hover:shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_24px_-8px_rgba(0,0,0,0.08)] transition-shadow duration-300 border border-neutral-100 group min-h-[44px]"
                  >
                    <span className="text-[14px] sm:text-[15px] font-medium text-neutral-900 group-hover:text-neutral-900 transition-colors leading-snug">
                      {cat.name}
                    </span>
                    <span className="block text-[13px] sm:text-[11px] text-neutral-400 mt-1.5 tracking-wide">
                      {cat.count} products across 7+ platforms
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Popular Products — editorial grid with featured lede */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[22px] sm:text-[26px] font-bold text-neutral-900 tracking-[-0.01em]">
                  Popular right now
                </h2>
                <span className="text-[11px] text-neutral-400 font-medium tracking-wide">
                  Updated hourly
                </span>
              </div>

              {/* Featured first product */}
              {TRENDING_PRODUCTS[0] && (
                <FeaturedCard product={TRENDING_PRODUCTS[0]} />
              )}

              {/* Remaining in asymmetric grid */}
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-12">
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
          <p className="text-[13px] sm:text-[12px] text-neutral-400">
            &copy; 2026 DripFeed India
          </p>
          <div className="flex gap-5 text-[13px] sm:text-[12px] text-neutral-400">
            <button
              onClick={() => navigate('/privacy')}
              className="hover:text-neutral-700 transition-colors min-h-[44px] flex items-center"
            >
              Privacy
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="hover:text-neutral-700 transition-colors min-h-[44px] flex items-center"
            >
              Terms
            </button>
            <button
              onClick={() => navigate('/affiliate-disclosure')}
              className="hover:text-neutral-700 transition-colors min-h-[44px] flex items-center"
            >
              Affiliate Disclosure
            </button>
          </div>
          <p className="text-[13px] sm:text-[10px] text-neutral-300">
            #Ad: DripFeed earns commission on purchases through our links.
          </p>
        </div>
      </footer>
    </div>
  );
}
