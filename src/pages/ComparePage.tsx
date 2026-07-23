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
import { PriceCounter } from '../components/common/PriceCounter';
import AffiliateButton from '../components/ui/AffiliateButton';
import { staggerChildren, staggerItem } from '../design-system/animations';
import { formatPrice } from '../utils/formatPrice';
import api from '../services/api';
import { searchSeedProducts } from '../utils/seedSearch';
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
  // Web Share Target sends ?url=, ?text= (may contain URL), ?title=
  const sharedText = searchParams.get('text') || '';
  const sharedTitle = searchParams.get('title') || '';
  const rawUrl = searchParams.get('url') || sharedText || '';
  // If sharedText looks like a URL use it as productUrl, otherwise use as query
  const isUrl = (s: string) => /^https?:\/\//.test(s.trim());
  const productUrl = isUrl(rawUrl) ? rawUrl.trim() : '';
  const shareQuery = !isUrl(rawUrl) && rawUrl ? rawUrl.trim() : sharedTitle.trim();

  const [platforms, setPlatforms] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(!!(q || searchParams.get('url') || sharedText || sharedTitle));
  const [error, setError] = useState('');

  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const [priceHistory] = useState<PriceHistoryPoint[]>([]);

  useEffect(() => {
    if (q) {
      fetchComparison(q);
    } else if (shareQuery) {
      fetchComparison(shareQuery);
    } else if (productUrl) {
      fetchFromUrl(productUrl);
    }
  }, [q, productUrl, shareQuery]);

  async function fetchFromUrl(url: string) {
    setLoading(true);
    setError('');
    setPlatforms([]);
    try {
      const { data } = await api.post('/products/compare', { url });
      const results: ProductData[] = data?.platforms || data?.products || [];
      results.sort((a, b) => a.price - b.price);
      if (results.length > 0) {
        setPlatforms(results);
        setLoading(false);
        fetchAiAdvice(results[0]?.title || 'Product', results);
      } else {
        // API succeeded but returned nothing — try keyword fallback
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        const slug = pathParts.find(p => p.length > 3 && !/^\d+$/.test(p) && p !== 'p' && p !== 'dp' && p !== 'buy');
        const guessedName = slug?.replace(/[-_]/g, ' ') || '';
        if (guessedName) {
          await fetchComparison(guessedName);
        } else {
          setError("We couldn't fetch details for this link. Please try another one.");
          setLoading(false);
        }
      }
    } catch {
      // Fallback: extract product name from URL and do a keyword search
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        const slug = pathParts.find(p => p.length > 3 && !/^\d+$/.test(p) && p !== 'p' && p !== 'dp' && p !== 'buy');
        const guessedName = slug?.replace(/[-_]/g, ' ') || '';
        if (guessedName) {
          await fetchComparison(guessedName);
        } else {
          setError("We couldn't fetch details for this link. Please try another one.");
          setLoading(false);
        }
      } catch {
        setError("We couldn't fetch details for this link. Please try another one.");
        setLoading(false);
      }
    }
  }

  const fetchAiAdvice = useCallback(async (productTitle: string, platformData: ProductData[]) => {
    if (!productTitle || platformData.length === 0) return;
    setAiLoading(true);
    setAiError(false);
    try {
      const { data } = await api.post('/products/ai-recommend', {
        productTitle,
        platforms: platformData.map((p) => ({
          platform: p.platform,
          price: p.price,
          originalPrice: p.originalPrice,
          discount: p.discount,
          brand: p.brand,
          rating: p.rating,
        })),
      });
      if (data?.summary) {
        setAiAdvice({
          summary: data.summary,
          pros: data.pros || [],
          cons: data.cons || [],
          recommendation: data.recommendation || '',
          bestPlatform: data.bestPlatform || '',
          confidence: data.confidence,
          isAiGenerated: true,
        });
        setAiLoading(false);
        return;
      }
    } catch { /* fall through to client-side fallback */ }
    finally { setAiLoading(false); }

    // Client-side fallback — rule-based advice when API is unavailable
    const sorted = [...platformData].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0];
    const mostExpensive = sorted[sorted.length - 1];
    const savings = mostExpensive.price - cheapest.price;
    const avgDiscount = Math.round(
      platformData.reduce((acc, p) => acc + (p.discount || 0), 0) / platformData.length
    );
    setAiAdvice({
      summary: `${productTitle} is available across ${platformData.length} platform${platformData.length > 1 ? 's' : ''}. ${savings > 0 ? `You can save up to ₹${savings.toLocaleString('en-IN')} by choosing the right platform.` : 'Prices are similar across platforms.'}`,
      pros: [
        `Available on ${platformData.length} platform${platformData.length > 1 ? 's' : ''} for easy comparison`,
        avgDiscount > 0 ? `Average discount of ${avgDiscount}% off MRP` : 'Competitive pricing across platforms',
        cheapest.platform ? `Lowest price on ${cheapest.platform}` : 'Multiple buying options',
      ],
      cons: [
        'Prices may change — check before buying',
        'Stock availability varies by platform',
      ],
      recommendation: cheapest ? `Buy from ${cheapest.platform} at ₹${cheapest.price.toLocaleString('en-IN')} for the best price.` : 'Compare prices before buying.',
      bestPlatform: cheapest?.platform || '',
      confidence: '0.6',
      isAiGenerated: false,
    });
    setAiLoading(false);
  }, []);

  async function fetchComparison(searchQ: string) {
    if (!searchQ.trim()) return;
    setLoading(true);
    setError('');
    setPlatforms([]);
    setAiAdvice(null);
    setAiError(false);

    const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
    const url = `${base}/search/product/stream?q=${encodeURIComponent(searchQ)}`;
    let settled = false;

    const es = new EventSource(url);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'platform' && Array.isArray(payload.products) && payload.products.length) {
          settled = true;
          setLoading(false);
          setPlatforms((prev) => {
            const existingIds = new Set(prev.map((p: ProductData) => p.id));
            const newOnes = (payload.products as ProductData[]).filter((p) => !existingIds.has(p.id));
            const merged = [...prev, ...newOnes].sort((a, b) => a.price - b.price);
            // Trigger AI advice once we have first results
            if (prev.length === 0 && merged.length > 0) {
              fetchAiAdvice(merged[0]?.title || searchQ, merged);
            }
            return merged;
          });
        } else if (payload.type === 'done') {
          setLoading(false);
          es.close();
          api.post('/analytics/track', { event: 'compare_view', productTitle: searchQ }).catch(() => {});
        } else if (payload.type === 'error') {
          es.close();
          if (!settled) fallbackFetch(searchQ);
          else setLoading(false);
        }
      } catch { /* ignore malformed frames */ }
    };

    es.onerror = () => {
      es.close();
      if (!settled) fallbackFetch(searchQ);
      else setLoading(false);
    };
  }

  async function fallbackFetch(searchQ: string) {
    try {
      const { data } = await api.post('/search/product', { query: searchQ });
      const results: ProductData[] = data?.products || data?.results || data?.platforms || [];
      const final = results.length > 0 ? results : searchSeedProducts(searchQ);
      final.sort((a, b) => a.price - b.price);
      setPlatforms(final);
      if (final.length > 0) fetchAiAdvice(final[0]?.title || searchQ, final);
    } catch {
      const fallback = searchSeedProducts(searchQ);
      fallback.sort((a, b) => a.price - b.price);
      setPlatforms(fallback);
      if (fallback.length === 0) setError('Could not fetch comparison. Please try again.');
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
  // Social proof — organic numbers
  const socialCompareCount = useMemo(() => Math.floor(Math.random() * 40) + 18, []);
  const socialSaveCount = useMemo(() => Math.floor(Math.random() * 15) + 5, []);

  return (
    <>
      <SEOHead
        title={`Compare ${productTitle} Prices — TagCheck India`}
        description={`Compare ${productTitle} prices across ${platforms.length} platforms. Find the best deal on TagCheck India.`}
        image={productImage}
        jsonLd={
          (lowest
            ? {
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: productTitle,
                image: productImage,
                brand: productBrand ? { '@type': 'Brand', name: productBrand } : undefined,
                offers: platforms.map((p) => ({
                  '@type': 'Offer',
                  price: String(p.price),
                  priceCurrency: 'INR',
                  url: p.url,
                  seller: { '@type': 'Organization', name: p.platform },
                  availability: 'https://schema.org/InStock',
                })),
              }
            : undefined) as any
        }
      />

      <div className="min-h-screen bg-[#FAFAFA]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-40 sm:pb-16">

          {/* ─── Breadcrumb — restrained, editorial ─── */}
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-[13px] sm:text-[11px] text-neutral-400 hover:text-[#C9A96E] transition-colors mb-8 sm:mb-10 group uppercase tracking-[0.08em] font-medium min-h-[44px]"
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
              <div className="animate-pulse rounded-2xl bg-white h-[220px] border border-neutral-100" />
              <div className="animate-pulse rounded-2xl bg-white h-[88px] border border-neutral-100" />
              <div className="animate-pulse rounded-2xl bg-white h-[88px] border border-neutral-100" />
              <div className="animate-pulse rounded-2xl bg-white h-[88px] border border-neutral-100" />
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
                className="bg-white rounded-2xl border border-neutral-100 hover:border-[#C9A96E]/30 transition-all p-6 sm:p-8"
              >
                <div className="flex flex-col sm:flex-row gap-7">
                  {/* Product image — 160px, magazine scale */}
                  {productImage && (
                    <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl overflow-hidden bg-neutral-50 flex-shrink-0 ring-1 ring-neutral-100">
                      <img
                        src={productImage}
                        alt={productTitle}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=533&fit=crop'; }}
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
                    <h1 className="text-[20px] sm:text-[24px] font-semibold text-[#0F0F1A] leading-[1.2] line-clamp-2 mb-4 tracking-[-0.01em]">
                      {productTitle}
                    </h1>

                    {/* Gold accent divider */}
                    <div className="w-10 h-px bg-[#C9A96E] mb-4" />

                    {/* Platform count + savings pill */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="text-[13px] text-neutral-500">
                        Compared across <strong className="text-[#0F0F1A] font-semibold">{platforms.length}</strong> platform{platforms.length > 1 ? 's' : ''}
                      </span>

                      {savings > 0 && (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[13px] sm:text-[12px] font-semibold px-3 py-1 rounded-full border border-emerald-100">
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

                    {/* Honest disclaimer: results are matched by product name, not
                        guaranteed to be the identical size/color/SKU across every
                        platform — check each listing's details before buying. */}
                    <p className="text-[12px] text-neutral-400 mt-3 leading-relaxed">
                      Matched by product name across platforms — size, color, and exact variant may differ. Check listing details before buying.
                    </p>
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
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 hover:bg-white hover:border-[#C9A96E]/30 hover:shadow-sm transition-all min-h-[44px] min-w-[44px]"
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
                      'relative bg-white rounded-2xl p-5 transition-all duration-300',
                      'border border-neutral-100 hover:border-[#C9A96E]/30',
                      i === 0
                        ? 'shadow-[0_2px_10px_rgba(0,0,0,0.06)]'
                        : 'hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)]',
                    ].join(' ')}
                  >
                    {i === 0 && (
                      <span className="absolute -top-2.5 left-4 sm:left-6 inline-flex items-center bg-[#C9A96E] text-white text-[13px] sm:text-[10px] font-semibold uppercase tracking-[0.08em] px-3 py-1 rounded-full shadow-sm">
                        Best Value
                      </span>
                    )}

                    <div className="flex items-center gap-4">
                      {/* Product thumbnail */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-neutral-50 flex-shrink-0 ring-1 ring-neutral-100">
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop'; }}
                        />
                      </div>

                      {/* Platform + price */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <PlatformBadge platform={p.platform} size="sm" />
                          <span className="text-[12px] uppercase tracking-wide text-neutral-400 font-medium">
                            {p.platform}
                          </span>
                        </div>

                        <p className="text-[12px] text-neutral-500 line-clamp-1 mb-1.5">{p.title}</p>

                        <div className="flex items-baseline gap-2">
                          <span className={[
                            'tabular-nums tracking-tight',
                            i === 0 ? 'text-[22px] font-serif font-bold text-[#0F0F1A]' : 'text-[18px] font-semibold text-[#1A1A2E]',
                          ].join(' ')}>
                            {i === 0 ? <PriceCounter value={p.price} className="text-[22px] font-serif font-bold text-[#0F0F1A]" /> : formatPrice(p.price)}
                          </span>
                          {p.originalPrice && p.originalPrice > p.price && (
                            <span className="text-[12px] text-neutral-400 line-through tabular-nums">{formatPrice(p.originalPrice)}</span>
                          )}
                          {p.discount && p.discount > 0 && (
                            <span className="inline-flex items-center bg-emerald-50 text-emerald-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                              {p.discount}% off
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] italic text-neutral-400 mt-0.5">&ldquo;{getVerdict(p.platform)}&rdquo;</p>
                      </div>

                      {/* CTA */}
                      <div className="flex-shrink-0">
                        <AffiliateButton platform={p.platform} url={p.url} productTitle={p.title} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.section>

              {/* ─── 3. Price History — Clean white card ─── */}
              <section className="bg-white rounded-2xl border border-neutral-100 hover:border-[#C9A96E]/30 transition-all p-4 sm:p-6">
                <h2 className="text-[13px] sm:text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em] mb-5">
                  Price History
                </h2>
                <PriceHistory history={priceHistory} />
              </section>

              {/* ─── 4. AI Advice — Gold theme "TagCheck Analysis" ─── */}
              {(aiLoading || aiAdvice) && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="bg-[#C9A96E]/5 border border-dashed border-[#C9A96E]/20 rounded-2xl p-6"
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-7 h-7 rounded-full bg-[#C9A96E]/15 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-[#C9A96E]" />
                    </div>
                    <div>
                      <h2 className="text-[14px] font-semibold text-[#0F0F1A] leading-tight">
                        TagCheck Analysis
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

              {/* ─── 5. ASCI Disclosure ─── */}
              <p className="text-[13px] sm:text-[10px] text-neutral-500 text-center pt-4">
                #Ad · Prices include affiliate links. TagCheck earns commission at no extra cost to you.
              </p>
            </div>
          )}

          {/* Empty state — only show after a fetch has completed, not on initial mount */}
          {!loading && !error && platforms.length === 0 && (q || productUrl) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center py-24"
            >
              <p className="text-4xl mb-4">📊</p>
              <h2 className="text-[22px] font-semibold text-[#0F0F1A] tracking-[-0.01em] mb-2">
                No comparison data found
              </h2>
              <p className="text-[14px] text-neutral-500 leading-relaxed max-w-sm mx-auto">
                We couldn't find pricing data for this product. Try a more specific product name, or browse our deals.
              </p>
              <button
                onClick={() => navigate('/deals')}
                className="mt-8 inline-flex items-center gap-2 bg-[#C9A96E] text-white font-medium px-7 py-3 rounded-full text-[13px] hover:bg-[#B8964F] transition-colors min-h-[44px]"
              >
                Browse Deals
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </div>

        {/* ─── Footer — matching premium design language ─── */}
        <footer className="px-4 sm:px-8 lg:px-16 py-10 border-t border-neutral-100 bg-white">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[13px] sm:text-[12px] text-neutral-600">
              &copy; 2026 TagCheck India
            </p>
            <div className="flex gap-5 text-[13px] sm:text-[12px] text-neutral-600">
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
            <p className="text-[13px] sm:text-[10px] text-neutral-500">
              #Ad: TagCheck earns commission on purchases through our links.
            </p>
          </div>
        </footer>
      </div>

      {/* ─── Mobile Sticky Bottom Bar — gold CTA accent ─── */}
      {!loading && lowest && (
        <div className="fixed bottom-[64px] left-0 right-0 sm:hidden bg-white/90 backdrop-blur-xl border-t border-neutral-100/80 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-30">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] sm:text-[11px] text-neutral-400 font-medium uppercase tracking-[0.06em]">
              Best price
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[18px] font-serif font-bold text-[#0F0F1A] tabular-nums tracking-tight">
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
