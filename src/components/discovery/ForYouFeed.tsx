import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, Info, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { Skeleton } from '../ui/Skeleton';
import { Badge } from '../ui/Badge';
import PlatformBadge from '../ui/PlatformBadge';
import { InfiniteScroll } from '../common/InfiniteScroll';
import { formatINR } from '../../utils/format';
import { staggerChildren, staggerItem } from '../../design-system/animations';
import api from '../../services/api';

interface FeedProduct {
  title: string;
  brand?: string;
  imageUrl?: string;
  category?: string;
  price: number;
  platform: string;
  url: string;
  reason: string;
  score: number;
}

export interface ForYouFeedProps {
  className?: string;
}

export function ForYouFeed({ className = '' }: ForYouFeedProps) {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const { data } = await api.get('/feed/personalized', { params: { page: pageNum, limit: 12 } });
      if (append) {
        setProducts((prev) => [...prev, ...data.products]);
      } else {
        setProducts(data.products);
      }
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch {
      // Silent fail — feed is non-critical
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user && preferences?.onboardingCompleted) {
      fetchFeed(1);
    } else {
      setLoading(false);
    }
  }, [user, preferences, fetchFeed]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchFeed(1);
  }, [fetchFeed]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchFeed(page + 1, true);
    }
  }, [loadingMore, hasMore, page, fetchFeed]);

  // Not authenticated or no preferences — show CTA fallback
  if (!user || !preferences?.onboardingCompleted) {
    return (
      <div className={`bg-gradient-to-br from-[#F8F5F2] to-white rounded-2xl p-8 text-center ${className}`}>
        <Sparkles className="w-10 h-10 text-[#051F45] mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[#051F45] mb-2">Personalised picks, just for you</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
          Complete your style profile so we can find deals that match your taste.
        </p>
        <Link
          to="/get-started"
          className="inline-flex items-center gap-1 bg-[#051F45] text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-[#051F45]/90 transition-colors"
        >
          Set Up Profile <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#051F45]" />
            <h2 className="text-xl font-bold text-[#051F45]">For You ✨</h2>
          </div>
        </div>
        <div className="columns-2 md:columns-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-4">
              <Skeleton variant="card" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className={`text-center py-12 text-gray-400 ${className}`}>
        <p className="text-4xl mb-3">✨</p>
        <p className="font-medium text-[#051F45]">We're curating your feed</p>
        <p className="text-sm mt-1">Check back soon for personalised recommendations.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#051F45]" />
          <h2 className="text-xl font-bold text-[#051F45]">For You ✨</h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-sm text-[#051F45]/60 hover:text-[#051F45] transition-colors disabled:opacity-50"
          aria-label="Refresh feed"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Masonry Grid with Infinite Scroll */}
      <InfiniteScroll
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={handleLoadMore}
      >
        <motion.div
          className="columns-2 md:columns-3 gap-4"
          variants={staggerChildren}
          initial="hidden"
          animate="visible"
        >
          {products.map((product, index) => (
            <motion.div
              key={`${product.title}-${index}`}
              variants={staggerItem}
              className="break-inside-avoid mb-4"
            >
              <FeedProductCard product={product} />
            </motion.div>
          ))}
        </motion.div>
      </InfiniteScroll>
    </div>
  );
}

// --- Feed Product Card with "Why this pick" tooltip ---

interface FeedProductCardProps {
  product: FeedProduct;
}

function FeedProductCard({ product }: FeedProductCardProps) {
  const [showReason, setShowReason] = useState(false);

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-shadow duration-200">
      {/* Image with varied heights */}
      <div className="relative bg-[var(--df-bg-warm)] overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-40 flex items-center justify-center text-gray-300 text-4xl">
            🛍️
          </div>
        )}

        {/* Platform Badge */}
        <div className="absolute top-2 left-2">
          <PlatformBadge platform={product.platform} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-1">
        {product.brand && (
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            {product.brand}
          </p>
        )}
        <p className="text-sm font-medium text-[var(--df-accent-navy)] line-clamp-2 leading-snug">
          {product.title}
        </p>

        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold text-[var(--df-accent-navy)]">
            {formatINR(product.price)}
          </span>

          {/* "Why this pick" tooltip badge */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReason(!showReason);
              }}
              onMouseEnter={() => setShowReason(true)}
              onMouseLeave={() => setShowReason(false)}
              className="inline-flex items-center gap-0.5 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full hover:bg-green-100 transition-colors"
              aria-label="Why this pick"
            >
              <Info className="w-3 h-3" />
              <span className="hidden sm:inline">Why?</span>
            </button>

            {/* Tooltip */}
            {showReason && (
              <div className="absolute bottom-full right-0 mb-2 z-10 bg-[#051F45] text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                {product.reason}
                <div className="absolute top-full right-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#051F45]" />
              </div>
            )}
          </div>
        </div>

        {/* Small reason badge (always visible on mobile) */}
        <Badge variant="success" size="sm" className="mt-1 self-start text-xs">
          {product.reason}
        </Badge>
      </div>
    </div>
  );
}

export default ForYouFeed;
