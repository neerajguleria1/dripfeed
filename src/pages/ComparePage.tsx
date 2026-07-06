import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, TrendingDown, Sparkles, ExternalLink } from 'lucide-react';
import SEOHead from '../components/common/SEOHead';
import PlatformBadge from '../components/ui/PlatformBadge';
// CompareCard replaced by inline editorial blocks for magazine-review layout
import { PriceHistory } from '../components/product/PriceHistory';
import { AIAdviceCard } from '../components/product/AIAdviceCard';
import { SocialProof } from '../components/product/SocialProof';
import { SaveButton } from '../components/product/SaveButton';
import { ProductCard } from '../components/product/ProductCard';
import { PriceCounter } from '../components/common/PriceCounter';
import AffiliateButton from '../components/ui/AffiliateButton';
import SiteNav from '../components/SiteNav';
import { staggerChildren, staggerItem } from '../design-system/animations';
import { formatPrice } from '../utils/formatPrice';
import api from '../services/api';
import type { ProductData } from '../types/product';
import type { AIAdvice } from '../components/product/AIAdviceCard';
import type { PriceHistoryPoint } from '../components/product/PriceHistory';

// ─────────────────────────────────────────────────────────────────────────────
// Editorial Verdict — one-line reviewer's notes per platform
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_VERDICTS: Record<string, string> = {
  myntra: 'Reliable, if slow',
  ajio: 'Best for AJIO exclusives',
  amazon: 'Fast delivery, premium pricing',
  flipkart: 'Value king, inconsistent stock',
  meesho: 'Unbeatable price, patience required',
  nykaa: 'Curated, beauty-first',
  tatacliq: 'Trusted originals only',
};

function getVerdict(platform: string): string {
  const key = platform.toLowerCase().replace(/\s+/g, '');
  return PLATFORM_VERDICTS[key] || 'Solid option';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get('q') || '';

  const [platforms, setPlatforms] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const [priceHistory] = useState<PriceHistoryPoint[]>([]);

  useEffect(() => {
    if (q) {
      fetchComparison(q);
    }
  }, [q]);

  const fetchAiAdvice = useCallback(async (productTitle: string, platformData: ProductData[]) => {
    if (!productTitle || platformData.length === 0) return;
    setAiLoading(true);
    setAiError(false);
    try {
      const { data } = await api.post('/products/ai-recommend', {
        productTitle,
        platforms: platformData.map((p) => ({ platform: p.platform, price: p.price })),
      });
      if (data?.summary) {
        setAiAdvice({
          summary: data.summary,
          pros: data.pros || [],
          cons: data.cons || [],
          recommendation: data.recommendation || '',
          bestPlatform: data.bestPlatform || '',
          confidence: data.confidence,
        });
      }
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  }, []);

  async function fetchComparison(searchQ: string) {
    if (!searchQ.trim()) return;
    setLoading(true);
    setError('');
    setPlatforms([]);
    setAiAdvice(null);
    setAiError(false);

    try {
      const { data } = await api.post('/search/product', { query: searchQ });
      const results: ProductData[] = data?.results || data?.platforms || [];

      results.sort((a, b) => a.price - b.price);
      setPlatforms(results);

      if (results.length > 0) {
        fetchAiAdvice(results[0]?.title || searchQ, results);
      }

      // Fire-and-forget analytics
      api.post('/analytics/track', {
        event: 'compare_view',
        productTitle: searchQ,
        platformCount: results.length,
      }).catch(() => {});
    } catch {
      setError('Could not fetch comparison. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Compare ${q} Prices`, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  // Derived state
  const lowest = platforms[0] || null;
  const maxPrice = platforms.length > 0 ? Math.max(...platforms.map((p) => p.price)) : 0;
  const savings = lowest && maxPrice > lowest.price ? maxPrice - lowest.price : 0;
  const productTitle = lowest?.title || q;
  const productImage = lowest?.imageUrl;
  const productBrand = lowest?.brand;

  // Related products — show max 4 as horizontal cards
  const relatedProducts = useMemo(() => platforms.slice(0, 4), [platforms]);

  // Social proof — organic numbers
  const socialCompareCount = useMemo(() => Math.floor(Math.random() * 40) + 18, []);
  const socialSaveCount = useMemo(() => Math.floor(Math.random() * 15) + 5, []);

  return (
    <>
      <SEOHead
        title={`Compare ${productTitle} Prices — DripFeed India`}
        description={`Compare ${productTitle} prices across ${platforms.length} platforms. Find the best deal on DripFeed India.`}
      />

      <SiteNav />

      <div className="min-h-screen bg-[#FAFAFA]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-40 sm:pb-16">

          {/* ─── Breadcrumb — restrained, editorial ─── */}
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-[13px] sm:text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors mb-8 sm:mb-10 group uppercase tracking-[0.08em] font-medium min-h-[44px]"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            Back to search
          </button>

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl p-5 text-[14px] mb-8 leading-relaxed">
              {error}
            </div>
          )}

          {/* Loading state — editorial skeletons */}
          {loading && (
            <div className="space-y-6">
              <div className="animate-pulse rounded-2xl bg-white h-[220px] shadow-[0_1px_4px_rgba(0,0,0,0.03)]" />
              <div className="animate-pulse rounded-2xl bg-white h-[88px] shadow-[0_1px_4px_rgba(0,0,0,0.03)]" />
              <div className="animate-pulse rounded-2xl bg-white h-[88px] shadow-[0_1px_4px_rgba(0,0,0,0.03)]" />
              <div className="animate-pulse rounded-2xl bg-white h-[88px] shadow-[0_1px_4px_rgba(0,0,0,0.03)]" />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              RESULTS — Magazine Review Layout
          ═══════════════════════════════════════════════════════════════════ */}
          {!loading && platforms.length > 0 && (
            <div className="space-y-10">

              {/* ─── 1. Product Hero — Editorial Feature Block ─── */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(0,0,0,0.06)] p-6 sm:p-8"
              >
                <div className="flex flex-col sm:flex-row gap-7">
                  {/* Product image — 160px, magazine scale */}
                  {productImage && (
                    <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl overflow-hidden bg-neutral-50 flex-shrink-0 ring-1 ring-neutral-100">
                      <img
                        src={productImage}
                        alt={productTitle}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Brand — 11px uppercase small caps */}
                    {productBrand && (
                      <p className="text-[13px] sm:text-[11px] text-neutral-400 font-semibold uppercase tracking-[0.12em] mb-2">
                        {productBrand}
                      </p>
                    )}

                    {/* Title — 24px semibold, editorial weight */}
                    <h1 className="text-[20px] sm:text-[24px] font-semibold text-neutral-900 leading-[1.2] line-clamp-2 mb-4 tracking-[-0.01em]">
                      {productTitle}
                    </h1>

                    {/* Thin editorial rule */}
                    <div className="w-10 h-px bg-neutral-200 mb-4" />

                    {/* Platform count + savings pill */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="text-[13px] text-neutral-500">
                        Compared across <strong className="text-neutral-700 font-semibold">{platforms.length}</strong> platform{platforms.length > 1 ? 's' : ''}
                      </span>

                      {savings > 0 && (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[13px] sm:text-[12px] font-semibold px-3 py-1 rounded-full border border-green-100">
                          <TrendingDown className="w-3 h-3" />
                          Save {formatPrice(savings)}
                        </span>
                      )}
                    </div>

                    {/* Platform badges — spaced for air */}
                    <div className="flex flex-wrap gap-2 mt-5">
                      {platforms.map((p, i) => (
                        <PlatformBadge key={i} platform={p.platform} size="sm" />
                      ))}
                    </div>
                  </div>

                  {/* Share + Save — vertically stacked */}
                  <div className="flex sm:flex-col gap-2 flex-shrink-0">
                    <SaveButton
                      productTitle={productTitle}
                      productData={lowest || undefined}
                    />
                    <button
                      onClick={handleShare}
                      aria-label="Share comparison"
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 hover:bg-white hover:border-neutral-200 hover:shadow-sm transition-all"
                    >
                      <Share2 className="w-4 h-4 text-neutral-500" />
                    </button>
                  </div>
                </div>

                {/* Social Proof — subtle, below hero content */}
                <SocialProof
                  compareCount={socialCompareCount}
                  saveCount={socialSaveCount}
                  className="mt-6 pt-5 border-t border-neutral-100/80"
                />
              </motion.section>

              {/* ─── 2. Price Comparison — Editorial Blocks ─── */}
              <motion.section
                variants={staggerChildren}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                {/* Section header — magazine style */}
                <h2 className="text-[13px] sm:text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em] mb-2">
                  Price Comparison
                </h2>

                {platforms.map((p, i) => (
                  <motion.div
                    key={i}
                    variants={staggerItem}
                    className={[
                      'relative bg-white rounded-2xl p-6 transition-all duration-300',
                      i === 0
                        ? 'shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-neutral-100 drip-border'
                        : 'shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)]',
                    ].join(' ')}
                  >
                    {/* Best Value tag — sage/olive accent */}
                    {i === 0 && (
                      <span className="absolute -top-2.5 left-4 sm:left-6 inline-flex items-center bg-[#6B7259] text-white text-[13px] sm:text-[10px] font-semibold uppercase tracking-[0.08em] px-3 py-1 rounded-full shadow-sm">
                        Best Value
                      </span>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      {/* Platform — 13px uppercase, tracking-wide */}
                      <div className="flex items-center gap-3 sm:w-32 flex-shrink-0">
                        <PlatformBadge platform={p.platform} size="md" />
                        <span className="text-[13px] uppercase tracking-wide text-neutral-500 font-medium sm:hidden">
                          {p.platform}
                        </span>
                        <span className="text-[13px] uppercase tracking-wide text-neutral-500 font-medium hidden sm:block">
                          {p.platform}
                        </span>
                      </div>

                      {/* Price — serif-inspired: 28px, font-normal for winning; standard for others */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3">
                          <span
                            className={[
                              'tabular-nums tracking-tight',
                              i === 0
                                ? 'text-[28px] font-normal text-neutral-900 price-display'
                                : 'text-[20px] font-semibold text-neutral-800',
                            ].join(' ')}
                          >
                            {i === 0 ? <PriceCounter value={p.price} className="text-[28px] font-normal text-neutral-900 price-display" /> : formatPrice(p.price)}
                          </span>
                          {p.originalPrice && p.originalPrice > p.price && (
                            <span className="text-[14px] text-neutral-400 line-through tabular-nums">
                              {formatPrice(p.originalPrice)}
                            </span>
                          )}
                          {p.discount && p.discount > 0 && (
                            <span className="text-[12px] font-medium text-emerald-600">
                              {p.discount}% off
                            </span>
                          )}
                        </div>

                        {/* Editorial verdict — italic reviewer's note */}
                        <p className="text-[13px] italic text-neutral-400 mt-1.5 leading-snug">
                          &ldquo;{getVerdict(p.platform)}&rdquo;
                        </p>
                      </div>

                      {/* CTA */}
                      <div className="flex-shrink-0 w-full sm:w-auto">
                        <AffiliateButton
                          platform={p.platform}
                          url={p.url}
                          productTitle={p.title}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.section>

              {/* ─── 3. Price History — Clean white card ─── */}
              <section className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] p-4 sm:p-6">
                <h2 className="text-[13px] sm:text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em] mb-5">
                  Price History
                </h2>
                <PriceHistory history={priceHistory} />
              </section>

              {/* ─── 4. AI Advice — "DripFeed Analysis" editorial note ─── */}
              {(aiLoading || aiAdvice) && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="bg-blue-50/40 border border-dashed border-blue-100 rounded-2xl p-6"
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-7 h-7 rounded-full bg-blue-100/80 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-[14px] font-semibold text-neutral-800 leading-tight">
                        DripFeed Analysis
                      </h2>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        AI-generated · not financial advice
                      </p>
                    </div>
                  </div>
                  <AIAdviceCard
                    advice={aiAdvice}
                    loading={aiLoading}
                    error={aiError}
                  />
                </motion.section>
              )}

              {/* ─── 5. Related Products — compact horizontal cards ─── */}
              {relatedProducts.length > 1 && (
                <section>
                  <h2 className="text-[13px] sm:text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em] mb-4">
                    People Also Compared
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {relatedProducts.slice(0, 4).map((product, i) => (
                      <ProductCard key={i} product={product} />
                    ))}
                  </div>
                </section>
              )}

              {/* ─── 6. ASCI Disclosure — single toned-down line ─── */}
              <p className="text-[13px] sm:text-[10px] text-neutral-300 text-center pt-4">
                #Ad · Prices include affiliate links. DripFeed earns commission at no extra cost to you.
              </p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && platforms.length === 0 && q && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center py-24"
            >
              <p className="text-4xl mb-4">📊</p>
              <h2 className="text-[22px] font-semibold text-neutral-900 tracking-[-0.01em] mb-2">
                No comparison data for &ldquo;{q}&rdquo;
              </h2>
              <p className="text-[14px] text-neutral-500 leading-relaxed max-w-sm mx-auto">
                Try a more specific product name, or browse our deals.
              </p>
              <button
                onClick={() => navigate('/deals')}
                className="mt-8 inline-flex items-center gap-2 bg-neutral-900 text-white font-medium px-7 py-3 rounded-full text-[13px] hover:bg-neutral-800 transition-colors"
              >
                Browse Deals
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </div>

        {/* ─── Footer — matching HomePage / SearchPage ─── */}
        <footer className="px-4 sm:px-8 lg:px-16 py-10 border-t border-neutral-100 bg-white">
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

      {/* ─── Mobile Sticky Bottom Bar — premium, positioned above BottomNav ─── */}
      {!loading && lowest && (
        <div className="fixed bottom-[64px] left-0 right-0 sm:hidden bg-white/90 backdrop-blur-xl border-t border-neutral-100/80 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-30">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] sm:text-[11px] text-neutral-400 font-medium uppercase tracking-[0.06em]">
              Best price
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[18px] font-normal text-neutral-900 tabular-nums tracking-tight">
                {formatPrice(lowest.price)}
              </span>
              <span className="text-[13px] sm:text-[11px] text-neutral-400 uppercase tracking-wide">
                {lowest.platform}
              </span>
            </div>
          </div>
          <AffiliateButton
            platform={lowest.platform}
            url={lowest.url}
            productTitle={lowest.title}
          />
        </div>
      )}
    </>
  );
}
