/**
 * SearchPage — Premium progressive search UI with streaming results.
 * Uses `useProgressiveSearch` hook for SSE-based incremental loading,
 * MasonryGrid for Pinterest-style layout, and framer-motion for fade-in animations.
 *
 * @validates Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.9
 */

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { useProgressiveSearch } from '../hooks/useProgressiveSearch';
import { ProductCard } from '../components/product/ProductCard';
import { MasonryGrid } from '../components/layout/MasonryGrid';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { SEOHead } from '../components/common/SEOHead';
import type { ValidatedProduct } from '../utils/validateProduct';

// ─── Constants ───

const TRENDING_QUERIES = ['kurta', 'sneakers', 'saree', 'denim jacket', 'watch'];

const RECENT_SEARCHES_KEY = 'tagcheck_recent_searches';
const MAX_RECENT_SEARCHES = 10;
const DISPLAY_RECENT_COUNT = 5;

/** Time (ms) to wait for first results on cache miss before showing error */
const CACHE_MISS_TIMEOUT = 3000;

// ─── Helpers ───

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): void {
  try {
    const current = getRecentSearches();
    const filtered = current.filter((s) => s.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

// ─── Component ───

export default function SearchPage() {
  const navigate = useNavigate();

  // Search state
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Cache miss timeout for error display
  const [showTimeoutError, setShowTimeoutError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchStartRef = useRef<number>(0);

  // Track previously rendered result IDs for fade-in detection
  const prevResultIdsRef = useRef<Set<string>>(new Set());

  // Progressive search hook
  const { results, loading, platforms, isStale } = useProgressiveSearch(submittedQuery);

  // Determine which results are "new" (just arrived)
  const newResultIds = useMemo(() => {
    const currentIds = new Set(results.map((r) => r.id));
    const newIds = new Set<string>();
    for (const id of currentIds) {
      if (!prevResultIdsRef.current.has(id)) {
        newIds.add(id);
      }
    }
    return newIds;
  }, [results]);

  // Update previous result IDs after rendering
  useEffect(() => {
    prevResultIdsRef.current = new Set(results.map((r) => r.id));
  }, [results]);

  // Pending platforms count (for skeleton display)
  const pendingPlatforms = platforms.filter((p) => p.status === 'pending');

  // Determine if search completed with no results
  const searchDone = submittedQuery.length >= 2 && !loading;
  const noResults = searchDone && results.length === 0 && !showTimeoutError;

  // ─── Cache miss timeout logic ───
  useEffect(() => {
    if (submittedQuery.length >= 2 && loading) {
      searchStartRef.current = Date.now();
      setShowTimeoutError(false);

      timeoutRef.current = setTimeout(() => {
        // Only show error if still loading and zero results after timeout
        if (results.length === 0) {
          setShowTimeoutError(true);
        }
      }, CACHE_MISS_TIMEOUT);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedQuery]);

  // Clear timeout error when results arrive
  useEffect(() => {
    if (results.length > 0) {
      setShowTimeoutError(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [results]);

  // Load recent searches on focus
  useEffect(() => {
    if (isFocused) {
      setRecentSearches(getRecentSearches());
    }
  }, [isFocused]);

  // Save successful searches to localStorage
  useEffect(() => {
    if (submittedQuery && results.length > 0 && !loading) {
      saveRecentSearch(submittedQuery);
    }
  }, [submittedQuery, results.length, loading]);

  // ─── Handlers ───

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = query.trim();
      if (trimmed.length < 2) return;

      // URL detection → redirect to compare
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        navigate(`/compare?url=${encodeURIComponent(trimmed)}`);
        return;
      }

      setSubmittedQuery(trimmed);
      setIsFocused(false);
      setShowTimeoutError(false);
      prevResultIdsRef.current = new Set();
    },
    [query, navigate]
  );

  const handleSuggestionClick = useCallback(
    (term: string) => {
      setQuery(term);
      setSubmittedQuery(term);
      setIsFocused(false);
      setShowTimeoutError(false);
      prevResultIdsRef.current = new Set();
    },
    []
  );

  const handleRetry = useCallback(() => {
    setShowTimeoutError(false);
    prevResultIdsRef.current = new Set();
    // Re-trigger by toggling submitted query
    const currentQuery = submittedQuery;
    setSubmittedQuery('');
    setTimeout(() => setSubmittedQuery(currentQuery), 50);
  }, [submittedQuery]);

  const handleProductTap = useCallback(
    (product: ValidatedProduct) => {
      navigate(`/compare?id=${encodeURIComponent(product.id)}`);
    },
    [navigate]
  );

  // ─── Render: Suggestions dropdown ───

  const showSuggestions = isFocused && !submittedQuery;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <SEOHead
        title={
          submittedQuery
            ? `${submittedQuery} — Best Prices Across Platforms`
            : 'Search Fashion Deals — TagCheck India'
        }
        description={
          submittedQuery
            ? `Compare prices for "${submittedQuery}" across Flipkart, Myntra, Amazon & more.`
            : 'Search and compare fashion prices across 5+ Indian platforms. Find the best deals instantly.'
        }
      />

      {/* ─── Search Header ─── */}
      <section className="bg-white border-b border-neutral-100 pb-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
          {!submittedQuery && (
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="text-[24px] sm:text-[36px] font-bold text-[#0F0F1A] text-center mb-6 leading-[1.15] tracking-[-0.02em]"
            >
              What are you looking for?
            </motion.h1>
          )}

          {/* Premium Search Input */}
          <form onSubmit={handleSubmit} className="relative">
            <div
              className={[
                'flex items-center gap-3 px-5 py-3.5 rounded-full bg-neutral-100',
                'border transition-all duration-200',
                isFocused
                  ? 'border-[#C9A96E] ring-2 ring-[#C9A96E]/20 bg-white'
                  : 'border-transparent hover:bg-neutral-50',
              ].join(' ')}
            >
              <Search className="w-5 h-5 text-neutral-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  // Delay blur to allow suggestion clicks
                  setTimeout(() => setIsFocused(false), 150);
                }}
                placeholder="Search for kurta, sneakers, saree..."
                className="flex-1 bg-transparent text-[15px] text-neutral-800 placeholder:text-neutral-400 outline-none"
                aria-label="Search products"
              />
              {query && (
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0F0F1A] text-white text-[13px] font-medium rounded-full hover:bg-[#1A1A2E] transition-colors"
                >
                  Search
                </button>
              )}
            </div>

            {/* Suggestions dropdown — within 100ms of focus */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-neutral-100 shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-50 overflow-hidden"
                >
                  {/* Recent searches */}
                  {recentSearches.length > 0 && (
                    <div className="px-5 pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em]">
                          Recent
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.slice(0, DISPLAY_RECENT_COUNT).map((term) => (
                          <button
                            key={term}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSuggestionClick(term)}
                            className="px-3.5 py-1.5 rounded-full text-[13px] text-neutral-600 bg-neutral-50 border border-neutral-100 hover:border-[#C9A96E] hover:text-[#8B7340] transition-all duration-150"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending queries */}
                  <div className="px-5 pt-3 pb-4 border-t border-neutral-50">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-3.5 h-3.5 text-[#C9A96E]" />
                      <span className="text-[11px] font-semibold text-[#C9A96E] uppercase tracking-[0.08em]">
                        Trending
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TRENDING_QUERIES.map((term) => (
                        <button
                          key={term}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSuggestionClick(term)}
                          className="px-3.5 py-1.5 rounded-full text-[13px] text-neutral-600 bg-neutral-50 border border-neutral-100 hover:border-[#C9A96E] hover:text-[#8B7340] transition-all duration-150 capitalize"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Platform status indicators during loading */}
          {submittedQuery && loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap items-center justify-center gap-2 mt-4"
            >
              {platforms.map((p) => (
                <span
                  key={p.name}
                  className={[
                    'inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all duration-300',
                    p.status === 'loaded'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : p.status === 'error'
                        ? 'bg-red-50 border-red-200 text-red-500'
                        : 'bg-white border-neutral-200 text-neutral-500',
                  ].join(' ')}
                >
                  {p.status === 'pending' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] animate-pulse" />
                  )}
                  {p.status === 'loaded' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                  {p.status === 'error' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  )}
                  <span className="capitalize">{p.name}</span>
                </span>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ─── Stale Indicator ─── */}
      <AnimatePresence>
        {isStale && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-amber-50 border-b border-amber-100"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span className="text-[13px] text-amber-700 font-medium">
                Refreshing prices...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Results Section ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Timeout Error — no results within 3 seconds on cache miss */}
        <AnimatePresence>
          {showTimeoutError && results.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="text-[40px] mb-4">⏱️</div>
              <h2 className="text-[18px] font-bold text-[#0F0F1A] mb-2">
                Results are temporarily unavailable
              </h2>
              <p className="text-[14px] text-neutral-500 mb-6 max-w-md">
                We couldn't fetch results in time. This might be a temporary issue with our scrapers.
              </p>
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#0F0F1A] text-white text-[13px] font-semibold rounded-full hover:bg-[#1A1A2E] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry search
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No results after loading completes */}
        <AnimatePresence>
          {noResults && !showTimeoutError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="text-[40px] mb-4">🔍</div>
              <h2 className="text-[18px] font-bold text-[#0F0F1A] mb-2">
                No results found
              </h2>
              <p className="text-[14px] text-neutral-500 max-w-md">
                No results found. Try a different search.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results grid with progressive loading */}
        {(results.length > 0 || (loading && pendingPlatforms.length > 0)) && !showTimeoutError && (
          <>
            {/* Result count */}
            {results.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[13px] text-neutral-500 mb-6"
              >
                {results.length} result{results.length !== 1 ? 's' : ''} found
                {loading && ' — more loading...'}
              </motion.p>
            )}

            {/* MasonryGrid with ProductCards + animated fade-in */}
            <MasonryGrid>
              <AnimatePresence mode="popLayout">
                {results.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={newResultIds.has(product.id) ? { opacity: 0, y: 12 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    layout
                  >
                    <ProductCard
                      product={product}
                      eagerLoad={results.indexOf(product) < 8}
                      priority={results.indexOf(product) < 4}
                      onTap={handleProductTap}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Skeleton placeholders for pending platforms */}
              {pendingPlatforms.length > 0 && loading && (
                <div className="col-span-full">
                  <SkeletonLoader count={6} variant="search-result" />
                </div>
              )}
            </MasonryGrid>
          </>
        )}

        {/* Initial loading state (no results yet but loading) */}
        {loading && results.length === 0 && !showTimeoutError && submittedQuery.length >= 2 && (
          <div>
            <p className="text-[13px] text-neutral-400 text-center mb-6 animate-pulse">
              Searching Flipkart, Myntra, Amazon, Meesho &amp; Ajio…
            </p>
            <SkeletonLoader count={6} variant="card" />
          </div>
        )}
      </section>

      {/* ─── Landing state (no query submitted) ─── */}
      {!submittedQuery && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
          {/* Trending searches */}
          <div className="mb-12">
            <div className="flex items-center gap-2.5 mb-5">
              <TrendingUp className="w-4 h-4 text-[#C9A96E]" />
              <h2 className="text-[12px] font-semibold text-[#C9A96E] uppercase tracking-[0.08em]">
                Trending now
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {TRENDING_QUERIES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleSuggestionClick(term)}
                  className="px-5 py-2.5 rounded-full text-[13px] font-medium bg-white text-neutral-600 border border-neutral-200 hover:bg-[#C9A96E]/5 hover:border-[#C9A96E] hover:text-[#8B7340] transition-all duration-200 capitalize shadow-[0_1px_3px_rgba(0,0,0,0.02)] min-h-[44px]"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Recent searches on landing page */}
          {getRecentSearches().length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-5">
                <Clock className="w-4 h-4 text-neutral-400" />
                <h2 className="text-[12px] font-semibold text-neutral-400 uppercase tracking-[0.08em]">
                  Recent searches
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {getRecentSearches()
                  .slice(0, DISPLAY_RECENT_COUNT)
                  .map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleSuggestionClick(term)}
                      className="px-5 py-2.5 rounded-full text-[13px] font-medium bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.02)] min-h-[44px]"
                    >
                      {term}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── Footer ─── */}
      <footer className="px-4 sm:px-8 lg:px-16 py-10 border-t border-neutral-100 bg-white mt-auto">
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
