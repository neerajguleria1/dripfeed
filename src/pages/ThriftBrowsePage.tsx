import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { SEOHead } from '../components/common/SEOHead';
import SiteNav from '../components/SiteNav';
import { staggerChildren, staggerItem } from '../design-system/animations';
import api from '../services/api';

// ─── Types ──────────────────────────────────────────
interface ThriftListing {
  _id: string;
  title: string;
  brand?: string;
  category: string;
  size: string;
  condition: 'like-new' | 'good' | 'fair';
  price: number;
  images: string[];
  city: string;
  whatsappNumber: string;
  year?: number;
}

// ─── Constants ──────────────────────────────────────
const CATEGORIES = ['All', 'Ethnic Wear', 'Western', 'Footwear', 'Accessories', 'Activewear'];
const SIZES = ['All', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
const CONDITIONS = ['All', 'like-new', 'good', 'fair'];

const TAUPE = '#A9967F';

/** Museum-style prose for condition */
function conditionProse(c: string): string {
  if (c === 'like-new') return 'Unworn, original tags attached';
  if (c === 'good') return 'Gently worn, excellent state';
  return 'Well-loved, minor signs of wear';
}

/** Museum wall label — small-caps archival style */
function museumLabel(listing: ThriftListing): string {
  const year = listing.year || 2023;
  const cond = listing.condition === 'like-new' ? 'UNWORN' : listing.condition === 'good' ? 'GOOD' : 'FAIR';
  return `CIRCA ${year} · ${cond} · ${listing.city.toUpperCase()}`;
}

function conditionChipLabel(c: string): string {
  if (c === 'All') return 'All Conditions';
  if (c === 'like-new') return 'Like New';
  return c.charAt(0).toUpperCase() + c.slice(1);
}

// ─── Page Component ─────────────────────────────────
export default function ThriftBrowsePage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<ThriftListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // Filters
  const [category, setCategory] = useState('All');
  const [size, setSize] = useState('All');
  const [condition, setCondition] = useState('All');
  const [city, setCity] = useState('');

  const fetchListings = useCallback(async (pageNum: number, reset = false) => {
    if (reset) setLoading(true);
    try {
      const params: Record<string, string> = { page: String(pageNum), limit: '9' };
      if (category !== 'All') params.category = category;
      if (size !== 'All') params.size = size;
      if (condition !== 'All') params.condition = condition;
      if (city.trim()) params.city = city.trim();

      const { data } = await api.get('/thrift', { params });
      if (reset) {
        setListings(data.listings);
      } else {
        setListings((prev) => [...prev, ...data.listings]);
      }
      setHasMore(data.hasMore);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [category, size, condition, city]);

  useEffect(() => {
    setPage(1);
    fetchListings(1, true);
  }, [fetchListings]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchListings(next);
  }

  const hasActiveFilters = category !== 'All' || size !== 'All' || condition !== 'All' || city.trim() !== '';

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <SEOHead
        title="Pre-loved Fashion Archive — DripFeed"
        description="A curated archive of pre-loved fashion from verified sellers across India. Sustainable luxury at considered prices."
      />

      <SiteNav />

      {/* ─── Header ─────────────────────────────────── */}
      <section className="pt-24 pb-10 sm:pt-36 sm:pb-16 px-4 sm:px-10 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-[24px] sm:text-[28px] font-semibold text-neutral-900 tracking-[-0.02em]">
            Pre-loved Fashion
          </h1>
          <p className="text-[14px] text-neutral-500 mt-2 max-w-sm leading-relaxed">
            Curated pieces, sustainable prices. Direct from sellers across India.
          </p>
        </div>
      </section>

      {/* ─── Actions & Filters ──────────────────────── */}
      <section className="px-4 sm:px-10 lg:px-20 pb-8 sm:pb-10">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5">
          {/* Action Row */}
          <div className="flex items-center gap-3">
            <Link to="/thrift/list">
              <button className="inline-flex items-center gap-2 bg-neutral-900 text-white font-medium px-5 sm:px-6 py-2.5 rounded-full text-[13px] hover:bg-neutral-800 transition-colors min-h-[44px]">
                <Plus className="w-3.5 h-3.5" />
                Sell Something
              </button>
            </Link>
            <button
              onClick={() => {
                if (hasActiveFilters) {
                  setCategory('All');
                  setSize('All');
                  setCondition('All');
                  setCity('');
                }
              }}
              className={[
                'inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-[13px] font-medium border transition-colors min-h-[44px]',
                hasActiveFilters
                  ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800'
                  : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300',
              ].join(' ')}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {hasActiveFilters ? 'Clear Filters' : 'Filters'}
            </button>
          </div>

          {/* Filter Chips — horizontally scrollable on mobile */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
            {/* Category */}
            <div className="flex gap-2 flex-shrink-0">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={[
                    'px-4 py-2.5 sm:py-2 rounded-full text-[13px] font-medium border whitespace-nowrap transition-all duration-200 min-h-[44px] sm:min-h-0',
                    category === c
                      ? 'text-white border-neutral-900'
                      : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300',
                  ].join(' ')}
                  style={category === c ? { backgroundColor: TAUPE, borderColor: TAUPE } : undefined}
                >
                  {c === 'All' ? 'All Categories' : c}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-neutral-200 flex-shrink-0" />

            {/* Size */}
            <div className="flex gap-2 flex-shrink-0">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={[
                    'px-3 py-2.5 sm:py-2 rounded-full text-[13px] font-medium border whitespace-nowrap transition-all duration-200 min-h-[44px] sm:min-h-0',
                    size === s
                      ? 'text-white border-neutral-900'
                      : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300',
                  ].join(' ')}
                  style={size === s ? { backgroundColor: TAUPE, borderColor: TAUPE } : undefined}
                >
                  {s === 'All' ? 'All Sizes' : s}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-neutral-200 flex-shrink-0" />

            {/* Condition */}
            <div className="flex gap-2 flex-shrink-0">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={[
                    'px-4 py-2.5 sm:py-2 rounded-full text-[13px] font-medium border whitespace-nowrap transition-all duration-200 min-h-[44px] sm:min-h-0',
                    condition === c
                      ? 'text-white border-neutral-900'
                      : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300',
                  ].join(' ')}
                  style={condition === c ? { backgroundColor: TAUPE, borderColor: TAUPE } : undefined}
                >
                  {conditionChipLabel(c)}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-neutral-200 flex-shrink-0" />

            {/* City */}
            <input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="px-4 py-2.5 sm:py-2 rounded-full text-[13px] border border-neutral-200 bg-white text-neutral-700 placeholder:text-neutral-400 w-28 sm:w-32 flex-shrink-0 focus:outline-none focus:border-[#A9967F] transition-colors min-h-[44px] sm:min-h-0"
            />
          </div>
        </div>
      </section>

      {/* ─── Archive Grid ───────────────────────────── */}
      <section className="px-4 sm:px-10 lg:px-20 pb-24 sm:pb-24">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/5] rounded-xl bg-neutral-100" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-16 bg-neutral-100 rounded" />
                    <div className="h-4 w-3/4 bg-neutral-100 rounded" />
                    <div className="h-3 w-1/2 bg-neutral-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-28">
              <p className="text-[15px] font-normal text-neutral-600 mb-2">
                No pieces match your selection.
              </p>
              <p className="text-[13px] text-neutral-400">
                Try broadening your filters or revisit tomorrow.
              </p>
            </div>
          ) : (
            <>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
                variants={staggerChildren}
                initial="hidden"
                animate="visible"
              >
                {listings.map((listing) => (
                  <motion.div key={listing._id} variants={staggerItem}>
                    <ArchiveCard listing={listing} />
                  </motion.div>
                ))}
              </motion.div>

              {hasMore && (
                <div className="text-center mt-16">
                  <button
                    onClick={loadMore}
                    className="px-8 py-2.5 rounded-full text-[13px] font-medium border border-neutral-200 text-neutral-500 bg-white hover:border-neutral-300 transition-colors"
                  >
                    View more pieces
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ─── Trust Strip ────────────────────────────── */}
      <section className="px-4 sm:px-10 lg:px-20 pb-12 sm:pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="border-t border-neutral-100 pt-8 sm:pt-10">
            <p className="text-center text-[13px] sm:text-[12px] text-neutral-400 tracking-wide">
              All sellers verified via WhatsApp &middot; Direct communication &middot; No middleman fees
            </p>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────── */}
      <footer className="px-4 sm:px-10 lg:px-20 py-10 pb-24 sm:pb-12 border-t border-neutral-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[13px] sm:text-[12px] text-neutral-400">&copy; 2026 DripFeed India</p>
          <div className="flex gap-5 sm:gap-6 text-[13px] sm:text-[12px] text-neutral-400">
            <button onClick={() => navigate('/privacy')} className="hover:text-neutral-600 transition-colors min-h-[44px] flex items-center">Privacy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-neutral-600 transition-colors min-h-[44px] flex items-center">Terms</button>
            <button onClick={() => navigate('/affiliate-disclosure')} className="hover:text-neutral-600 transition-colors min-h-[44px] flex items-center">Affiliate Disclosure</button>
          </div>
          <p className="text-[13px] sm:text-[10px] text-neutral-300">
            #Ad: DripFeed earns commission on purchases through our links.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Archive Card (Inline) ──────────────────────────
function ArchiveCard({ listing }: { listing: ThriftListing }) {
  const whatsappLink = `https://wa.me/${listing.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I'm interested in "${listing.title}" listed on DripFeed.`)}`;

  return (
    <motion.article
      className="group cursor-pointer"
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Image */}
      <div
        className="relative aspect-[4/5] rounded-xl overflow-hidden bg-neutral-100"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
      >
        {listing.images.length > 0 ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300 text-4xl">
            ✦
          </div>
        )}
      </div>

      {/* Details */}
      <div className="mt-4 space-y-1.5">
        {/* Brand */}
        {listing.brand && (
          <p className="text-[13px] sm:text-[11px] uppercase tracking-[0.08em] text-neutral-400">
            {listing.brand}
          </p>
        )}

        {/* Title */}
        <h3 className="text-[15px] font-normal text-neutral-900 leading-snug line-clamp-2">
          {listing.title}
        </h3>

        {/* Condition as prose */}
        <p className="text-[13px] italic text-neutral-500">
          {conditionProse(listing.condition)}
        </p>

        {/* City */}
        <p className="text-[13px] sm:text-[11px] text-neutral-400">
          {listing.city}
        </p>

        {/* Price */}
        <p className="text-[15px] font-normal text-neutral-900 tabular-nums pt-0.5">
          ₹{listing.price.toLocaleString('en-IN')}
        </p>

        {/* Museum Wall Label */}
        <p
          className="text-[13px] sm:text-[10px] uppercase text-neutral-400 pt-2"
          style={{ letterSpacing: '0.12em' }}
        >
          {museumLabel(listing)}
        </p>

        {/* Contact Seller — 44px tap target */}
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-[13px] sm:text-[12px] mt-2 transition-colors min-h-[44px] sm:min-h-0"
          style={{ color: TAUPE }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#8A7A66')}
          onMouseLeave={(e) => (e.currentTarget.style.color = TAUPE)}
        >
          Contact Seller →
        </a>
      </div>
    </motion.article>
  );
}
