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
import { getSeedByCategory } from '../utils/seedSearch';
import type { ProductData } from '../types/product';

const CATEGORY_META: Record<string, {
  emoji: string;
  description: string;
  subCategories: string[];
  intro: string;
  buyingTips: string[];
}> = {
  'ethnic-wear': {
    emoji: '🪔',
    description: 'Sarees, kurtas, lehengas & more traditional styles',
    subCategories: ['Sarees', 'Kurtas', 'Lehengas', 'Salwar Suits'],
    intro: 'From everyday cotton kurtas to wedding-season silk sarees, DripFeed compares ethnic wear prices across Myntra, Ajio, Flipkart, Meesho and more so you never pay more than you should. Prices on ethnic wear swing wildly between platforms during festive sales — we track them all in real time.',
    buyingTips: [
      'Myntra and Ajio usually run the deepest ethnic wear discounts during Diwali and wedding season (Oct–Feb).',
      'Meesho tends to have the lowest base prices on everyday kurta sets, but check return policies before buying.',
      'For silk sarees, compare fabric composition across listings — "silk blend" is priced lower than pure silk.',
    ],
  },
  western: {
    emoji: '👗',
    description: 'Dresses, tops, jeans & western fashion',
    subCategories: ['Dresses', 'Tops', 'Jeans', 'Skirts'],
    intro: 'Western wear pricing varies most across Amazon, Flipkart and Myntra depending on brand exclusivity deals. DripFeed pulls live prices so you can spot the platform with the best deal on jeans, dresses and tops before you buy.',
    buyingTips: [
      'Amazon Fashion often has better prices on international brands like Levis and H&M.',
      'Flipkart\'s Big Billion Days and Myntra\'s End of Reason Sale are the two biggest western wear discount events each year.',
      'Check size charts carefully — sizing varies significantly between Indian and international brands.',
    ],
  },
  footwear: {
    emoji: '👟',
    description: 'Shoes, sneakers, heels & sandals',
    subCategories: ['Sneakers', 'Heels', 'Flats', 'Sandals'],
    intro: 'Sneaker and footwear prices differ by hundreds of rupees between platforms for the exact same SKU. DripFeed compares footwear prices across Myntra, Ajio, Amazon and Flipkart so you can catch the lowest price on sneakers, heels, flats and sandals.',
    buyingTips: [
      'Amazon and Flipkart frequently have exclusive footwear launches with early-bird pricing.',
      'Ajio\'s footwear return window is typically longer, useful if sizing is uncertain.',
      'Check for bank card offers stacked on top of the listed price — they can add another 10-15% off.',
    ],
  },
  accessories: {
    emoji: '💍',
    description: 'Jewellery, bags, watches & more',
    subCategories: ['Jewellery', 'Bags', 'Watches', 'Sunglasses'],
    intro: 'Accessories — bags, watches, jewellery and sunglasses — often carry the widest price gaps between platforms because of how commission structures work. DripFeed surfaces the actual lowest price across Myntra, Ajio, Amazon, Flipkart and Nykaa Fashion.',
    buyingTips: [
      'Nykaa Fashion tends to have better pricing on curated jewellery and small accessories.',
      'Watches and bags from international brands are usually cheapest on Amazon due to direct brand partnerships.',
      'Festive season (Diwali, wedding season) sees the sharpest accessory price cuts — track early.',
    ],
  },
  'fusion-wear': {
    emoji: '✨',
    description: 'Indo-western blends & contemporary styles',
    subCategories: ['Indo-Western', 'Contemporary', 'Boho'],
    intro: 'Fusion and Indo-western wear is a growing category with prices that shift fast as new collections drop. DripFeed tracks fusion wear pricing across all major Indian fashion platforms so you catch the best deal on contemporary and boho styles.',
    buyingTips: [
      'Newer fusion wear brands often launch with introductory pricing on Myntra and Ajio — worth checking early.',
      'Compare fabric details closely — fusion wear pricing varies a lot based on embroidery and fabric type.',
    ],
  },
  activewear: {
    emoji: '🏃',
    description: 'Gym wear, sports shoes & athleisure',
    subCategories: ['Gym Wear', 'Running', 'Yoga', 'Sports Shoes'],
    intro: 'Activewear and athleisure pricing varies significantly between platforms, especially for brands like Nike, Adidas and Puma. DripFeed compares gym wear, running shoes and yoga apparel prices across Myntra, Amazon, Flipkart and Ajio in real time.',
    buyingTips: [
      'Amazon typically has the best pricing on international sportswear brands due to direct distribution deals.',
      'Myntra\'s sports section runs frequent flash sales — worth checking multiple times a week during sale season.',
      'Compare shoe sizing carefully — running shoe sizing varies between brands more than casual footwear.',
    ],
  },
  luxury: {
    emoji: '👑',
    description: 'Premium designer fashion & luxury brands',
    subCategories: ['Designer', 'Premium', 'Limited Edition'],
    intro: 'Luxury and designer fashion pricing rarely drops, but small differences between authorized retailers add up on higher price points. DripFeed compares premium fashion listings across platforms so you can be confident you\'re getting the best available price.',
    buyingTips: [
      'Always verify seller authenticity badges before buying luxury items on marketplace platforms.',
      'Tata CLiQ Luxury and Ajio Luxe often carry authorized-retailer pricing that beats third-party marketplace listings.',
    ],
  },
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

  const FALLBACK_META = { emoji: '🛍️', description: 'Browse products', subCategories: [] as string[], intro: '', buyingTips: [] as string[] };
  const meta = slug ? CATEGORY_META[slug] || FALLBACK_META : FALLBACK_META;
  const categoryName = slug ? slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Category';

  const fetchProducts = useCallback(async (_pageNum: number, reset = false) => {
    if (reset) setLoading(true);
    try {
      const query = subFilter ? `${categoryName} ${subFilter}` : categoryName;
      const { data } = await api.post('/search/product', { query });
      const fetched: ProductData[] = data.products || [];
      const result = fetched.length > 0 ? fetched : getSeedByCategory(slug || '');
      if (reset) setProducts(result);
      else setProducts((prev) => [...prev, ...result]);
      setHasMore(false);
    } catch {
      const fallback = getSeedByCategory(slug || '');
      if (reset) setProducts(fallback);
      else setProducts((prev) => [...prev, ...fallback]);
    } finally { setLoading(false); }
  }, [categoryName, subFilter, slug]);

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
      <SEOHead
        title={`${categoryName} — Compare Prices Across 4+ Platforms`}
        description={meta.intro ? meta.intro.slice(0, 155) : meta.description}
        url={`https://dripfeed-v21.vercel.app/category/${slug}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dripfeed-v21.vercel.app/' },
            { '@type': 'ListItem', position: 2, name: categoryName, item: `https://dripfeed-v21.vercel.app/category/${slug}` },
          ],
        }}
      />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#F8F5F2] to-white rounded-2xl p-8 mb-8">
          <span className="text-4xl mb-3 block">{meta.emoji}</span>
          <h1 className="text-3xl font-bold text-[#0F0F1A]">{categoryName}</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-md">{meta.description}</p>
          {meta.intro && (
            <p className="text-[13px] text-gray-500 mt-4 max-w-2xl leading-relaxed">{meta.intro}</p>
          )}
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

            {/* Buying tips — unique content per category */}
            {meta.buyingTips.length > 0 && (
              <section className="mt-12 pt-8 border-t border-neutral-100">
                <h2 className="text-lg font-semibold text-[#0F0F1A] mb-4">
                  How to get the best {categoryName.toLowerCase()} price
                </h2>
                <ul className="space-y-3">
                  {meta.buyingTips.map((tip, i) => (
                    <li key={i} className="flex gap-3 text-[13px] text-gray-500 leading-relaxed">
                      <span className="text-[#C9A96E] font-bold shrink-0">{i + 1}.</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

