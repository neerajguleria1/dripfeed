import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2, TrendingDown, TrendingUp, GitCompare, FolderHeart } from 'lucide-react';
import { motion } from 'framer-motion';
import { SEOHead } from '../components/common/SEOHead';
import AffiliateButton from '../components/ui/AffiliateButton';
import { Sparkline } from '../components/ui/Sparkline';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { formatINR } from '../utils/format';
import { staggerChildren, staggerItem } from '../design-system/animations';
import api from '../services/api';

interface WishlistItem {
  id: string;
  productTitle: string;
  brand?: string;
  imageUrl?: string;
  platform: string;
  sourceUrl: string;
  savedPrice: number;
  lowestPrice?: number;
  lowestPlatform?: string;
}

// Mock sparkline data generator for now
function mockPriceHistory(): number[] {
  const base = 800 + Math.random() * 2000;
  return Array.from({ length: 7 }, () => base + (Math.random() - 0.5) * 300);
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'wishlist' | 'collections'>('wishlist');

  useEffect(() => {
    api.get('/wishlist')
      .then((r) => setItems(r.data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(id: string) {
    try {
      await api.delete(`/wishlist/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <>
      <SEOHead title="My Wishlist" description="Track prices and save your favourite fashion finds" />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('wishlist')}
            className={['flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'wishlist' ? 'bg-white text-[#051F45] shadow-sm' : 'text-gray-500'
            ].join(' ')}
          >
            <Heart className="w-4 h-4" /> Wishlist
          </button>
          <Link
            to="/collections"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-[#051F45] transition-colors"
          >
            <FolderHeart className="w-4 h-4" /> Collections
          </Link>
        </div>

        {/* Wishlist header */}
        <h1
          className="text-2xl font-bold text-[#051F45] mb-6 flex items-center gap-2"
          style={{ fontFamily: 'Instrument Serif, serif' }}
        >
          <Heart className="w-6 h-6 text-[#F2C4CD] fill-[#F2C4CD]" />
          Saved Items ({items.length})
        </h1>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={120} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-4">🛍️</p>
            <p className="font-medium text-[#051F45] text-lg">Nothing saved yet</p>
            <p className="text-sm mt-1 mb-6">Save products to track prices and get alerts.</p>
            <Link
              to="/"
              className="bg-[#051F45] text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-[#051F45]/90 inline-block"
            >
              Browse Trending
            </Link>
          </div>
        )}

        {/* Items list */}
        {!loading && items.length > 0 && (
          <motion.div
            className="flex flex-col gap-4"
            variants={staggerChildren}
            initial="hidden"
            animate="visible"
          >
            {items.map((item) => {
              const priceDiff = item.lowestPrice && item.savedPrice
                ? item.lowestPrice - item.savedPrice
                : null;
              const dropped = priceDiff !== null && priceDiff < 0;
              const risen = priceDiff !== null && priceDiff > 0;
              const sparkData = mockPriceHistory();

              return (
                <motion.div
                  key={item.id}
                  variants={staggerItem}
                  className="bg-white/55 backdrop-blur-sm rounded-2xl border border-[#051F45]/10 p-4 flex gap-4 items-start"
                >
                  {/* Image */}
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productTitle}
                      className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-20 h-20 bg-[#F8F5F2] rounded-xl flex-shrink-0 flex items-center justify-center text-2xl">🛍️</div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {item.brand && (
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{item.brand}</p>
                    )}
                    <p className="font-semibold text-[#051F45] text-sm line-clamp-2 mb-1">{item.productTitle}</p>

                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {item.lowestPrice && (
                        <span className="font-bold text-[#051F45]">{formatINR(item.lowestPrice)}</span>
                      )}
                      {dropped && (
                        <span className="flex items-center gap-0.5 text-xs text-green-600 font-semibold">
                          <TrendingDown className="w-3 h-3" /> {formatINR(Math.abs(priceDiff!))} cheaper
                        </span>
                      )}
                      {risen && (
                        <span className="flex items-center gap-0.5 text-xs text-orange-500 font-semibold">
                          <TrendingUp className="w-3 h-3" /> {formatINR(priceDiff!)} more
                        </span>
                      )}
                    </div>

                    {/* Sparkline */}
                    <div className="mb-2">
                      <Sparkline
                        data={sparkData}
                        width={100}
                        height={20}
                        color={dropped ? '#22C55E' : risen ? '#F97316' : undefined}
                        showLowestDot
                      />
                    </div>

                    {item.lowestPlatform && (
                      <div className="mb-2">
                        <Badge size="sm">Best on {item.lowestPlatform}</Badge>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {item.sourceUrl && item.lowestPlatform && (
                        <AffiliateButton
                          platform={item.lowestPlatform}
                          url={item.sourceUrl}
                          productTitle={item.productTitle}
                        />
                      )}
                      <Link
                        to={`/compare?q=${encodeURIComponent(item.productTitle)}`}
                        className="flex items-center gap-1 text-xs text-[#051F45]/70 hover:text-[#051F45] border border-[#051F45]/15 px-3 py-2 rounded-lg"
                      >
                        <GitCompare className="w-3 h-3" /> Compare
                      </Link>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-100 px-3 py-2 rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </>
  );
}
