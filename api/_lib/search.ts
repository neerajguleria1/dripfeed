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

// ─── Cache (15 min TTL) ───────────────────────────────────────────────────────

const cache = new Map<string, { data: SearchProduct[]; ts: number }>();
const CACHE_TTL = 15 * 60 * 1000;

function getCached(key: string): SearchProduct[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: SearchProduct[]) {
  cache.set(key, { data, ts: Date.now() });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  'set', 'combo', 'pack', 'piece', 'pcs', 'pair',
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

// ─── Amazon — ScraperAPI Structured (confirmed working ✅) ────────────────────

async function fetchAmazon(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEY) return [];
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params: { api_key: SCRAPER_KEY, query, country_code: 'in', tld: 'in' },
      timeout: 25000,
    });

    const products: any[] = data?.results || data?.organic_results || [];
    if (!products.length) return [];

    return products.slice(0, 15).map((p, i) => {
      const price = parsePrice(p.price || p.sale_price || '0');
      const orig = parsePrice(p.original_price || p.list_price || '0');
      return {
        id: `az_${p.asin || i}`,
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
    }).filter(p => p.price > 0 && p.title);
  } catch { return []; }
}

// ─── Flipkart — ScraperAPI render:true with updated CSS selectors ─────────────

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
        wait_for_selector: 'div[data-id]',
      },
      timeout: 35000,
    });

    if (typeof html !== 'string') return [];

    // Try JSON state first
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (jsonMatch) {
      try {
        const state = JSON.parse(jsonMatch[1]);
        const slots: any[] = Object.values(state?.pageDataV4?.page?.data || {}).flat();
        const products: any[] = [];
        for (const slot of slots) {
          const p = slot?.widget?.data?.products;
          if (Array.isArray(p)) products.push(...p);
        }
        if (products.length) {
          return products.slice(0, 10).map((p, i) => {
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

    // Regex fallback with updated 2025 Flipkart class names
    const titles = [...html.matchAll(/class="[^"]*(?:KzDlHZ|s1Q9rs|IRpwTa|wjcEIp|_4rR01T|WKTcLC|col-12-12)[^"]*"[^>]*>([^<]{5,120})</gi)]
      .map(m => cleanText(m[1])).filter(t => t.length > 5);
    const prices = [...html.matchAll(/class="[^"]*(?:Nx9bqj|_30jeq3|_1_WHN1|hl05au|_3I9_wc)[^"]*"[^>]*>₹\s*([\d,]+)/gi)]
      .map(m => parsePrice(m[1]));
    const imgs = [...html.matchAll(/<img[^>]*class="[^"]*(?:DByuf4|_396cs4|_2r_T1I|q6DClP)[^"]*"[^>]*src="([^"]+)"/gi)]
      .map(m => m[1]);
    const links = [...html.matchAll(/href="(\/[^"]+\/p\/[^"?#]+)/gi)].map(m => m[1]);

    const count = Math.min(titles.length, prices.length, 10);
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

// ─── Myntra — render:true with __NEXT_DATA__ extraction ──────────────────────

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
      timeout: 35000,
    });

    if (typeof html !== 'string') return [];

    // Try window.__myx state
    const stateMatch = html.match(/window\.__myx\s*=\s*({[\s\S]*?});\s*(?:<\/script>|window\.)/i)
      || html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);

    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const products: any[] = state?.search?.results || state?.searchData?.results || state?.products || [];
        if (products.length) {
          return products.slice(0, 10).map((p, i) => {
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

    // Regex fallback
    const prices = [...html.matchAll(/(?:Rs\.|₹)\s*([\d,]+)/g)].map(m => parsePrice(m[1])).filter(p => p > 0);
    const titles = [...html.matchAll(/class="[^"]*product-product[^"]*"[^>]*>([^<]{5,100})</gi)].map(m => cleanText(m[1]));
    const imgs = [...html.matchAll(/<img[^>]*class="[^"]*search-resultCard[^"]*"[^>]*src="([^"]+)"/gi)].map(m => m[1]);

    const count = Math.min(titles.length, prices.length, 8);
    if (count > 0) {
      return Array.from({ length: count }, (_, i) => ({
        id: `mn_${i}`,
        title: titles[i],
        price: prices[i],
        imageUrl: imgs[i] || '',
        platform: 'Myntra',
        url: `https://www.myntra.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
      })).filter(p => p.price > 0 && p.title);
    }
  } catch { /* skip */ }
  return [];
}

// ─── Ajio — direct JSON API ───────────────────────────────────────────────────

async function fetchAjio(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEY) return [];
  try {
    const { data } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: SCRAPER_KEY,
        url: `https://www.ajio.com/api/search?text=${encodeURIComponent(query)}&pageSize=20&currentPage=0&format=json&sortBy=price-asc`,
        render: false,
        country_code: 'in',
        keep_headers: true,
      },
      headers: {
        'x-scraperapi-headers': JSON.stringify({
          'Accept': 'application/json',
          'Referer': 'https://www.ajio.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }),
      },
      timeout: 20000,
    });

    const products: any[] = data?.searchresult?.products || data?.products || [];
    if (!products.length) return [];

    return products.slice(0, 10).map((p, i) => {
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

// ─── Build comparison ─────────────────────────────────────────────────────────

function buildComparison(results: SearchProduct[][]): SearchProduct[] {
  return results
    .flat()
    .filter(p => p.price > 0 && !!p.title)
    .sort((a, b) => a.price - b.price);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchProducts(query: string): Promise<SearchProduct[]> {
  const key = `search:${query.toLowerCase().trim()}`;
  const cached = getCached(key);
  if (cached) return cached;

  // Amazon is confirmed working. Run all in parallel.
  const [az, fk, mn, aj] = await Promise.allSettled([
    fetchAmazon(query),
    fetchFlipkart(query),
    fetchMyntra(query),
    fetchAjio(query),
  ]);

  const results = buildComparison([
    az.status === 'fulfilled' ? az.value : [],
    fk.status === 'fulfilled' ? fk.value : [],
    mn.status === 'fulfilled' ? mn.value : [],
    aj.status === 'fulfilled' ? aj.value : [],
  ]);

  const withAffiliate = results.map(p => ({
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
