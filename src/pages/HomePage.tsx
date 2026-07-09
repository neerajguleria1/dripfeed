import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, BarChart3, ShoppingBag, TrendingUp, ArrowRight, Zap } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import { SEOHead } from '../components/common/SEOHead';
import SiteNav from '../components/SiteNav';
import type { ProductData, DealData } from '../types/product';
import { ALL_SEED_PRODUCTS } from '../../api/_lib/seed-data';

// Convert seed data to ProductData format (pick lowest price platform)
const MOCK_PRODUCTS: ProductData[] = ALL_SEED_PRODUCTS.map((sp, i) => {
  const cheapest = sp.platforms.reduce((a, b) => (a.price < b.price ? a : b));
  return {
    id: String(i + 1),
    title: sp.title,
    brand: sp.brand,
    price: cheapest.price,
    originalPrice: cheapest.originalPrice,
    discount: Math.round(((cheapest.originalPrice - cheapest.price) / cheapest.originalPrice) * 100),
    platform: cheapest.platform,
    url: cheapest.url,
    imageUrl: sp.imageUrl,
  };
});

const TRENDING_TERMS = ['kurta set', 'sneakers', 'silk saree', 'lehenga', 'jeans', 'hoodie', 'palazzo'];

const PLATFORMS = ['Myntra', 'Ajio', 'Amazon', 'Flipkart', 'Meesho', 'Nykaa'];

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [_products, setProducts] = useState<ProductData[]>([]);
  const [deals, setDeals] = useState<DealData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [comparisonCount, setComparisonCount] = useState(12847);

  // Animated counter
  useEffect(() => {
    const interval = setInterval(() => {
      setComparisonCount((prev) => prev + Math.floor(Math.random() * 3) + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Use MOCK_PRODUCTS directly for deals (API generates fake repeated titles)
  useEffect(() => {
    setLoading(true);
    setProducts(MOCK_PRODUCTS);
    const mockDeals = MOCK_PRODUCTS
      .filter((p) => (p.discount ?? 0) > 0)
      .sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0))
      .slice(0, 6);
    setDeals(mockDeals as DealData[]);
    setLoading(false);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('http')) {
      navigate(`/compare?url=${encodeURIComponent(trimmed)}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="DripFeed India — Compare Fashion Prices Across Myntra, Ajio, Amazon, Meesho & More"
        description="Find the best fashion deals across 7+ Indian platforms. Compare prices, track drops, save money."
      />

      <SiteNav />

      {/* ─── 1. Hero Section ─── */}
      <section className="relative pt-20 pb-16 sm:pt-32 sm:pb-24 bg-gradient-to-br from-[#0F0F1A] via-[#1A1A2E] to-[#0F0F1A] overflow-hidden">
        {/* Subtle gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#C9A96E]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#C9A96E]/5 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-[32px] sm:text-[48px] lg:text-[56px] font-bold text-white mb-4 sm:mb-5 leading-[1.1] tracking-[-0.02em]"
          >
            Never overpay for fashion again
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
            className="text-[15px] sm:text-[17px] text-[#E5E7EB] mb-8 sm:mb-10 max-w-md mx-auto leading-relaxed"
          >
            Compare prices across 7+ platforms instantly
          </motion.p>

          {/* Single smart search input */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
            className="max-w-xl mx-auto"
          >
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="flex items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl h-[52px] px-4 focus-within:border-[#C9A96E] focus-within:ring-2 focus-within:ring-[#C9A96E]/20 transition-all">
                <Search className="w-5 h-5 text-[#E5E7EB] shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 'kurta set' or paste a Myntra/Amazon URL..."
                  aria-label="Search products or paste URL"
                  className="flex-1 bg-transparent outline-none text-white placeholder:text-gray-400 text-[14px] sm:text-[15px] ml-3 min-h-[44px]"
                />
              </div>
            </form>
          </motion.div>

          {/* Platform clickable buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-8 flex items-center justify-center gap-2 sm:gap-3 flex-wrap"
          >
            {PLATFORMS.map((name) => (
              <button
                key={name}
                onClick={() => navigate(`/search?q=${encodeURIComponent(name + ' fashion')}`)}
                className="bg-white/10 border border-white/20 px-3 py-1 rounded-full text-[11px] text-white/70 hover:bg-white/20 hover:text-white cursor-pointer transition-colors"
              >
                {name}
              </button>
            ))}
          </motion.div>

          {/* Animated counter */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="mt-6 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2"
          >
            <Zap className="w-3.5 h-3.5 text-[#C9A96E]" />
            <span className="text-[13px] text-[#E5E7EB]">
              <span className="font-semibold text-white">{comparisonCount.toLocaleString('en-IN')}</span> comparisons today
            </span>
          </motion.div>
        </div>
      </section>

      {/* ─── 2. How It Works ─── */}
      <section className="bg-[#FAFAFA] py-16 sm:py-20">
        <AnimatedSection className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.h2
            variants={fadeUp}
            className="text-[24px] sm:text-[32px] font-bold text-[#111827] text-center mb-12 sm:mb-14 tracking-[-0.01em]"
          >
            How it works
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            {[
              { step: 1, icon: Search, title: 'Search or Paste URL', desc: 'Enter any product name or paste a link from any platform.' },
              { step: 2, icon: BarChart3, title: 'Compare Prices Instantly', desc: 'See prices across 7+ platforms side by side in seconds.' },
              { step: 3, icon: ShoppingBag, title: 'Buy at the Lowest Price', desc: 'Click through to the cheapest store and save real money.' },
            ].map(({ step, icon: Icon, title, desc }) => (
              <motion.div key={step} variants={fadeUp} className="bg-white rounded-2xl p-6 sm:p-8 border border-neutral-100 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#C9A96E]/10 text-[#C9A96E] text-[14px] font-bold mb-4">
                  {step}
                </div>
                <div className="flex justify-center mb-3">
                  <Icon className="w-6 h-6 text-[#111827]" />
                </div>
                <h3 className="text-[16px] sm:text-[18px] font-semibold text-[#111827] mb-2">{title}</h3>
                <p className="text-[14px] text-gray-500 leading-relaxed max-w-xs mx-auto">{desc}</p>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* ─── 3. Trending Searches ─── */}
      <section className="py-12 sm:py-16 bg-white">
        <AnimatedSection className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-[#C9A96E]" />
            <h2 className="text-[20px] sm:text-[24px] font-bold text-[#111827]">Trending Now</h2>
          </motion.div>

          <motion.div variants={fadeUp} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {TRENDING_TERMS.map((term) => (
              <button
                key={term}
                onClick={() => navigate(`/search?q=${encodeURIComponent(term)}`)}
                className="shrink-0 px-5 py-2.5 bg-[#F3F4F6] hover:bg-[#C9A96E]/10 hover:text-[#C9A96E] text-[#111827] text-[14px] font-medium rounded-full transition-colors min-h-[44px] capitalize"
              >
                {term}
              </button>
            ))}
          </motion.div>
        </AnimatedSection>
      </section>

      {/* ─── 4. Live Deal Feed ─── */}
      <section className="py-12 sm:py-16 bg-[#FAFAFA]">
        <AnimatedSection className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div variants={fadeUp} className="flex items-center justify-between mb-8">
            <h2 className="text-[20px] sm:text-[24px] font-bold text-[#111827]">Today's Best Deals</h2>
            <Link to="/deals" className="text-[14px] text-[#C9A96E] font-medium hover:underline flex items-center gap-1 min-h-[44px]">
              View All Deals <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-white rounded-xl p-3">
                  <div className="w-full aspect-[3/4] bg-gray-200 rounded-lg mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {deals.slice(0, 4).map((deal) => (
                <Link
                  key={deal.id}
                  to={`/search?q=${encodeURIComponent(deal.title)}`}
                  className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg hover:border-[#C9A96E]/30 transition-all duration-200"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
                    <img
                      src={deal.imageUrl}
                      alt={deal.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {deal.discount > 0 && (
                      <span className="absolute top-3 left-3 bg-[#22C55E] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                        -{deal.discount}%
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[13px] text-gray-500 font-medium mb-0.5 capitalize">{deal.platform}</p>
                    <h3 className="text-[13px] sm:text-[14px] font-medium text-[#111827] line-clamp-2 mb-2 leading-snug">
                      {deal.title}
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[15px] font-bold text-[#111827] tabular-nums">₹{deal.price.toLocaleString('en-IN')}</span>
                      {deal.originalPrice && deal.originalPrice > deal.price && (
                        <span className="text-[12px] text-gray-400 line-through tabular-nums">₹{deal.originalPrice.toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatedSection>
      </section>

      {/* ─── 5. Social Proof / Trust Section ─── */}
      <section className="py-16 sm:py-20 bg-white">
        <AnimatedSection className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.p variants={fadeUp} className="text-[14px] text-[#C9A96E] font-medium mb-3 tracking-wide uppercase">
            Trusted by shoppers
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-[24px] sm:text-[32px] font-bold text-[#111827] mb-10 tracking-[-0.01em]">
            Trusted by 50,000+ Indian fashion shoppers
          </motion.h2>

          <motion.div variants={fadeUp} className="grid grid-cols-3 gap-6 sm:gap-12 max-w-lg mx-auto">
            <div>
              <p className="text-[24px] sm:text-[32px] font-bold text-[#111827]">7+</p>
              <p className="text-[13px] sm:text-[14px] text-gray-500 mt-1">Platforms</p>
            </div>
            <div>
              <p className="text-[24px] sm:text-[32px] font-bold text-[#111827]">₹2.4Cr</p>
              <p className="text-[13px] sm:text-[14px] text-gray-500 mt-1">Saved</p>
            </div>
            <div>
              <p className="text-[24px] sm:text-[32px] font-bold text-[#111827]">100%</p>
              <p className="text-[13px] sm:text-[14px] text-gray-500 mt-1">Free</p>
            </div>
          </motion.div>

          {/* As seen in placeholder */}
          <motion.div variants={fadeUp} className="mt-12 pt-8 border-t border-gray-100">
            <p className="text-[12px] text-gray-400 uppercase tracking-wider mb-4">As seen in</p>
            <div className="flex items-center justify-center gap-6 sm:gap-10 opacity-40">
              {['YourStory', 'Inc42', 'Mint', 'ET'].map((name) => (
                <span key={name} className="text-[13px] sm:text-[14px] font-semibold text-gray-600">{name}</span>
              ))}
            </div>
          </motion.div>
        </AnimatedSection>
      </section>

      {/* ─── 6. CTA Section ─── */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-[#0F0F1A] via-[#1A1A2E] to-[#0F0F1A]">
        <AnimatedSection className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2
            variants={fadeUp}
            className="text-[24px] sm:text-[32px] font-bold text-white mb-4 tracking-[-0.01em]"
          >
            Start saving on every fashion purchase
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[14px] text-[#E5E7EB] mb-8">
            It's free. No signup required.
          </motion.p>

          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigate('/search')}
              className="inline-flex items-center gap-2 bg-[#C9A96E] text-white font-semibold px-8 py-3.5 rounded-full text-[14px] hover:bg-[#B8964F] transition-colors min-h-[44px]"
            >
              Start Comparing
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </AnimatedSection>
      </section>

      {/* ─── 7. Footer ─── */}
      <footer className="px-4 sm:px-8 lg:px-16 py-10 pb-24 sm:pb-10 border-t border-neutral-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] sm:text-[12px] text-neutral-400">© 2026 DripFeed India</p>
          <div className="flex gap-5 text-[13px] sm:text-[12px] text-neutral-400">
            <button onClick={() => navigate('/privacy')} className="hover:text-neutral-700 transition-colors min-h-[44px] flex items-center">Privacy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-neutral-700 transition-colors min-h-[44px] flex items-center">Terms</button>
            <button onClick={() => navigate('/affiliate-disclosure')} className="hover:text-neutral-700 transition-colors min-h-[44px] flex items-center">Affiliate Disclosure</button>
          </div>
          <p className="text-[13px] sm:text-[10px] text-neutral-300">
            #Ad: DripFeed earns commission on purchases through our links.
          </p>
        </div>
      </footer>
    </div>
  );
}
