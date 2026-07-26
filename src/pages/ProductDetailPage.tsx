import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Share2, Check, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import { SEOHead } from '../components/common/SEOHead';
import { SaveButton } from '../components/product/SaveButton';
import PlatformBadge from '../components/ui/PlatformBadge';
import AffiliateButton from '../components/ui/AffiliateButton';
import { RecommendationSection, RecommendationSkeleton } from '../components/product/RecommendationSection';
import { SimilarProductsSection } from '../components/product/SimilarProductsSection';
import { RecentlyViewedSection } from '../components/product/RecentlyViewedSection';
import { useProductDetail } from '../hooks/useProductDetail';
import { useRecommendations } from '../hooks/useRecommendations';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/formatPrice';
import Analytics from '../utils/analytics';
import { PriceAlertModal } from '../components/product/PriceAlertModal';
import { usePriceAlert } from '../hooks/usePriceAlert';
import { staggerChildren, staggerItem } from '../design-system/animations';
import type { OfferData, CanonicalProductData } from '../types/product';

const PriceHistoryPanel = lazy(() =>
  import('../components/product/PriceHistoryPanel').then(m => ({ default: m.PriceHistoryPanel }))
);

const SITE_URL = 'https://dripfeed-v21.vercel.app';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bestImage(product: CanonicalProductData): string {
  return product.offers[0]?.imageUrl ?? '';
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-40 sm:pb-16 animate-pulse space-y-6">
      <div className="h-4 w-24 bg-neutral-100 rounded-full" />
      <div className="bg-white rounded-2xl border border-neutral-100 p-6 flex gap-6">
        <div className="w-32 h-32 sm:w-44 sm:h-44 bg-neutral-100 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-3 w-16 bg-neutral-100 rounded-full" />
          <div className="h-6 w-3/4 bg-neutral-100 rounded-full" />
          <div className="h-5 w-24 bg-neutral-100 rounded-full" />
        </div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-neutral-100 h-20" />
      ))}
    </div>
  );
}

// ─── Not Found ────────────────────────────────────────────────────────────────

function ProductNotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-5xl mb-4">🔍</p>
      <h1 className="text-[22px] font-semibold text-[#0F0F1A] mb-2 tracking-tight">Product not found</h1>
      <p className="text-[14px] text-neutral-500 mb-8 max-w-xs">
        This product may have been removed or the link is outdated.
      </p>
      <button
        onClick={() => navigate('/search')}
        className="inline-flex items-center gap-2 bg-[#0F0F1A] text-white font-medium px-6 py-3 rounded-full text-[13px] hover:bg-[#1A1A2E] transition-colors min-h-[44px]"
      >
        Search products
      </button>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ProductError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-5xl mb-4">⚠️</p>
      <h1 className="text-[22px] font-semibold text-[#0F0F1A] mb-2">Something went wrong</h1>
      <p className="text-[14px] text-neutral-500 mb-8">Could not load this product. Check your connection and try again.</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 bg-[#C9A96E] text-white font-medium px-6 py-3 rounded-full text-[13px] hover:bg-[#B8964F] transition-colors min-h-[44px]"
      >
        Try again
      </button>
    </div>
  );
}

// ─── Offer Row ────────────────────────────────────────────────────────────────

function OfferRow({ offer, index }: { offer: OfferData; index: number }) {
  return (
    <motion.div
      variants={staggerItem}
      className={[
        'relative bg-white rounded-2xl border border-neutral-100 p-4 sm:p-5',
        index === 0 ? 'shadow-[0_2px_10px_rgba(0,0,0,0.06)]' : '',
      ].join(' ')}
    >
      {index === 0 && (
        <span className="absolute -top-2.5 left-4 inline-flex items-center bg-[#C9A96E] text-white text-[10px] font-semibold uppercase tracking-[0.08em] px-2.5 py-0.5 rounded-full shadow-sm">
          Best Deal
        </span>
      )}
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-neutral-50 flex-shrink-0 ring-1 ring-neutral-100">
          <img
            src={offer.imageUrl}
            alt={offer.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop'; }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <PlatformBadge platform={offer.platform} size="sm" />
          </div>
          <p className="text-[11px] text-neutral-500 line-clamp-1">{offer.title}</p>
          {(offer.color || offer.size) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {offer.color && (
                <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">
                  🎨 <span className="capitalize">{offer.color}</span>
                </span>
              )}
              {offer.size && (
                <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-full">
                  📏 {offer.size}
                </span>
              )}
            </div>
          )}
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={index === 0 ? 'text-[20px] font-bold text-[#0F0F1A] tabular-nums' : 'text-[16px] font-semibold text-[#1A1A2E] tabular-nums'}>
              {formatPrice(offer.price)}
            </span>
            {offer.originalPrice && offer.originalPrice > offer.price && (
              <span className="text-[11px] text-neutral-400 line-through tabular-nums">{formatPrice(offer.originalPrice)}</span>
            )}
            {offer.discount && offer.discount > 0 && (
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{offer.discount}% off</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          <AffiliateButton platform={offer.platform} url={offer.affiliateUrl || offer.productUrl} productTitle={offer.title} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Variant Selectors ────────────────────────────────────────────────────────

interface VariantSelectorProps {
  offers: OfferData[];
  activeOfferId: string;
  onSelect: (id: string) => void;
}

function VariantSelector({ offers, activeOfferId, onSelect }: VariantSelectorProps) {
  const colors = useMemo(() => {
    const seen = new Set<string>();
    return offers.filter(o => o.color && !seen.has(o.color) && seen.add(o.color));
  }, [offers]);

  const sizes = useMemo(() => {
    const seen = new Set<string>();
    return offers.filter(o => o.size && !seen.has(o.size) && seen.add(o.size));
  }, [offers]);

  if (!colors.length && !sizes.length) return null;

  return (
    <div className="space-y-3">
      {colors.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mb-2">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map(o => (
              <button
                key={o.platformProductId}
                onClick={() => onSelect(o.platformProductId)}
                aria-pressed={activeOfferId === o.platformProductId}
                className={[
                  'px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all capitalize min-h-[36px]',
                  activeOfferId === o.platformProductId
                    ? 'bg-[#0F0F1A] text-white border-[#0F0F1A]'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-[#C9A96E]',
                ].join(' ')}
              >
                {o.color}
              </button>
            ))}
          </div>
        </div>
      )}
      {sizes.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mb-2">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map(o => (
              <button
                key={o.platformProductId}
                onClick={() => onSelect(o.platformProductId)}
                aria-pressed={activeOfferId === o.platformProductId}
                className={[
                  'px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all min-h-[36px]',
                  activeOfferId === o.platformProductId
                    ? 'bg-[#0F0F1A] text-white border-[#0F0F1A]'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:border-[#C9A96E]',
                ].join(' ')}
              >
                {o.size}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { canonicalId } = useParams<{ canonicalId: string }>();
  const navigate = useNavigate();
  const { product, query, status, fetch } = useProductDetail();
  const recs = useRecommendations();
  const { user } = useAuth();
  const { items: recentItems, trackView } = useRecentlyViewed(!!user);

  const [activeOfferId, setActiveOfferId] = useState('');
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const priceAlert = usePriceAlert(canonicalId);

  useEffect(() => {
    if (canonicalId) fetch(canonicalId);
  }, [canonicalId, fetch]);

  // Fetch recommendations only after product loads
  useEffect(() => {
    if (status === 'success' && canonicalId) recs.fetch(canonicalId);
  }, [status, canonicalId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track product detail view + recently viewed
  useEffect(() => {
    if (status === 'success' && product && canonicalId) {
      Analytics.productDetailViewed(canonicalId, product.title);
      const offer = product.offers[0];
      if (offer) {
        trackView({
          id:            canonicalId,
          title:         product.title,
          brand:         product.brand,
          imageUrl:      offer.imageUrl,
          price:         offer.price,
          originalPrice: offer.originalPrice,
          discount:      offer.discount,
          platform:      offer.platform,
          url:           offer.affiliateUrl || offer.productUrl,
        });
      }
    }
  }, [status, canonicalId, product, trackView]);

  // Track 404
  useEffect(() => {
    if (status === 'not-found' && canonicalId) Analytics.product404(canonicalId);
  }, [status, canonicalId]);

  useEffect(() => {
    if (product?.offers[0]) setActiveOfferId(product.offers[0].platformProductId);
  }, [product]);

  const activeOffer = useMemo(
    () => product?.offers.find(o => o.platformProductId === activeOfferId) ?? product?.offers[0] ?? null,
    [product, activeOfferId]
  );

  const sortedOffers = useMemo(
    () => product ? [...product.offers].sort((a, b) => a.price - b.price) : [],
    [product]
  );

  const lowest = sortedOffers[0] ?? null;
  const savings = useMemo(() => {
    if (!sortedOffers.length) return 0;
    const max = Math.max(...sortedOffers.map(o => o.price));
    return max - (lowest?.price ?? 0);
  }, [sortedOffers, lowest]);

  async function handleShare() {
    Analytics.shareClicked(canonicalId ?? '', product?.title ?? '');
    const url = `${SITE_URL}/product/${canonicalId}`;
    const title = product?.title ?? 'Check this product on TagCheck';
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // ── SEO data ──────────────────────────────────────────────────────────────

  const canonicalUrl = `${SITE_URL}/product/${canonicalId}`;
  const seoTitle = product
    ? `${product.title}${product.brand ? ` by ${product.brand}` : ''} — Best Price`
    : 'Product — TagCheck India';
  const seoDesc = product && lowest
    ? `Buy ${product.title} from ₹${lowest.price.toLocaleString('en-IN')} across ${product.offerCount} platforms. Compare prices on TagCheck India.`
    : 'Compare prices across platforms on TagCheck India.';

  const productJsonLd = product && lowest
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        image: bestImage(product),
        brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
        offers: sortedOffers.map(o => ({
          '@type': 'Offer',
          price: String(o.price),
          priceCurrency: 'INR',
          url: o.affiliateUrl || o.productUrl,
          seller: { '@type': 'Organization', name: o.platform },
          availability: 'https://schema.org/InStock',
        })),
      }
    : undefined;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Search', item: `${SITE_URL}/search` },
      ...(product ? [{ '@type': 'ListItem', position: 3, name: product.title, item: canonicalUrl }] : []),
    ],
  };

  // ── Render states ─────────────────────────────────────────────────────────

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <SEOHead title="Loading product… | TagCheck India" noindex />
        <PageSkeleton />
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <SEOHead title="Product not found | TagCheck India" noindex />
        <ProductNotFound />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <SEOHead title="Error | TagCheck India" noindex />
        <ProductError onRetry={() => canonicalId && fetch(canonicalId)} />
      </div>
    );
  }

  if (!product) return null;

  const displayImage = activeOffer?.imageUrl || bestImage(product);

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDesc}
        image={displayImage}
        canonical={canonicalUrl}
        jsonLd={[productJsonLd, breadcrumbJsonLd].filter(Boolean) as any}
      />

      <div className="min-h-screen bg-[#FAFAFA]">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-4 sm:pt-10 pb-40 sm:pb-16">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-4 sm:mb-8">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 hover:text-[#C9A96E] transition-colors min-h-[44px] uppercase tracking-[0.08em] font-medium group"
              aria-label="Go back"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
              Back
            </button>
            <span>/</span>
            <Link to="/search" className="hover:text-[#C9A96E] transition-colors">Search</Link>
            {query && (
              <>
                <span>/</span>
                <Link to={`/search?q=${encodeURIComponent(query)}`} className="hover:text-[#C9A96E] transition-colors capitalize truncate max-w-[120px]">
                  {query}
                </Link>
              </>
            )}
          </nav>

          {/* ── Hero Block ── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="bg-white rounded-2xl border border-neutral-100 p-4 sm:p-8 mb-6"
            aria-label="Product details"
          >
            <div className="flex gap-4 sm:gap-7">
              {/* Image */}
              <div className="w-28 h-28 sm:w-44 sm:h-44 rounded-xl overflow-hidden bg-neutral-50 flex-shrink-0 ring-1 ring-neutral-100">
                <img
                  src={displayImage}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=533&fit=crop'; }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {product.brand && (
                  <p className="text-[11px] text-neutral-400 font-semibold uppercase tracking-[0.12em] mb-1">
                    {product.brand}
                  </p>
                )}
                <h1 className="text-[16px] sm:text-[22px] font-semibold text-[#0F0F1A] leading-[1.2] mb-2 tracking-[-0.01em]">
                  {product.title}
                </h1>

                {lowest && (
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[22px] sm:text-[28px] font-bold text-[#0F0F1A] tabular-nums">
                      {formatPrice(lowest.price)}
                    </span>
                    {lowest.originalPrice && lowest.originalPrice > lowest.price && (
                      <span className="text-[13px] text-neutral-400 line-through tabular-nums">
                        {formatPrice(lowest.originalPrice)}
                      </span>
                    )}
                    {savings > 0 && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-100">
                        Save {formatPrice(savings)}
                      </span>
                    )}
                  </div>
                )}

                <p className="text-[12px] text-neutral-400">
                  {product.offerCount} platform{product.offerCount !== 1 ? 's' : ''} · Best on{' '}
                  <span className="font-medium text-neutral-600">{lowest?.platform}</span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                <SaveButton
                  productTitle={product.title}
                  productData={lowest ? {
                    id: canonicalId,
                    title: product.title,
                    brand: product.brand,
                    imageUrl: displayImage,
                    price: lowest.price,
                    platform: lowest.platform,
                    url: lowest.affiliateUrl || lowest.productUrl,
                  } : undefined}
                />
                <button
                  onClick={handleShare}
                  aria-label={copied ? 'Link copied' : 'Share product'}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 hover:border-[#C9A96E]/50 transition-colors min-h-[44px] min-w-[44px]"
                >
                  {copied
                    ? <Check className="w-4 h-4 text-emerald-500" />
                    : <Share2 className="w-4 h-4 text-neutral-500" />}
                </button>
                <button
                  onClick={() => setAlertOpen(true)}
                  aria-label={priceAlert.hookStatus === 'watching' ? 'Price alert active' : 'Set price alert'}
                  className={[
                    'inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors min-h-[44px] min-w-[44px]',
                    priceAlert.hookStatus === 'watching' || priceAlert.hookStatus === 'triggered'
                      ? 'bg-amber-50 border-amber-200 text-amber-500'
                      : 'bg-neutral-50 border-neutral-100 hover:border-[#C9A96E]/50 text-neutral-500',
                  ].join(' ')}
                >
                  <Bell className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Variant selectors */}
            {(product.offers.some(o => o.color) || product.offers.some(o => o.size)) && (
              <div className="mt-5 pt-5 border-t border-neutral-100">
                <VariantSelector
                  offers={product.offers}
                  activeOfferId={activeOfferId}
                  onSelect={setActiveOfferId}
                />
              </div>
            )}
          </motion.section>

          {/* ── Offers ── */}
          <section aria-label="Price comparison" className="mb-6">
            <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em] mb-3">
              Price Comparison
            </h2>
            <motion.div
              variants={staggerChildren}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {sortedOffers.map((offer, i) => (
                <OfferRow key={offer.platformProductId} offer={offer} index={i} />
              ))}
            </motion.div>
          </section>

          {/* ── Price History (lazy) ── */}
          <section
            className="bg-white rounded-2xl border border-neutral-100 hover:border-[#C9A96E]/30 transition-all mb-6"
            aria-label="Price history"
          >
            <button
              onClick={() => {
              if (!historyOpen && canonicalId) Analytics.priceHistoryExpanded(canonicalId);
              setHistoryOpen(v => !v);
            }}
              className="w-full flex items-center justify-between p-4 sm:p-6 min-h-[56px]"
              aria-expanded={historyOpen}
            >
              <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.1em]">
                Price History
              </h2>
              {historyOpen
                ? <ChevronUp className="w-4 h-4 text-neutral-400" />
                : <ChevronDown className="w-4 h-4 text-neutral-400" />}
            </button>
            {historyOpen && canonicalId && (
              <div className="px-4 sm:px-6 pb-6">
                <Suspense fallback={
                  <div className="h-[200px] animate-pulse bg-neutral-50 rounded-xl" aria-busy="true" aria-label="Loading price history" />
                }>
                  <PriceHistoryPanel
                    canonicalId={canonicalId}
                    currentPrice={lowest?.price ?? 0}
                  />
                </Suspense>
              </div>
            )}
          </section>

          {/* ── Similar Products (lazy, scored, up to 8) ── */}
          {canonicalId && <SimilarProductsSection canonicalId={canonicalId} />}

          {/* ── Recommendations ── */}
          {recs.status === 'loading' && (
            <>
              <RecommendationSkeleton title="Similar Products" />
              <RecommendationSkeleton title="Better Deals" />
            </>
          )}
          {recs.status === 'success' && recs.data && (
            <>
              <RecommendationSection title="Similar Products" items={recs.data.similar} aria-label="Similar products" />
              <RecommendationSection title="Better Deals" items={recs.data.betterDeal} aria-label="Better deals" />
              <RecommendationSection title="Popular Alternatives" items={recs.data.popular} aria-label="Popular alternatives" />
              <RecommendationSection title="Recently Price Dropped" items={recs.data.priceDropped} aria-label="Recently price dropped" />
              <RecommendationSection title="Premium Upgrade" items={recs.data.premium} aria-label="Premium upgrade options" />
              <RecommendationSection title="Budget Alternative" items={recs.data.budget} aria-label="Budget alternatives" />
            </>
          )}

          {/* ── Recently Viewed (compact, excludes current product) ── */}
          <RecentlyViewedSection
            items={recentItems.filter(p => p.id !== canonicalId)}
            compact
          />

          {/* ASCI disclosure */}
          <p className="text-[11px] text-neutral-400 text-center pt-2">
            #Ad · Prices include affiliate links. TagCheck earns commission at no extra cost to you.
          </p>
        </div>

        {/* Price Alert Modal */}
        {canonicalId && lowest && (
          <PriceAlertModal
            open={alertOpen}
            onClose={() => setAlertOpen(false)}
            canonicalId={canonicalId}
            currentPrice={lowest.price}
            productTitle={product.title}
            platform={lowest.platform}
            imageUrl={displayImage}
          />
        )}

        {/* Mobile sticky CTA */}
        {lowest && (
          <div className="fixed bottom-[64px] left-0 right-0 sm:hidden bg-white/90 backdrop-blur-xl border-t border-neutral-100/80 px-4 py-3 flex items-center gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-30">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-[0.06em]">Best price</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-[18px] font-bold text-[#0F0F1A] tabular-nums">{formatPrice(lowest.price)}</span>
                <span className="text-[11px] text-neutral-400 uppercase tracking-wide">{lowest.platform}</span>
              </div>
            </div>
            <AffiliateButton
              platform={lowest.platform}
              url={lowest.affiliateUrl || lowest.productUrl}
              productTitle={product.title}
            />
          </div>
        )}
      </div>
    </>
  );
}
