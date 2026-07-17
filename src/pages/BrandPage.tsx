import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SEOHead } from '../components/common/SEOHead';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { formatINR, discountPercent } from '../utils/format';
import { staggerChildren, staggerItem } from '../design-system/animations';
import api from '../services/api';
import type { ProductData } from '../types/product';

type SortOption = 'price-asc' | 'price-desc' | 'discount-desc' | 'newest';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'discount-desc', label: 'Biggest Discount' },
  { value: 'newest', label: 'Newest First' },
];

export default function BrandPage() {
  const { slug } = useParams<{ slug: string }>();
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('price-asc');

  const brandName = slug
    ? slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Brand';

  useEffect(() => {
    setLoading(true);
    api.post('/search/product', { query: brandName })
      .then(({ data }) => setProducts(data.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [brandName]);

  const avgDiscount = useMemo(() => {
    const withDiscount = products.filter((p) => p.discount && p.discount > 0);
    if (withDiscount.length === 0) return 0;
    return Math.round(withDiscount.reduce((sum, p) => sum + (p.discount || 0), 0) / withDiscount.length);
  }, [products]);

  const sortedProducts = useMemo(() => {
    const sorted = [...products];
    switch (sort) {
      case 'price-asc': return sorted.sort((a, b) => a.price - b.price);
      case 'price-desc': return sorted.sort((a, b) => b.price - a.price);
      case 'discount-desc': return sorted.sort((a, b) => (b.discount || 0) - (a.discount || 0));
      case 'newest': return sorted;
      default: return sorted;
    }
  }, [products, sort]);

  return (
    <>
      <SEOHead title={brandName} description={`Best deals on ${brandName} products across platforms`} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Brand header */}
        <div className="bg-gradient-to-br from-[#F8F5F2] to-white rounded-2xl p-8 mb-8">
          <h1 className="text-3xl font-bold text-[#0F0F1A]">{brandName}</h1>
          <p className="text-sm text-gray-500 mt-2">Compare prices across 3+ platforms</p>
          <div className="flex gap-4 mt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#0F0F1A]">{products.length}</p>
              <p className="text-xs text-gray-400">Products</p>
            </div>
            {avgDiscount > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{avgDiscount}%</p>
                <p className="text-xs text-gray-400">Avg Discount</p>
              </div>
            )}
          </div>
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">{sortedProducts.length} products found</p>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F0F1A]/20"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Products */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="card" />)}
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="font-medium text-[#0F0F1A]">No products found for {brandName}</p>
            <p className="text-sm mt-1">Try searching for this brand on the search page.</p>
          </div>
        ) : (
          <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4" variants={staggerChildren} initial="hidden" animate="visible">
            {sortedProducts.map((product, idx) => {
              const pct = discountPercent(product.originalPrice || product.price, product.price);
              return (
                <motion.div key={idx} variants={staggerItem}>
                  <Card variant="outlined" padding="none" hover className="overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.title} className="w-full h-40 object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-2xl">🛍️</div>
                    )}
                    <div className="p-3">
                      <p className="text-sm font-medium text-[#0F0F1A] line-clamp-2 mb-1">{product.title}</p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-[#0F0F1A]">{formatINR(product.price)}</span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="text-xs text-gray-400 line-through">{formatINR(product.originalPrice)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge size="sm">{product.platform}</Badge>
                        {pct && <Badge variant="discount" size="sm">-{pct}%</Badge>}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </>
  );
}

