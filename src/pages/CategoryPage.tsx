import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SEOHead } from '../components/common/SEOHead';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { formatINR, discountPercent } from '../utils/format';
import { staggerChildren, staggerItem } from '../design-system/animations';
import api from '../services/api';
import type { ProductData } from '../types/product';

const CATEGORY_META: Record<string, { emoji: string; description: string; subCategories: string[] }> = {
  'ethnic-wear': { emoji: '🪔', description: 'Sarees, kurtas, lehengas & more traditional styles', subCategories: ['Sarees', 'Kurtas', 'Lehengas', 'Salwar Suits'] },
  western: { emoji: '👗', description: 'Dresses, tops, jeans & western fashion', subCategories: ['Dresses', 'Tops', 'Jeans', 'Skirts'] },
  footwear: { emoji: '👟', description: 'Shoes, sneakers, heels & sandals', subCategories: ['Sneakers', 'Heels', 'Flats', 'Sandals'] },
  accessories: { emoji: '💍', description: 'Jewellery, bags, watches & more', subCategories: ['Jewellery', 'Bags', 'Watches', 'Sunglasses'] },
  'fusion-wear': { emoji: '✨', description: 'Indo-western blends & contemporary styles', subCategories: ['Indo-Western', 'Contemporary', 'Boho'] },
  activewear: { emoji: '🏃', description: 'Gym wear, sports shoes & athleisure', subCategories: ['Gym Wear', 'Running', 'Yoga', 'Sports Shoes'] },
  luxury: { emoji: '👑', description: 'Premium designer fashion & luxury brands', subCategories: ['Designer', 'Premium', 'Limited Edition'] },
};

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const meta = slug ? CATEGORY_META[slug] || { emoji: '🛍️', description: 'Browse products', subCategories: [] } : { emoji: '🛍️', description: '', subCategories: [] };
  const categoryName = slug ? slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Category';

  const fetchProducts = useCallback(async (_pageNum: number, reset = false) => {
    if (reset) setLoading(true);
    try {
      const query = subFilter ? `${categoryName} ${subFilter}` : categoryName;
      const { data } = await api.post('/search/product', { query });
      const fetched: ProductData[] = data.products || [];
      if (reset) setProducts(fetched);
      else setProducts((prev) => [...prev, ...fetched]);
      setHasMore(false); // Backend doesn't paginate yet
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [categoryName, subFilter]);

  useEffect(() => {
    setPage(1);
    fetchProducts(1, true);
  }, [fetchProducts]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore) {
        const next = page + 1;
        setPage(next);
        fetchProducts(next);
      }
    }, { threshold: 0.1 });
    const el = observerRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasMore, page, fetchProducts]);

  // Sort deals by discount
  const bestDeals = [...products]
    .filter((p) => p.discount && p.discount > 0)
    .sort((a, b) => (b.discount || 0) - (a.discount || 0))
    .slice(0, 8);

  const trendingProducts = products.slice(0, 10);

  return (
    <>
      <SEOHead title={categoryName} description={meta.description} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#F8F5F2] to-white rounded-2xl p-8 mb-8">
          <span className="text-4xl mb-3 block">{meta.emoji}</span>
          <h1 className="text-3xl font-bold text-[#0F0F1A]">{categoryName}</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-md">{meta.description}</p>
        </div>

        {/* Sub-category chips */}
        {meta.subCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
            <button
              onClick={() => setSubFilter(null)}
              className={['px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-colors',
                !subFilter ? 'bg-[#0F0F1A] text-white border-[#0F0F1A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              ].join(' ')}
            >
              All
            </button>
            {meta.subCategories.map((sub) => (
              <button
                key={sub}
                onClick={() => setSubFilter(sub)}
                className={['px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-colors',
                  subFilter === sub ? 'bg-[#0F0F1A] text-white border-[#0F0F1A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                ].join(' ')}
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="card" />)}
          </div>
        ) : (
          <>
            {/* Trending carousel */}
            {trendingProducts.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-[#0F0F1A] mb-4">Trending in {categoryName}</h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {trendingProducts.map((product, idx) => (
                    <div key={idx} className="flex-shrink-0 w-44">
                      <Card variant="outlined" padding="none" hover className="overflow-hidden" onClick={() => navigate(`/compare?q=${encodeURIComponent(product.title)}`)}>
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.title} className="w-full h-36 object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-36 bg-gray-100 flex items-center justify-center text-2xl">🛍️</div>
                        )}
                        <div className="p-2">
                          <p className="text-xs font-medium text-[#0F0F1A] line-clamp-2">{product.title}</p>
                          <p className="text-xs font-bold text-[#0F0F1A] mt-1">{formatINR(product.price)}</p>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Best deals */}
            {bestDeals.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-[#0F0F1A] mb-4">Best Deals</h2>
                <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4" variants={staggerChildren} initial="hidden" animate="visible">
                  {bestDeals.map((product, idx) => {
                    const pct = discountPercent(product.originalPrice || product.price, product.price);
                    return (
                      <motion.div key={idx} variants={staggerItem}>
                        <Card variant="outlined" padding="none" hover className="overflow-hidden" onClick={() => navigate(`/compare?q=${encodeURIComponent(product.title)}`)}>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.title} className="w-full h-36 object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-36 bg-gray-100 flex items-center justify-center text-2xl">🛍️</div>
                          )}
                          <div className="p-3">
                            {product.brand && <p className="text-xs text-gray-400 uppercase">{product.brand}</p>}
                            <p className="text-sm font-medium text-[#0F0F1A] line-clamp-2 mb-1">{product.title}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[#0F0F1A]">{formatINR(product.price)}</span>
                              {pct && <Badge variant="discount" size="sm">-{pct}%</Badge>}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </section>
            )}

            {/* All products */}
            <section>
              <h2 className="text-lg font-semibold text-[#0F0F1A] mb-4">All Products</h2>
              <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4" variants={staggerChildren} initial="hidden" animate="visible">
                {products.map((product, idx) => (
                  <motion.div key={idx} variants={staggerItem}>
                    <Card variant="outlined" padding="none" hover className="overflow-hidden" onClick={() => navigate(`/compare?q=${encodeURIComponent(product.title)}`)}>
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.title} className="w-full h-36 object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-36 bg-gray-100 flex items-center justify-center text-2xl">🛍️</div>
                      )}
                      <div className="p-3">
                        {product.brand && <p className="text-xs text-gray-400 uppercase">{product.brand}</p>}
                        <p className="text-sm font-medium text-[#0F0F1A] line-clamp-2 mb-1">{product.title}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#0F0F1A]">{formatINR(product.price)}</span>
                          <Badge size="sm">{product.platform}</Badge>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </section>

            {/* Infinite scroll sentinel */}
            {hasMore && <div ref={observerRef} className="h-10" />}
          </>
        )}
      </div>
    </>
  );
}

