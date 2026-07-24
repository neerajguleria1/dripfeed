import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SlidersHorizontal, ArrowRight, TrendingUp, Sparkles, Recycle, Check, Link2, Bookmark, BookmarkCheck } from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import { SearchFilters } from '../components/search/SearchFilters';
import { InfiniteScroll } from '../components/common/InfiniteScroll';
import { SEOHead } from '../components/common/SEOHead';
import api from '../services/api';
import { staggerChildren, staggerItem } from '../design-system/animations';
import type { ProductData } from '../types/product';
import type { FilterState } from '../components/search/SearchFilters';

interface ThriftResult {
  _id: string;
  title: string;
  brand?: string;
  price: number;
  images: string[];
  condition: string;
  size: string;
  city: string;
  whatsappNumber: string;
}


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

// ─────────────────────────────────────────────────────────────────────────────
// Featured Product Card — Premium gold-accented lede card
// ─────────────────────────────────────────────────────────────────────────────

function gtagEvent(name: string, params: Record<string, unknown>) {
  if (typeof (window as any).gtag === 'function') (window as any).gtag('event', name, params);
}

async function trackAndOpen(product: ProductData) {
  gtagEvent('select_item', {
    item_list_name: 'search_results',
    items: [{ item_name: product.title, item_brand: product.brand, item_category: product.platform, price: product.price }],
  });
  try {
    const res = await fetch('/api/affiliate/redirect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: product.platform,
        productUrl: product.url,
        productName: product.title,
        device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'web',
        sessionId: sessionStorage.getItem('df_sid') || (() => {
          const id = Math.random().toString(36).slice(2);
          sessionStorage.setItem('df_sid', id);
          return id;
        })(),
      }),
    });
    const { affiliateUrl } = await res.json();
    window.open(affiliateUrl || product.url, '_blank', 'noopener,noreferrer');
  } catch {
    window.open(product.url, '_blank', 'noopener,noreferrer');
  }
}

function FeaturedCard({ product, onSave, saved }: { product: ProductData; onSave?: (p: ProductData) => void; saved?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    await navigator.clipboard.writeText(product.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const savings = product.originalPrice && product.originalPrice > product.price
    ? product.originalPrice - product.price
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="col-span-full flex gap-3 bg-white rounded-2xl border border-neutral-100 overflow-hidden mb-4 relative active:scale-[0.99] transition-transform"
    >
      {/* Best Match badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1
        bg-[#C9A96E] text-white text-[10px] font-semibold uppercase tracking-[0.06em]
        px-2.5 py-1 rounded-full shadow-sm">
        <Sparkles className="w-2.5 h-2.5" />
        Best
      </div>

      {/* Image — fixed width on mobile */}
      <a
        href={product.url} target="_blank" rel="noopener noreferrer"
        onClick={(e) => { e.preventDefault(); trackAndOpen(product); }}
        className="w-[140px] sm:w-[200px] flex-shrink-0 overflow-hidden bg-neutral-50"
      >
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-full object-cover"
          loading="eager"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=533&fit=crop'; }}
        />
      </a>

      {/* Details */}
      <div className="flex flex-col justify-between py-4 pr-4 flex-1 min-w-0">
        <div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white capitalize mb-2"
            style={{ backgroundColor: PLATFORM_COLORS[product.platform.toLowerCase().replace(/\s+/g, '')] || '#6b7280' }}
          >
            {product.platform}
          </span>
          <p className="text-[11px] text-neutral-400 font-medium truncate">{product.brand}</p>
          <h2 className="text-[14px] sm:text-[16px] font-bold text-[#0F0F1A] leading-snug mt-1 line-clamp-3">
            {product.title}
          </h2>

          {/* Variant metadata — display only */}
          {(product.color || product.size) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.color && (
                <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">
                  <span>&#127912;</span> <span className="capitalize">{product.color}</span>
                </span>
              )}
              {product.size && (
                <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">
                  <span>&#128207;</span> {product.size}
                </span>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-[18px] font-bold text-[#0F0F1A] tabular-nums">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[12px] text-neutral-400 line-through tabular-nums">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          {savings > 0 && (
            <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              Save {formatPrice(savings)}
            </span>
          )}
          <div className="mt-3 flex items-center gap-2">
            <a
              href={product.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => { e.preventDefault(); trackAndOpen(product); }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#171310] text-white text-[12px] font-semibold py-2.5 rounded-xl active:bg-[#C9A96E] transition-colors"
            >
              Buy now <ArrowRight className="w-3 h-3" />
            </a>
            <button onClick={handleCopy} aria-label="Copy link"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-neutral-50 border border-neutral-100 active:bg-neutral-100 transition-colors flex-shrink-0">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Link2 className="w-3.5 h-3.5 text-neutral-400" />}
            </button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave?.(product); }} aria-label="Save product"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-neutral-50 border border-neutral-100 active:bg-neutral-100 transition-colors flex-shrink-0">
              {saved ? <BookmarkCheck className="w-3.5 h-3.5 text-[#C9A96E]" /> : <Bookmark className="w-3.5 h-3.5 text-neutral-400" />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard Result Card — White card with subtle border, premium styling
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({ product, index, onSave, saved }: { product: ProductData; index: number; onSave?: (p: ProductData) => void; saved?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    await navigator.clipboard.writeText(product.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.4, 0, 0.2, 1] }}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-neutral-100 active:scale-[0.98] transition-all duration-200"
    >
      {/* Image — tappable area opens product */}
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => { e.preventDefault(); trackAndOpen(product); }}
        className="block overflow-hidden bg-neutral-50 relative"
      >
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full aspect-[3/4] object-cover"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=533&fit=crop'; }}
        />
        {/* Platform badge — top left */}
        <span
          className="absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white capitalize shadow-sm"
          style={{ backgroundColor: PLATFORM_COLORS[product.platform.toLowerCase().replace(/\s+/g, '')] || '#6b7280' }}
        >
          {product.platform}
        </span>
        {/* Discount badge — top right */}
        {product.discount && product.discount > 0 && (
          <span className="absolute top-2 right-2 bg-[#171310] text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">
            -{Math.round(Number(product.discount))}%
          </span>
        )}
      </a>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[11px] text-neutral-400 font-medium truncate">{product.brand}</p>
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { e.preventDefault(); trackAndOpen(product); }}
          className="text-[13px] font-medium text-[#0F0F1A] leading-snug mt-0.5 line-clamp-2 min-h-[36px]"
        >
          {product.title}
        </a>

        {/* Variant metadata — display only, shown when platform provides it */}
        {(product.color || product.size) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {product.color && (
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">
                <span>&#127912;</span> <span className="capitalize">{product.color}</span>
              </span>
            )}
            {product.size && (
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">
                <span>&#128207;</span> {product.size}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between gap-1">
          <div>
            <span className="text-[15px] font-bold text-[#0F0F1A] tabular-nums">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="block text-[11px] text-neutral-400 line-through tabular-nums">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          {/* Copy + Save buttons */}
          <div className="flex items-center gap-1.5">
            <button onClick={handleCopy} aria-label="Copy link"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-50 border border-neutral-100 active:bg-neutral-100 transition-colors">
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Link2 className="w-3 h-3 text-neutral-400" />}
            </button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave?.(product); }} aria-label="Save product"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-50 border border-neutral-100 active:bg-neutral-100 transition-colors">
              {saved ? <BookmarkCheck className="w-3 h-3 text-[#C9A96E]" /> : <Bookmark className="w-3 h-3 text-neutral-400" />}
            </button>
          </div>
        </div>

        {/* Buy button — full width, prominent on mobile */}
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { e.preventDefault(); trackAndOpen(product); }}
          className="mt-2.5 flex items-center justify-center gap-1.5 bg-[#171310] text-white text-[12px] font-semibold py-2.5 rounded-xl active:bg-[#C9A96E] transition-colors"
        >
          Buy on {product.platform.split(' ')[0]}
          <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Loader — Premium shimmer
// ─────────────────────────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {/* Searching message */}
      <div className="text-center mb-10">
        <p className="text-[13px] text-neutral-400 animate-pulse">
          Searching Amazon, Flipkart, Ajio &amp; more…
        </p>
        <p className="text-[11px] text-neutral-300 mt-1">Results appear as each platform responds</p>
      </div>
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
  const [searchError, setSearchError] = useState('');
  const [platformStatus, setPlatformStatus] = useState<Record<string, 'loading' | 'done' | 'empty'>>({});
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [hasMore, setHasMore] = useState(false);
  const [trendingProducts, setTrendingProducts] = useState<ProductData[]>([]);
  const [relatedSections, setRelatedSections] = useState<{ label: string; sections: { query: string; products: ProductData[] }[] } | null>(null);

  const [thriftResults, setThriftResults] = useState<ThriftResult[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('df_saved') || '[]')); } catch { return new Set(); }
  });

  function handleSave(product: ProductData) {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(product.id)) next.delete(product.id); else next.add(product.id);
      localStorage.setItem('df_saved', JSON.stringify([...next]));
      return next;
    });
  }

  // ── Data Fetching ─────────────────────────────────────────────────────────

  // Progressive/streaming search: renders each platform's results the moment
  // they arrive instead of waiting for the slowest platform (Ajio can take
  // longer on ScraperAPI escalation, while Amazon/Flipkart often resolve in
  // a few seconds). Falls back to the original blocking endpoint if the
  // browser doesn't support EventSource or the stream errors immediately.
  const fetchResultsStreaming = useCallback((searchQuery: string): boolean => {
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return false;

    const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
    const url = `${base}/search/product/stream?q=${encodeURIComponent(searchQuery)}`;

    let settled = false;
    const es = new EventSource(url);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'platform' && Array.isArray(payload.products) && payload.products.length) {
          settled = true;
          setLoading(false);
          setPlatformStatus(prev => ({ ...prev, [payload.platform]: 'done' }));
          setProducts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newOnes = (payload.products as ProductData[]).filter((p) => !existingIds.has(p.id));
            return [...prev, ...newOnes].sort((a, b) => a.price - b.price);
          });
        } else if (payload.type === 'platform' && Array.isArray(payload.products) && !payload.products.length) {
          setPlatformStatus(prev => ({ ...prev, [payload.platform]: 'empty' }));
        } else if (payload.type === 'done') {
          setLoading(false);
          setHasMore(false);
          setPlatformStatus(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(k => { if (updated[k] === 'loading') updated[k] = 'empty'; });
            return updated;
          });
          es.close();
        } else if (payload.type === 'error') {
          setLoading(false);
          es.close();
          if (payload.message === 'no_keys') {
            setSearchError('Live prices are temporarily unavailable. Please try again in a few minutes.');
          } else if (!settled) {
            fetchResultsBlocking(searchQuery);
          }
        }
      } catch {
        // ignore malformed SSE frames
      }
    };

    es.onerror = () => {
      // If we never received any platform data before the stream errored,
      // let the caller fall back to the blocking endpoint. If we already got
      // partial results, just end gracefully — the user still sees them.
      es.close();
      if (!settled) fetchResultsBlocking(searchQuery);
      else setLoading(false);
    };

    return true;
  }, []);

  const fetchResultsBlocking = useCallback(async (searchQuery: string) => {
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

  const fetchThrift = useCallback(async (searchQuery: string) => {
    try {
      const { data } = await api.get('/thrift', { params: { q: searchQuery, limit: '4' } });
      setThriftResults(data.listings || []);
    } catch { setThriftResults([]); }
  }, []);

  const fetchResults = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) { setProducts([]); return; }
    setLoading(true);
    setProducts([]);
    setSearchError('');
    setPlatformStatus({ amazon: 'loading', flipkart: 'loading', ajio: 'loading', myntra: 'loading', meesho: 'loading' });
    setRelatedSections(null);

    const streamed = fetchResultsStreaming(searchQuery);
    if (!streamed) fetchResultsBlocking(searchQuery);

    // Defer secondary calls by 2s so they don't compete with the main search
    // for network/DB resources during the critical first-results window.
    setTimeout(() => {
      fetchThrift(searchQuery);
      api.get(`/search/related?q=${encodeURIComponent(searchQuery)}`)
        .then(({ data: rel }) => { if (rel?.sections?.length) setRelatedSections(rel); })
        .catch(() => {});
    }, 2000);
  }, [fetchResultsStreaming, fetchResultsBlocking, fetchThrift]);

  // Fetch real trending products for landing page
  useEffect(() => {
    if (query) return; // only on landing
    api.get('/search/trending').then(({ data }) => {
      const items: ProductData[] = (data.products || data || []).slice(0, 9);
      if (items.length) setTrendingProducts(items);
    }).catch(() => {});
  }, [query]);

  useEffect(() => {
    if (query) {
      if (query.startsWith('http://') || query.startsWith('https://')) {
        navigate(`/compare?url=${encodeURIComponent(query)}`, { replace: true });
        return;
      }
      fetchResults(query);
    } else {
      setProducts([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearch(newQuery: string) {
    const trimmed = newQuery.trim();
    if (!trimmed) return;
    gtagEvent('search', { search_term: trimmed });
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
            : 'Search Fashion Deals — TagCheck India'
        }
        description={
          query
            ? `Compare prices for "${query}" across Ajio, Amazon & Flipkart.`
            : 'Search and compare fashion prices across 3+ Indian platforms. Find the best deals instantly.'
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

          {/* Search bar */}
          <SearchBar size="lg" initialQuery={query} onSearch={handleSearch} />

          {/* Live platform status — shows while streaming */}
          {query && loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap items-center justify-center gap-2 mt-4"
            >
              {Object.entries(platformStatus).map(([platform, status]) => (
                <span key={platform} className={[
                  'inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-300',
                  status === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  status === 'empty' ? 'bg-neutral-50 border-neutral-200 text-neutral-400' :
                  'bg-white border-neutral-200 text-neutral-500'
                ].join(' ')}>
                  {status === 'loading' && <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] animate-pulse" />}
                  {status === 'done' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {status === 'empty' && <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />}
                  <span className="capitalize">{platform}</span>
                </span>
              ))}
            </motion.div>
          )}

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
              {filteredProducts[0] && <FeaturedCard product={filteredProducts[0]} onSave={handleSave} saved={savedIds.has(filteredProducts[0].id)} />}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {gridProducts.map((product, i) => (
                  <ResultCard key={product.id || i} product={product} index={i} onSave={handleSave} saved={savedIds.has(product.id)} />
                ))}
              </div>
            </InfiniteScroll>
          </div>
        </section>
      )}

      {/* ── Thrift Section ───────────────────────────────────────────────── */}
      {showResults && thriftResults.length > 0 && (
        <section className="bg-white border-t border-neutral-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <Recycle className="w-4 h-4 text-emerald-600" />
                <h2 className="text-[12px] font-semibold text-emerald-600 uppercase tracking-[0.08em]">
                  Found cheaper secondhand
                </h2>
              </div>
              <button onClick={() => navigate('/thrift')} className="text-[12px] text-[#C9A96E] font-medium hover:underline flex items-center gap-1">
                See all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {thriftResults.map((t) => {
                const wa = `https://wa.me/${t.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I'm interested in "${t.title}" listed on TagCheck.`)}`;
                return (
                  <a key={t._id} href={wa} target="_blank" rel="noopener noreferrer"
                    className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-neutral-100 hover:border-emerald-200 hover:shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)] transition-all duration-300">
                    <div className="overflow-hidden bg-neutral-50">
                      {t.images[0]
                        ? <img src={t.images[0]} alt={t.title} className="w-full aspect-[3/4] object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                        : <div className="w-full aspect-[3/4] flex items-center justify-center text-3xl">👗</div>}
                    </div>
                    <div className="p-3 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 w-fit capitalize">{t.condition.replace('-', ' ')}</span>
                      {t.brand && <p className="text-[11px] text-neutral-400 uppercase tracking-wide">{t.brand}</p>}
                      <p className="text-[13px] font-medium text-[#0F0F1A] line-clamp-2">{t.title}</p>
                      <p className="text-[11px] text-neutral-400">{t.city} · Size {t.size}</p>
                      <p className="text-[15px] font-bold text-[#0F0F1A] font-serif tabular-nums mt-1">₹{t.price.toLocaleString('en-IN')}</p>
                      <span className="text-[11px] text-emerald-600 font-medium mt-0.5">WhatsApp Seller →</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Complete the Look ─────────────────────────────────────────────── */}
      {showResults && relatedSections && relatedSections.sections.length > 0 && (
        <section className="bg-white border-t border-neutral-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
            <div className="flex items-center gap-2.5 mb-8">
              <Sparkles className="w-4 h-4 text-[#C9A96E]" />
              <h2 className="text-[12px] font-semibold text-[#C9A96E] uppercase tracking-[0.08em]">
                {relatedSections.label}
              </h2>
            </div>
            <div className="space-y-10">
              {relatedSections.sections.map((section) => (
                <div key={section.query}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[16px] font-semibold text-[#0F0F1A] capitalize">
                      {section.query}
                    </h3>
                    <button
                      onClick={() => handleTrendingClick(section.query)}
                      className="text-[12px] text-[#C9A96E] font-medium hover:underline flex items-center gap-1"
                    >
                      See all <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {section.products.map((product, i) => (
                      <ResultCard key={product.id || i} product={product} index={i} onSave={handleSave} saved={savedIds.has(product.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Error State ──────────────────────────────────────────────────────── */}
      {searchError && (
        <section className="bg-[#FAFAFA]">
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <p className="text-4xl mb-4">⚠️</p>
            <p className="text-[15px] text-neutral-600 font-medium">{searchError}</p>
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
              {trendingProducts[0] && (
                <FeaturedCard product={trendingProducts[0]} onSave={handleSave} saved={savedIds.has(trendingProducts[0].id)} />
              )}

              {/* Remaining products grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {trendingProducts.slice(1).map((product, i) => (
                  <ResultCard key={product.id} product={product} index={i} onSave={handleSave} saved={savedIds.has(product.id)} />
                ))}
              </div>
            </motion.div>

          </div>
        </section>
      )}

      {/* ── Affiliate Disclosure Footer ──────────────────────────────────────── */}
      {/* Mobile sticky compare bar */}
      {showResults && query && (
        <div className="fixed bottom-[64px] left-0 right-0 sm:hidden z-30 px-4 pb-2">
          <button
            onClick={() => navigate(`/compare?q=${encodeURIComponent(query)}`)}
            className="w-full flex items-center justify-center gap-2 bg-[#C9A96E] text-[#171310] font-bold text-[14px] py-3.5 rounded-2xl shadow-[0_4px_20px_rgba(201,169,110,0.4)] active:scale-[0.98] transition-transform"
          >
            <Sparkles className="w-4 h-4" />
            Compare all prices
          </button>
        </div>
      )}

      <footer className="px-4 sm:px-8 lg:px-16 py-10 pb-36 sm:pb-10 border-t border-neutral-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-neutral-600">
            &copy; 2026 TagCheck India
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
            #Ad: TagCheck earns commission on purchases through our links.
          </p>
        </div>
      </footer>
    </div>
  );
}
