import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import type { FeedSection, HomeFeedProduct, HomeFeedOffer } from '../types/homeFeed';

const MAX_PAGES = 8;
const MAX_PRODUCTS = 120;

/** Different search queries for each "page" of the discovery feed — more variety */
const SECTION_QUERIES = [
  { title: 'Trending Kurtas', query: 'kurta set women trendy' },
  { title: 'Sneakers & Shoes', query: 'sneakers shoes men women' },
  { title: 'Sarees Under ₹2000', query: 'saree silk cotton' },
  { title: 'Jeans & Denim', query: 'jeans denim men women' },
  { title: 'Party Wear', query: 'dress party wear women' },
  { title: 'Ethnic Favorites', query: 'lehenga anarkali ethnic' },
  { title: 'Casual Comfort', query: 'hoodie trackpants casual' },
  { title: 'Office Ready', query: 'formal shirt trousers office' },
];

export interface UseDiscoveryFeedResult {
  sections: FeedSection[];
  loading: boolean;
  hasMore: boolean;
  loadNext: () => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Infinite-scroll hook for the discovery feed.
 * Now calls POST /api/search/product directly (same as main homepage).
 * Each "page" uses a different search query to create themed sections.
 */
export function useDiscoveryFeed(category: string): UseDiscoveryFeedResult {
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const productCount = useRef(0);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset state when category changes
  useEffect(() => {
    setSections([]);
    setPage(0);
    setHasMore(true);
    productCount.current = 0;
  }, [category]);

  const loadNext = useCallback(async () => {
    const nextPage = page + 1;

    if (nextPage > MAX_PAGES || productCount.current >= MAX_PRODUCTS || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      // Pick search query based on page number or category
      const sectionDef = SECTION_QUERIES[nextPage - 1] || SECTION_QUERIES[0];
      const searchQuery = category || sectionDef.query;

      const { data } = await api.post('/search/product',
        { query: searchQuery },
        { signal: controller.signal, timeout: 20000 }
      );

      if (controller.signal.aborted) return;

      const rawResults = data?.results || data?.products || data?.canonicals || [];

      if (rawResults.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      // Map results to HomeFeedProduct format (same logic as useHomeFeed)
      const products: HomeFeedProduct[] = rawResults.slice(0, 20).map((item: any, i: number) => {
        if (item.offers && item.offers.length > 0) {
          const cheapest = item.offers.reduce((min: any, o: any) =>
            (o.price > 0 && o.price < (min.price || Infinity)) ? o : min, item.offers[0]);
          const price = cheapest.price || 0;
          const originalPrice = cheapest.originalPrice || 0;
          const discount = originalPrice > price
            ? Math.round((originalPrice - price) / originalPrice * 100)
            : (cheapest.discount || 0);
          
          const offers: HomeFeedOffer[] = item.offers
            .filter((o: any) => o.price > 0)
            .map((o: any) => ({
              platform: o.platform || 'Unknown',
              price: o.price,
              originalPrice: o.originalPrice,
              imageUrl: o.imageUrl,
              url: o.affiliateUrl || o.productUrl || '',
              affiliateUrl: o.affiliateUrl,
            }))
            .sort((a: HomeFeedOffer, b: HomeFeedOffer) => a.price - b.price);

          return {
            id: item.id || `df_${nextPage}_${i}`,
            title: item.title || cheapest.title || '',
            brand: item.brand || undefined,
            imageUrl: cheapest.imageUrl || item.offers[0]?.imageUrl || '',
            price,
            originalPrice: originalPrice > price ? originalPrice : undefined,
            discount,
            savings: originalPrice - price > 200 ? originalPrice - price : undefined,
            platform: cheapest.platform || 'Unknown',
            url: cheapest.affiliateUrl || cheapest.productUrl || '',
            offers,
          };
        }

        const price = item.price || 0;
        const originalPrice = item.originalPrice || 0;
        const discount = item.discount || (originalPrice > price
          ? Math.round((originalPrice - price) / originalPrice * 100) : 0);
        return {
          id: item.id || `df_${nextPage}_${i}`,
          title: item.title || '',
          brand: item.brand || undefined,
          imageUrl: item.imageUrl || '',
          price,
          originalPrice: originalPrice > price ? originalPrice : undefined,
          discount,
          savings: originalPrice - price > 200 ? originalPrice - price : undefined,
          platform: item.platform || 'Unknown',
          url: item.url || '',
          offers: [{
            platform: item.platform || 'Unknown',
            price,
            originalPrice: originalPrice > price ? originalPrice : undefined,
            url: item.url || '',
          }],
        };
      }).filter((p: HomeFeedProduct) => p.price > 0 && p.title && p.imageUrl);

      if (products.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      productCount.current += products.length;

      const newSection: FeedSection = {
        id: `section_${nextPage}`,
        title: sectionDef.title,
        products,
      };

      setSections((prev) => [...prev, newSection]);
      setPage(nextPage);

      const reachedPageCap = nextPage >= MAX_PAGES;
      const reachedProductCap = productCount.current >= MAX_PRODUCTS;
      setHasMore(!reachedPageCap && !reachedProductCap);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
      setHasMore(false);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, category, loading]);

  // IntersectionObserver to auto-trigger loadNext
  useEffect(() => {
    const node = triggerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          loadNext();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadNext]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  return { sections, loading, hasMore, loadNext, triggerRef };
}
