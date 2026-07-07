import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingDown, ArrowRight } from 'lucide-react';
import { SEOHead } from '../components/common/SEOHead';
import { PlatformBadge } from '../components/ui/PlatformBadge';
import { formatINR } from '../utils/format';
import { staggerChildren } from '../design-system/animations';
import api from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Deal {
  _id: string;
  title: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  platform: string;
  currentPrice: number;
  originalPrice: number;
  dropPercent: number;
  url: string;
  detectedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_FILTERS = ['All', 'Myntra', 'Ajio', 'Flipkart', 'Amazon', 'Nykaa', 'Meesho'];
const DISCOUNT_FILTERS = [0, 20, 40, 60];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isRecentDeal(dateStr: string): boolean {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = diff / (1000 * 60 * 60);
  return hrs < 6;
}

/**
 * Tiny inline sparkline SVG — a minimal 40px-wide polyline
 * representing a simplified 90-day price trend (downward).
 */
function PriceSparkline({ drop }: { drop: number }) {
  // Generate a believable downward sparkline based on drop magnitude
  const intensity = Math.min(drop / 80, 1);
  const midY = 10 - intensity * 4;
  const points = `0,10 8,${11 - intensity * 2} 16,${midY + 2} 24,${midY} 32,${midY - 1} 40,${2 + (1 - intensity) * 4}`;

  return (
    <svg
      width="40"
      height="12"
      viewBox="0 0 40 12"
      fill="none"
      className="inline-block ml-1.5 align-middle"
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke="#C9A96E"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.7"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function DealCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-5 border border-neutral-100 animate-pulse">
      <div className="flex gap-4">
        <div className="w-[88px] h-[88px] bg-neutral-100 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="h-2.5 bg-neutral-100 rounded-full w-16" />
          <div className="h-3.5 bg-neutral-100 rounded-full w-3/4" />
          <div className="h-3 bg-neutral-100 rounded-full w-1/2" />
          <div className="h-2.5 bg-neutral-100 rounded-full w-20" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Deal Card
// ─────────────────────────────────────────────────────────────────────────────

function DealCard({ deal, index }: { deal: Deal; index: number }) {
  const recent = isRecentDeal(deal.detectedAt);

  return (
    <motion.a
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.03, ease: [0.4, 0, 0.2, 1] }}
      className={[
        'group flex flex-col bg-white rounded-xl overflow-hidden',
        'border border-neutral-100 hover:border-[#C9A96E]/30',
        'hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_12px_24px_-8px_rgba(0,0,0,0.08)]',
        'transition-all duration-300',
        recent ? 'border-l-2 border-l-[#C9A96E]' : '',
      ].join(' ')}
    >
      <div className="p-5">
        <div className="flex gap-4">
          {/* Image */}
          {deal.imageUrl ? (
            <div className="w-[88px] h-[88px] flex-shrink-0 overflow-hidden rounded-xl bg-neutral-50">
              <img
                src={deal.imageUrl}
                alt={deal.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-[88px] h-[88px] flex-shrink-0 rounded-xl bg-neutral-50 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-neutral-300" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Brand */}
            {deal.brand && (
              <p className="text-[13px] sm:text-[11px] uppercase tracking-[0.06em] text-neutral-500 font-medium mb-1">
                {deal.brand}
              </p>
            )}

            {/* Title */}
            <h3 className="text-[14px] sm:text-[15px] font-medium text-[#0F0F1A] leading-snug line-clamp-2 mb-2.5">
              {deal.title}
            </h3>

            {/* Price block */}
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[16px] sm:text-[18px] font-serif font-bold text-[#0F0F1A] tabular-nums">
                {formatINR(deal.currentPrice)}
              </span>
              <span className="text-[13px] text-neutral-400 line-through tabular-nums">
                {formatINR(deal.originalPrice)}
              </span>
              <span className="inline-flex items-center bg-emerald-50 text-emerald-700 text-[12px] font-medium px-2 py-0.5 rounded-full">
                {deal.dropPercent}% off
              </span>
              <PriceSparkline drop={deal.dropPercent} />
            </div>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-50">
          <div className="flex items-center gap-2.5">
            <PlatformBadge platform={deal.platform} size="sm" />
            <span className="text-[13px] sm:text-[11px] text-neutral-400 tabular-nums">
              {timeAgo(deal.detectedAt)}
            </span>
          </div>

          {/* Scarcity copy — only on recent deals */}
          {recent && (
            <span className="text-[13px] sm:text-[12px] text-[#C9A96E] font-medium">
              Limited availability
            </span>
          )}
        </div>
      </div>
    </motion.a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [platformFilter, setPlatformFilter] = useState('All');
  const [minDiscount, setMinDiscount] = useState(0);

  useEffect(() => {
    api.get('/products/deals')
      .then(({ data }) => setDeals(data.deals || []))
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredDeals = useMemo(() => {
    let result = [...deals];
    if (platformFilter !== 'All') {
      result = result.filter((d) => d.platform.toLowerCase() === platformFilter.toLowerCase());
    }
    if (minDiscount > 0) {
      result = result.filter((d) => d.dropPercent >= minDiscount);
    }
    // Sort: recent first, then by highest drop
    result.sort((a, b) => {
      const aRecent = isRecentDeal(a.detectedAt) ? 1 : 0;
      const bRecent = isRecentDeal(b.detectedAt) ? 1 : 0;
      if (bRecent !== aRecent) return bRecent - aRecent;
      return b.dropPercent - a.dropPercent;
    });
    return result;
  }, [deals, platformFilter, minDiscount]);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    deals.forEach((d) => {
      const key = d.platform.charAt(0).toUpperCase() + d.platform.slice(1).toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [deals]);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <SEOHead
        title="Price Drops — Real-Time Tracking"
        description="Real-time price tracking across Myntra, Ajio, Amazon, Flipkart and more. Data-driven deals, no noise."
      />

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <section className="pb-6 sm:pb-10 bg-white border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <h1 className="text-[22px] font-bold text-[#0F0F1A] tracking-[-0.01em]">
              Price Drops
            </h1>
            <p className="text-[14px] text-neutral-500 mt-1.5">
              Real-time price tracking across platforms
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Filter Bar ───────────────────────────────────────────────────────── */}
      <section className="bg-white/95 backdrop-blur-sm border-b border-neutral-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          {/* Platform pills — horizontally scrollable on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2.5 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {PLATFORM_FILTERS.map((platform) => (
              <button
                key={platform}
                onClick={() => setPlatformFilter(platform)}
                className={[
                  'px-4 py-2.5 sm:py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200 min-h-[44px] sm:min-h-0 flex-shrink-0',
                  platformFilter === platform
                    ? 'bg-[#C9A96E] text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                    : 'bg-white text-neutral-600 border border-neutral-200 hover:border-[#C9A96E]/30 hover:text-[#0F0F1A]',
                ].join(' ')}
              >
                {platform}
                {platform !== 'All' && platformCounts[platform] ? (
                  <span className="ml-1.5 text-[13px] sm:text-[11px] opacity-60">
                    {platformCounts[platform]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Discount percentage pills */}
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {DISCOUNT_FILTERS.map((disc) => (
              <button
                key={disc}
                onClick={() => setMinDiscount(disc)}
                className={[
                  'px-3.5 py-2 sm:py-1.5 rounded-full text-[13px] sm:text-[12px] font-medium transition-all duration-200 min-h-[44px] sm:min-h-0 flex-shrink-0',
                  minDiscount === disc
                    ? 'bg-[#C9A96E] text-white'
                    : 'bg-white text-neutral-500 border border-neutral-200 hover:border-[#C9A96E]/30 hover:text-neutral-700',
                ].join(' ')}
              >
                {disc === 0 ? 'Any discount' : `${disc}%+ off`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Deals Grid ───────────────────────────────────────────────────────── */}
      <section className="bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-24 sm:pb-10">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <DealCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredDeals.length === 0 ? (
            /* ── Empty State ────────────────────────────────────────────────── */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-md mx-auto text-center py-20"
            >
              <TrendingDown className="w-7 h-7 text-neutral-300 mx-auto mb-5" />
              <h2 className="text-[18px] font-medium text-[#0F0F1A] mb-2 tracking-[-0.01em]">
                No matching price drops
              </h2>
              <p className="text-[14px] text-neutral-500 leading-relaxed mb-8">
                Watching prices across 7+ platforms. New drops are detected every few minutes.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => { setPlatformFilter('All'); setMinDiscount(0); }}
                  className="inline-flex items-center gap-2 bg-[#C9A96E] text-white font-medium px-6 py-2.5 rounded-full text-[13px] hover:bg-[#B8964F] transition-colors min-h-[44px]"
                >
                  Clear filters
                </button>
                <button
                  onClick={() => navigate('/search')}
                  className="inline-flex items-center gap-2 bg-white text-neutral-600 font-medium px-6 py-2.5 rounded-full text-[13px] border border-neutral-200 hover:border-[#C9A96E]/30 transition-colors min-h-[44px]"
                >
                  Search products <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Results count */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-[13px] text-neutral-500">
                  {filteredDeals.length} price drop{filteredDeals.length !== 1 ? 's' : ''} found
                </p>
                <span className="text-[13px] sm:text-[11px] text-neutral-400 font-medium tracking-wide">
                  Updated continuously
                </span>
              </div>

              {/* Grid */}
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                variants={staggerChildren}
                initial="hidden"
                animate="visible"
              >
                {filteredDeals.map((deal, index) => (
                  <DealCard key={deal._id} deal={deal} index={index} />
                ))}
              </motion.div>
            </>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="px-4 sm:px-8 lg:px-16 py-10 border-t border-neutral-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] sm:text-[12px] text-neutral-400">
            &copy; 2026 DripFeed India
          </p>
          <div className="flex gap-5 text-[13px] sm:text-[12px] text-neutral-400">
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
          <p className="text-[13px] sm:text-[10px] text-neutral-300">
            #Ad: DripFeed earns commission on purchases through our links.
          </p>
        </div>
      </footer>
    </div>
  );
}
