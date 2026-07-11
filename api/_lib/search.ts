import axios from 'axios';
import { buildAffiliateUrl } from './affiliate.js';

export interface SearchProduct {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  imageUrl: string;
  platform: string;
  url: string;
  brand?: string;
  rating?: number;
  affiliateUrl?: string;
}

const cache = new Map<string, { data: SearchProduct[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function getCached(key: string): SearchProduct[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: SearchProduct[]) {
  cache.set(key, { data, ts: Date.now() });
}

function parsePrice(t: string | number): number {
  if (typeof t === 'number') return Math.round(t);
  const m = String(t).replace(/[₹,\s]/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

function cleanText(t: string): string {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

const STOP_WORDS = new Set([
  'with', 'and', 'for', 'the', 'buy', 'online', 'india', 'new', 'best',
  'latest', 'exclusive', 'special', 'offer', 'sale', 'free', 'shipping',
]);

export function slugToSearchQuery(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\d{4,}/g, '')
    .split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 5)
    .join(' ')
    .trim();
}

const SCRAPER_KEY = process.env.SCRAPER_API_KEY || '';

// ─── Amazon structured — fetch one page ──────────────────────────────────────

async function fetchAmazonPage(query: string, page = 1): Promise<SearchProduct[]> {
  if (!SCRAPER_KEY) return [];
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params: { api_key: SCRAPER_KEY, query, country_code: 'in', tld: 'in', page },
      timeout: 25000,
    });

    const products: any[] = data?.results || data?.organic_results || [];
    if (!products.length) return [];

    return products.map((p, i) => {
      const price = typeof p.price === 'number' ? p.price : parsePrice(p.price || p.sale_price || '0');
      const orig = typeof p.original_price === 'number' ? p.original_price : parsePrice(p.original_price || p.list_price || '0');
      return {
        id: `az_p${page}_${p.asin || i}`,
        title: cleanText(p.name || p.title || ''),
        price,
        originalPrice: orig > price ? orig : undefined,
        discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
        imageUrl: p.image || p.thumbnail || '',
        platform: 'Amazon India',
        url: p.asin ? `https://www.amazon.in/dp/${p.asin}` : `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
        brand: p.brand || undefined,
        rating: p.stars ? parseFloat(p.stars) : undefined,
      };
    }).filter(p => p.price > 0 && p.title.length > 0);
  } catch { return []; }
}

// ─── Flipkart via ScraperAPI async (non-blocking, best effort) ────────────────

async function fetchFlipkart(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEY) return [];
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: SCRAPER_KEY,
        url: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`,
        render: true,
        country_code: 'in',
        premium: true,
      },
      timeout: 30000,
    });

    if (typeof html !== 'string') return [];

    // Try embedded JSON state
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (jsonMatch) {
      try {
        const state = JSON.parse(jsonMatch[1]);
        const slots: any[] = Object.values(state?.pageDataV4?.page?.data || {}).flat() as any[];
        const products: any[] = [];
        for (const slot of slots) {
          const p = (slot as any)?.widget?.data?.products;
          if (Array.isArray(p)) products.push(...p);
        }
        if (products.length) {
          return products.slice(0, 20).map((p: any, i: number) => {
            const info = p.productInfo?.value || p;
            const price = parsePrice(info.pricing?.finalPrice?.value || info.price || 0);
            const orig = parsePrice(info.pricing?.mrp?.value || info.mrp || 0);
            return {
              id: `fk_${info.pid || i}`,
              title: cleanText(info.title || ''),
              price,
              originalPrice: orig > price ? orig : undefined,
              discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
              imageUrl: info.media?.images?.[0]?.url || '',
              platform: 'Flipkart',
              url: info.baseUrl ? `https://www.flipkart.com${info.baseUrl}` : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
              brand: info.brand || undefined,
            };
          }).filter((p: any) => p.price > 0 && p.title);
        }
      } catch { /* fall through */ }
    }

    // Regex fallback
    const titles = [...html.matchAll(/class="[^"]*(?:KzDlHZ|s1Q9rs|IRpwTa|wjcEIp|_4rR01T|WKTcLC)[^"]*"[^>]*>([^<]{5,120})</gi)]
      .map(m => cleanText(m[1])).filter(t => t.length > 5);
    const prices = [...html.matchAll(/class="[^"]*(?:Nx9bqj|_30jeq3|_1_WHN1|hl05au)[^"]*"[^>]*>₹\s*([\d,]+)/gi)]
      .map(m => parsePrice(m[1]));
    const imgs = [...html.matchAll(/<img[^>]*class="[^"]*(?:DByuf4|_396cs4|_2r_T1I)[^"]*"[^>]*src="([^"]+)"/gi)]
      .map(m => m[1]);
    const links = [...html.matchAll(/href="(\/[^"]+\/p\/[^"?#]+)/gi)].map(m => m[1]);

    const count = Math.min(titles.length, prices.length, 20);
    if (count > 0) {
      return Array.from({ length: count }, (_, i) => ({
        id: `fk_${i}`,
        title: titles[i],
        price: prices[i],
        imageUrl: imgs[i] || '',
        platform: 'Flipkart',
        url: links[i] ? `https://www.flipkart.com${links[i]}` : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
      })).filter(p => p.price > 0 && p.title);
    }
  } catch { /* skip */ }
  return [];
}

// ─── Myntra via render:true ───────────────────────────────────────────────────

async function fetchMyntra(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEY) return [];
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: SCRAPER_KEY,
        url: `https://www.myntra.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
        render: true,
        country_code: 'in',
        premium: true,
      },
      timeout: 30000,
    });

    if (typeof html !== 'string') return [];

    const stateMatch = html.match(/window\.__myx\s*=\s*({[\s\S]*?});\s*(?:<\/script>|window\.)/i)
      || html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);

    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const products: any[] = state?.search?.results || state?.searchData?.results || state?.products || [];
        if (products.length) {
          return products.slice(0, 20).map((p, i) => {
            const price = p.price?.selling || p.sellingPrice || p.price || 0;
            const orig = p.price?.mrp || p.mrp || 0;
            return {
              id: `mn_${p.id || i}`,
              title: `${p.brand || ''} ${p.product || p.productName || ''}`.trim(),
              price,
              originalPrice: orig > price ? orig : undefined,
              discount: p.discount || undefined,
              imageUrl: p.searchImage || p.image || '',
              platform: 'Myntra',
              url: p.id ? `https://www.myntra.com/${p.id}` : `https://www.myntra.com/${encodeURIComponent(query)}`,
              brand: p.brand || undefined,
            };
          }).filter(p => p.price > 0 && p.title);
        }
      } catch { /* fall through */ }
    }
  } catch { /* skip */ }
  return [];
}

// ─── Ajio via JSON API ────────────────────────────────────────────────────────

async function fetchAjio(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEY) return [];
  try {
    const { data } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: SCRAPER_KEY,
        url: `https://www.ajio.com/api/search?text=${encodeURIComponent(query)}&pageSize=20&currentPage=0&format=json&sortBy=price-asc`,
        render: false,
        country_code: 'in',
      },
      timeout: 20000,
    });

    const products: any[] = data?.searchresult?.products || data?.products || [];
    if (!products.length) return [];

    return products.slice(0, 20).map((p, i) => {
      const price = p.price?.value || 0;
      const orig = p.wasPriceData?.value || 0;
      return {
        id: `aj_${p.code || i}`,
        title: `${p.brandname || ''} ${p.name || ''}`.trim(),
        price,
        originalPrice: orig > price ? orig : undefined,
        discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
        imageUrl: p.images?.[0]?.url ? `https://assets.ajio.com${p.images[0].url}` : '',
        platform: 'Ajio',
        url: p.url ? `https://www.ajio.com${p.url}` : `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`,
        brand: p.brandname || undefined,
        rating: p.averageRating || undefined,
      };
    }).filter(p => p.price > 0 && p.title);
  } catch { return []; }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchProducts(query: string): Promise<SearchProduct[]> {
  const key = `search:${query.toLowerCase().trim()}`;
  const cached = getCached(key);
  if (cached) return cached;

  // Fetch Amazon pages 1+2 in parallel with other platforms
  const [az1, az2, fk, mn, aj] = await Promise.allSettled([
    fetchAmazonPage(query, 1),
    fetchAmazonPage(query, 2),
    fetchFlipkart(query),
    fetchMyntra(query),
    fetchAjio(query),
  ]);

  const amazonResults = [
    ...(az1.status === 'fulfilled' ? az1.value : []),
    ...(az2.status === 'fulfilled' ? az2.value : []),
  ];

  // Deduplicate Amazon by ASIN
  const seenAsins = new Set<string>();
  const dedupedAmazon = amazonResults.filter(p => {
    const asin = p.url.split('/dp/')[1]?.split('?')[0];
    if (!asin || seenAsins.has(asin)) return false;
    seenAsins.add(asin);
    return true;
  });

  const allResults = [
    ...dedupedAmazon,
    ...(fk.status === 'fulfilled' ? fk.value : []),
    ...(mn.status === 'fulfilled' ? mn.value : []),
    ...(aj.status === 'fulfilled' ? aj.value : []),
  ]
    .filter(p => p.price > 0 && p.title.length > 0)
    .sort((a, b) => a.price - b.price);

  const withAffiliate = allResults.map(p => ({
    ...p,
    affiliateUrl: buildAffiliateUrl(p.platform, p.url),
  }));

  setCache(key, withAffiliate);
  return withAffiliate;
}

const TRENDING_QUERIES = ['kurta sets women', 'sneakers men india', 'sarees silk', 'watches men under 5000'];

export async function getTrending(): Promise<SearchProduct[]> {
  const key = 'trending';
  const cached = getCached(key);
  if (cached) return cached;

  const all = (await Promise.all(TRENDING_QUERIES.map(q => searchProducts(q).catch(() => [])))).flat();
  const seen = new Set<string>();
  const unique = all.filter(p => {
    const k = p.title.toLowerCase().slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 24);

  setCache(key, unique);
  return unique;
}
