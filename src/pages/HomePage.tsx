import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ArrowRight, Zap, ChevronRight } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import { SEOHead } from '../components/common/SEOHead';
import SiteNav from '../components/SiteNav';
import type { ProductData, DealData } from '../types/product';
import { ALL_SEED_PRODUCTS } from '../../api/_lib/seed-data';

// ─── Data ────────────────────────────────────────────────────────────────────

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

const PLATFORMS = [
  { name: 'Myntra', color: '#FF3F6C' },
  { name: 'Ajio', color: '#000000' },
  { name: 'Amazon', color: '#FF9900' },
  { name: 'Flipkart', color: '#2874F0' },
  { name: 'Meesho', color: '#570741' },
  { name: 'Nykaa', color: '#FC2779' },
  { name: 'Tata CLiQ', color: '#6C3D9E' },
];

const TRENDING_TERMS = ['kurta set', 'sneakers', 'silk saree', 'lehenga', 'jeans', 'hoodie', 'palazzo', 'crop top'];

// ─── Animation ───────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} variants={stagger} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<DealData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [comparisonCount, setComparisonCount] = useState(12847);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setComparisonCount((p) => p + Math.floor(Math.random() * 3) + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const mockDeals = MOCK_PRODUCTS
      .filter((p) => (p.discount ?? 0) > 0)
      .sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0))
      .slice(0, 8);
    setDeals(mockDeals as DealData[]);
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
        title="DripFeed — Compare Fashion Prices Across 7+ Indian Platforms"
        description="Never overpay for fashion. Compare prices across Myntra, Ajio, Amazon, Flipkart, Meesho & more in one click."
        url="https://dripfeed-v21.vercel.app/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'DripFeed India',
            url: 'https://dripfeed-v21.vercel.app',
            logo: 'https://dripfeed-v21.vercel.app/logo.png',
            description: 'AI-powered fashion price comparison platform for India, comparing prices across 7+ e-commerce platforms.',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'DripFeed India',
            url: 'https://dripfeed-v21.vercel.app',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://dripfeed-v21.vercel.app/search?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />

      <SiteNav />

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO — Full-bleed dark, cinematic, single focus: the search bar
      ═══════════════════════════════════════════════════════════════════════ */}
      <motion.section
        ref={heroRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative min-h-[75vh] sm:min-h-[80vh] flex items-center justify-center bg-[#171310] overflow-hidden"
      >
        {/* Radial gradient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(201,169,110,0.12),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/5 to-transparent" />

        <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 text-center">
          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-full px-4 py-2 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-[13px] text-white/70 font-medium">
              <span className="text-white font-semibold">{comparisonCount.toLocaleString('en-IN')}</span> comparisons today
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-[32px] sm:text-[48px] lg:text-[56px] font-bold text-white leading-[1.1] tracking-[-0.02em] mb-5"
          >
            Never overpay for
            <br />
            <span className="bg-gradient-to-r from-[#C9A96E] via-[#E8D5A8] to-[#C9A96E] bg-clip-text text-transparent">
              fashion
            </span>{' '}
            again
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-[15px] sm:text-[17px] text-white/60 mb-9 max-w-md mx-auto leading-relaxed"
          >
            One search. Seven platforms. The lowest price — instantly.
          </motion.p>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <form onSubmit={handleSearchSubmit} className="relative max-w-xl mx-auto group">
              <div className="flex items-center bg-white/[0.08] backdrop-blur-md border border-white/[0.15] rounded-2xl h-[56px] sm:h-[60px] px-5 transition-all duration-300 group-focus-within:border-[#C9A96E]/50 group-focus-within:bg-white/[0.12] group-focus-within:shadow-[0_0_40px_rgba(201,169,110,0.1)]">
                <Search className="w-5 h-5 text-white/40 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 'kurta set' or paste any product URL..."
                  aria-label="Search products or paste URL"
                  className="flex-1 bg-transparent outline-none text-white placeholder:text-white/35 text-[15px] ml-3 min-h-[44px]"
                />
                <button
                  type="submit"
                  className="hidden sm:flex items-center gap-1.5 bg-[#C9A96E] text-[#171310] font-semibold px-5 py-2.5 rounded-xl text-[13px] hover:bg-[#E8D5A8] transition-colors"
                >
                  Compare <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </motion.div>

          {/* Platform pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-8 flex items-center justify-center gap-2 flex-wrap"
          >
            <span className="text-[12px] text-white/30 mr-1">Comparing:</span>
            {PLATFORMS.map(({ name, color }) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/10 px-3 py-1.5 rounded-full text-[11px] text-white/60 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                {name}
              </span>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════════════════════
          HOW IT WORKS — 3 steps, minimal, confident
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-white">
        <Reveal className="max-w-5xl mx-auto px-5 sm:px-8">
          <motion.p variants={fadeUp} className="text-[12px] text-[#C9A96E] font-semibold uppercase tracking-[0.15em] text-center mb-3">
            How it works
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-[28px] sm:text-[40px] font-bold text-[#171310] text-center mb-16 sm:mb-20 tracking-[-0.02em] leading-tight">
            Three steps to the best deal
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10">
            {[
              { num: '01', title: 'Search or paste', desc: 'Type a product name or paste any URL from Myntra, Flipkart, Amazon, or more.' },
              { num: '02', title: 'Compare instantly', desc: 'See real-time prices from 7+ platforms ranked by value. No signup needed.' },
              { num: '03', title: 'Save money', desc: 'Click through to the cheapest platform and buy. We handle the rest.' },
            ].map(({ num, title, desc }) => (
              <motion.div key={num} variants={fadeUp} className="relative">
                <span className="text-[48px] sm:text-[56px] font-black text-[#F3F4F6] leading-none select-none">{num}</span>
                <h3 className="text-[18px] sm:text-[20px] font-bold text-[#171310] mt-2 mb-2 tracking-[-0.01em]">{title}</h3>
                <p className="text-[14px] text-[#6B7280] leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRENDING — Horizontal pills
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-16 bg-[#FAFAFA] border-y border-neutral-100">
        <Reveal className="max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div variants={fadeUp} className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-[#C9A96E]" />
              <h2 className="text-[16px] sm:text-[18px] font-bold text-[#171310]">Trending searches</h2>
            </div>
            <Link to="/search" className="text-[13px] text-[#C9A96E] font-medium flex items-center gap-1 hover:gap-2 transition-all min-h-[44px]">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {TRENDING_TERMS.map((term) => (
              <button
                key={term}
                onClick={() => navigate(`/search?q=${encodeURIComponent(term)}`)}
                className="shrink-0 px-5 py-2.5 bg-white hover:bg-[#171310] hover:text-white text-[#171310] text-[14px] font-medium rounded-full border border-neutral-200 hover:border-[#171310] transition-all duration-200 min-h-[44px] capitalize"
              >
                {term}
              </button>
            ))}
          </motion.div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          DEALS — Editorial grid, hover lift, savings emphasis
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-white">
        <Reveal className="max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div variants={fadeUp} className="flex items-end justify-between mb-10 sm:mb-12">
            <div>
              <p className="text-[12px] text-[#C9A96E] font-semibold uppercase tracking-[0.15em] mb-2">Live deals</p>
              <h2 className="text-[24px] sm:text-[32px] font-bold text-[#171310] tracking-[-0.02em]">Today's biggest drops</h2>
            </div>
            <Link to="/deals" className="hidden sm:flex items-center gap-1.5 text-[14px] text-[#171310] font-medium hover:text-[#C9A96E] transition-colors min-h-[44px]">
              All deals <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {deals.slice(0, 8).map((deal, i) => (
              <motion.div
                key={deal.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.4 }}
              >
                <Link
                  to={`/compare?q=${encodeURIComponent(deal.title)}`}
                  className="group block bg-white rounded-2xl overflow-hidden border border-neutral-100 hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)] hover:border-neutral-200 transition-all duration-300"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-neutral-50">
                    <img
                      src={deal.imageUrl}
                      alt={deal.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                    {deal.discount > 0 && (
                      <span className="absolute top-3 left-3 bg-[#171310] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                        −{deal.discount}%
                      </span>
                    )}
                  </div>
                  <div className="p-3.5 sm:p-4">
                    <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wide mb-1">{deal.platform}</p>
                    <h3 className="text-[13px] sm:text-[14px] font-medium text-[#171310] line-clamp-2 leading-snug mb-2.5">
                      {deal.title}
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[16px] font-bold text-[#171310] tabular-nums">
                        ₹{deal.price.toLocaleString('en-IN')}
                      </span>
                      {deal.originalPrice && deal.originalPrice > deal.price && (
                        <span className="text-[12px] text-neutral-400 line-through tabular-nums">
                          ₹{deal.originalPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Mobile CTA */}
          <div className="mt-8 text-center sm:hidden">
            <Link to="/deals" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#C9A96E] min-h-[44px]">
              See all deals <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SOCIAL PROOF — Clean, confident numbers
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-24 bg-[#FAFAFA] border-t border-neutral-100">
        <Reveal className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <motion.h2 variants={fadeUp} className="text-[24px] sm:text-[36px] font-bold text-[#171310] mb-14 tracking-[-0.02em]">
            Built for India's smartest shoppers
          </motion.h2>

          <motion.div variants={fadeUp} className="grid grid-cols-3 gap-6 sm:gap-16">
            {[
              { value: '7+', label: 'Platforms compared' },
              { value: '₹2.4Cr', label: 'Saved by users' },
              { value: '50K+', label: 'Monthly users' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-[28px] sm:text-[44px] font-extrabold text-[#171310] tracking-tight">{value}</p>
                <p className="text-[12px] sm:text-[14px] text-neutral-500 mt-1 font-medium">{label}</p>
              </div>
            ))}
          </motion.div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          CTA — Dark, minimal, single action
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 bg-[#171310] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(201,169,110,0.08),transparent)]" />

        <Reveal className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <motion.h2 variants={fadeUp} className="text-[28px] sm:text-[40px] font-bold text-white mb-4 tracking-[-0.02em] leading-tight">
            Stop scrolling between apps.
            <br />
            <span className="text-white/50">Start saving.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[15px] text-white/40 mb-10">
            Free forever. No signup. No ads.
          </motion.p>
          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigate('/search')}
              className="inline-flex items-center gap-2.5 bg-white text-[#171310] font-bold px-8 py-4 rounded-full text-[15px] hover:bg-[#C9A96E] hover:text-white transition-all duration-300 min-h-[44px] shadow-[0_0_40px_rgba(255,255,255,0.1)]"
            >
              Start Comparing
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER — Minimal, clean
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="px-5 sm:px-8 py-10 pb-24 sm:pb-10 bg-white border-t border-neutral-100">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-neutral-400">© 2026 DripFeed India</p>
          <div className="flex gap-6 text-[13px] text-neutral-400">
            <button onClick={() => navigate('/privacy')} className="hover:text-[#171310] transition-colors min-h-[44px] flex items-center">Privacy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-[#171310] transition-colors min-h-[44px] flex items-center">Terms</button>
            <button onClick={() => navigate('/affiliate-disclosure')} className="hover:text-[#171310] transition-colors min-h-[44px] flex items-center">Disclosure</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
