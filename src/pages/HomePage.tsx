import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Bell, Sparkles, PiggyBank, ArrowRight } from 'lucide-react';
import { SEOHead } from '../components/common/SEOHead';
import { SearchBar } from '../components/search/SearchBar';
import { TrendingSection } from '../components/discovery/TrendingSection';
import { DealsSection } from '../components/discovery/DealsSection';
import { CategoryTiles } from '../components/discovery/CategoryTiles';
import { OccasionCards } from '../components/discovery/OccasionCards';
import SiteNav from '../components/SiteNav';
import api from '../services/api';
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

const VALUE_PROPS = [
  { icon: BarChart3, label: 'Compare 7+ Platforms' },
  { icon: Bell, label: 'Price Drop Alerts' },
  { icon: Sparkles, label: '100% Free' },
  { icon: PiggyBank, label: 'Save Real Money' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductData[]>([]);
  const [deals, setDeals] = useState<DealData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .post('/search/product', { query: 'trending fashion' })
      .then((r) => {
        const fetched: ProductData[] = (r.data.products || []).slice(0, 12);
        setProducts(fetched.length > 0 ? fetched : MOCK_PRODUCTS);

        // Derive deals: filter by highest discount
        const source = fetched.length > 0 ? fetched : MOCK_PRODUCTS;
        const withDiscount = source
          .map((p) => ({
            ...p,
            discount:
              p.discount ||
              (p.originalPrice && p.originalPrice > p.price
                ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
                : 0),
          }))
          .filter((p) => p.discount > 0)
          .sort((a, b) => b.discount - a.discount)
          .slice(0, 6);
        setDeals(withDiscount as DealData[]);
      })
      .catch(() => {
        // Use mock data when API is unavailable
        setProducts(MOCK_PRODUCTS);
        const mockDeals = MOCK_PRODUCTS
          .filter((p) => (p.discount ?? 0) > 0)
          .sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0))
          .slice(0, 6);
        setDeals(mockDeals as DealData[]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <SEOHead
        title="DripFeed India — Compare Fashion Prices Across Myntra, Ajio, Amazon, Meesho & More"
        description="Find the best fashion deals across 7+ Indian platforms. Compare prices, track drops, save money."
      />

      <SiteNav />

      {/* 1. Hero Section — premium spacing, quiet */}
      <section className="relative pt-24 pb-16 sm:pt-36 sm:pb-24 bg-[#FAFAFA]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-[28px] sm:text-[48px] lg:text-[56px] font-bold text-neutral-900 mb-4 sm:mb-5 leading-[1.12] sm:leading-[1.08] tracking-[-0.02em]">
            Find the best price for
            <br />
            <span className="text-[var(--df-accent-gold)] price-display">every fashion buy</span>
          </h1>
          <p className="text-[14px] sm:text-[16px] text-neutral-500 mb-8 sm:mb-10 max-w-md mx-auto leading-relaxed">
            Compare prices across Myntra, Ajio, Amazon, Meesho & more — in one search.
          </p>
          <div className="drip-border rounded-2xl">
            <SearchBar size="hero" />
          </div>
        </div>
      </section>

      {/* 2. Value Props Strip — quiet, no animation */}
      <section className="border-y border-neutral-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-5 sm:gap-8 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {VALUE_PROPS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
              <Icon className="w-4 h-4 text-neutral-400" />
              <span className="text-[13px] font-medium text-neutral-600">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Trending Now */}
      <TrendingSection products={products} loading={loading} />

      {/* 4. Deals of the Day */}
      {(loading || deals.length > 0) && (
        <DealsSection deals={deals} loading={loading} />
      )}

      {/* 5. Shop by Occasion */}
      <OccasionCards />

      {/* 6. Shop by Category */}
      <CategoryTiles />

      {/* 7. Thrift Teaser — quiet, premium */}
      <section className="px-4 sm:px-8 lg:px-16 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto bg-neutral-50 rounded-2xl p-6 sm:p-14 text-center">
          <h2 className="text-[22px] sm:text-[26px] font-bold text-neutral-900 mb-2 tracking-[-0.01em]">
            Pre-loved Fashion
          </h2>
          <p className="text-neutral-500 text-[14px] mb-8">
            Shop sustainable. Save more.
          </p>
          <button
            onClick={() => navigate('/thrift')}
            className="inline-flex items-center gap-2 bg-neutral-900 text-white font-medium px-7 py-3 rounded-full text-[13px] hover:bg-neutral-800 transition-colors"
          >
            Browse Thrift <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Footer — minimal, with bottom padding for BottomNav on mobile */}
      <footer className="px-4 sm:px-8 lg:px-16 py-10 pb-24 sm:pb-10 border-t border-neutral-100">
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
