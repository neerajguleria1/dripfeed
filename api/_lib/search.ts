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
  const m = String(t).match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
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

async function proxyGet(targetUrl: string, extraHeaders: Record<string, string> = {}, timeoutMs = 20000, premium = false): Promise<any> {
  const { data } = await axios.get('https://api.scraperapi.com/', {
    params: {
      api_key: SCRAPER_KEY,
      url: targetUrl,
      render: false,
      country_code: 'in',
      ...(premium ? { premium: true } : {}),
    },
    headers: { Accept: 'application/json', ...extraHeaders },
    timeout: timeoutMs,
  });
  return data;
}

// ─── Platform fetchers (return up to 10 products each) ────────────────────────

async function fetchMeesho(query: string): Promise<SearchProduct[]> {
  try {
    const { data: resp } = await axios.post(
      `https://api.scraperapi.com/`,
      JSON.stringify({ query, page: 1, limit: 20, filters: {}, sort: 'price_asc' }),
      {
        params: { api_key: SCRAPER_KEY, url: 'https://www.meesho.com/api/v1/products/search', render: false },
        headers: { 'Content-Type': 'application/json', 'x-meesho-client': 'meesho-web', Accept: 'application/json' },
        timeout: 20000,
      }
    );
    const products: any[] = resp?.data?.products || resp?.products || [];
    if (!products.length) return [];

    products.sort((a, b) => (a.min_price || a.price?.min || a.price || 0) - (b.min_price || b.price?.min || b.price || 0));

    return products.slice(0, 10).map((p, i) => {
      const price = p.min_price || p.price?.min || p.price || 0;
      const orig = p.mrp || p.price?.max || 0;
      return {
        id: `ms_${p.id || i}`,
        title: p.name || p.product_name || '',
        price: typeof price === 'string' ? parsePrice(price) : price,
        originalPrice: orig > price ? orig : undefined,
        discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
        imageUrl: p.images?.[0]?.url || p.image_url || '',
        platform: 'Meesho',
        url: p.id ? `https://www.meesho.com/product/${p.id}` : `https://www.meesho.com/search?q=${encodeURIComponent(query)}`,
        brand: p.brand_name || undefined,
        rating: p.ratings?.average || undefined,
      };
    }).filter(p => p.price > 0 && p.title);
  } catch {
    return [];
  }
}

async function fetchAjio(query: string): Promise<SearchProduct[]> {
  try {
    const data = await proxyGet(
      `https://www.ajio.com/api/search?text=${encodeURIComponent(query)}&pageSize=20&currentPage=0&format=json&sortBy=price-asc`,
      { Accept: 'application/json', Referer: 'https://www.ajio.com/' }
    );
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
  } catch {
    return [];
  }
}

async function fetchNykaa(query: string): Promise<SearchProduct[]> {
  try {
    const data = await proxyGet(
      `https://www.nykaafashion.com/rest/appapi/V2/search/result?q=${encodeURIComponent(query)}&page=1&pageSize=20&sortBy=price_asc`,
      { Accept: 'application/json', Referer: 'https://www.nykaafashion.com/' }
    );
    const products: any[] = data?.response?.products || data?.products || [];
    if (!products.length) return [];

    return products.slice(0, 10).map((p, i) => {
      const price = p.price || p.selling_price || 0;
      const orig = p.mrp || p.market_price || 0;
      return {
        id: `nk_${p.id || i}`,
        title: `${p.brand_name || ''} ${p.name || ''}`.trim(),
        price: parsePrice(price),
        originalPrice: orig > price ? parsePrice(orig) : undefined,
        discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
        imageUrl: p.image_url || p.images?.[0] || '',
        platform: 'Nykaa Fashion',
        url: p.slug ? `https://www.nykaafashion.com/${p.slug}/p/${p.id}` : `https://www.nykaafashion.com/search/result/?q=${encodeURIComponent(query)}`,
        brand: p.brand_name || undefined,
        rating: p.rating || undefined,
      };
    }).filter(p => p.price > 0 && p.title);
  } catch {
    return [];
  }
}

async function fetchTataCliq(query: string): Promise<SearchProduct[]> {
  try {
    const data = await proxyGet(
      `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(query)}&pageSize=20&currentPage=0&sortBy=price-asc`,
      { Accept: 'application/json', Referer: 'https://www.tatacliq.com/' }
    );
    const products: any[] = data?.searchresult?.products || data?.products || [];
    if (!products.length) return [];

    return products.slice(0, 10).map((p, i) => {
      const price = p.price?.value || p.sellingPrice || 0;
      const orig = p.mrpPrice?.value || p.mrp || 0;
      return {
        id: `tc_${p.code || i}`,
        title: `${p.brandname || p.brand || ''} ${p.name || ''}`.trim(),
        price,
        originalPrice: orig > price ? orig : undefined,
        discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
        imageUrl: p.images?.[0]?.url || '',
        platform: 'Tata CLiQ',
        url: p.url ? `https://www.tatacliq.com${p.url}` : `https://www.tatacliq.com/search/?text=${encodeURIComponent(query)}`,
        brand: p.brandname || p.brand || undefined,
        rating: p.averageRating || undefined,
      };
    }).filter(p => p.price > 0 && p.title);
  } catch {
    return [];
  }
}

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

    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i)
      || html.match(/<script[^>]*>\s*({[\s\S]*?"products"[\s\S]*?})\s*<\/script>/i);

    if (jsonMatch) {
      try {
        const state = JSON.parse(jsonMatch[1]);
        const products: any[] = state?.pageDataV4?.page?.data?.["10"]?.[0]?.widget?.data?.products
          || state?.products
          || [];
        if (products.length) {
          products.sort((a: any, b: any) => {
            const pa = a.productInfo?.value?.pricing?.finalPrice?.value || a.price || 0;
            const pb = b.productInfo?.value?.pricing?.finalPrice?.value || b.price || 0;
            return pa - pb;
          });
          const results = products.slice(0, 10).map((p, i) => {
            const info = p.productInfo?.value || p;
            const price = info.pricing?.finalPrice?.value || info.price || 0;
            const orig = info.pricing?.mrp?.value || info.mrp || 0;
            return {
              id: `fk_${info.pid || i}`,
              title: cleanText(info.title || ''),
              price: parsePrice(price),
              originalPrice: orig > price ? parsePrice(orig) : undefined,
              discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
              imageUrl: info.media?.images?.[0]?.url || '',
              platform: 'Flipkart',
              url: info.baseUrl ? `https://www.flipkart.com${info.baseUrl}` : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
              brand: info.brand || undefined,
            };
          }).filter((p: any) => p.price > 0 && p.title);
          if (results.length) return results;
        }
      } catch { /* fall through to regex */ }
    }

    // Regex fallback — extract multiple products
    const titleMatches = [...html.matchAll(/class="[^"]*(?:KzDlHZ|s1Q9rs|IRpwTa|wjcEIp|_4rR01T|WKTcLC)[^"]*"[^>]*>([^<]{5,80})</gi)].map(m => cleanText(m[1]));
    const priceMatches = [...html.matchAll(/class="[^"]*(?:Nx9bqj|_30jeq3|_1_WHN1|hl05au)[^"]*"[^>]*>₹([\d,]+)/gi)].map(m => parsePrice(m[1]));
    const imgMatches = [...html.matchAll(/<img[^>]*class="[^"]*(?:DByuf4|_396cs4|_2r_T1I)[^"]*"[^>]*src="([^"]+)"/gi)].map(m => m[1]);
    const linkMatches = [...html.matchAll(/href="(\/[^"]+\/p\/[^"?#]+)/gi)].map(m => m[1]);

    const count = Math.min(titleMatches.length, priceMatches.length, 10);
    if (count > 0) {
      return Array.from({ length: count }, (_, i) => ({
        id: `fk_${i}`,
        title: titleMatches[i],
        price: priceMatches[i],
        imageUrl: imgMatches[i] || '',
        platform: 'Flipkart',
        url: linkMatches[i] ? `https://www.flipkart.com${linkMatches[i]}` : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
      })).filter(p => p.price > 0 && p.title);
    }
  } catch { /* skip */ }
  return [];
}

async function fetchMyntra(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEY) return [];
  try {
    const data = await proxyGet(
      `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(query)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`,
      { Accept: 'application/json', 'x-location-code': 'MH', 'x-myntraweb': 'Yes', Referer: 'https://www.myntra.com/' },
      20000,
      true
    );
    const products: any[] = data?.products || data?.searchData?.results || [];
    if (products.length) {
      return products.slice(0, 10).map((p, i) => {
        const price = p.price || p.sellingPrice || 0;
        const orig = p.mrp || p.originalPrice || 0;
        return {
          id: `mn_${p.productId || p.id || i}`,
          title: `${p.brand || ''} ${p.productName || p.name || ''}`.trim(),
          price,
          originalPrice: orig > price ? orig : undefined,
          discount: p.discount || (orig > price ? Math.round(((orig - price) / orig) * 100) : undefined),
          imageUrl: p.searchImage || p.images?.[0] || '',
          platform: 'Myntra',
          url: p.productId ? `https://www.myntra.com/${p.productId}` : `https://www.myntra.com/${encodeURIComponent(query)}`,
          brand: p.brand || undefined,
          rating: p.rating || undefined,
        };
      }).filter(p => p.price > 0 && p.title);
    }
  } catch { /* fall through */ }

  // HTML fallback
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: SCRAPER_KEY,
        url: `https://www.myntra.com/${query.toLowerCase().replace(/\s+/g, '-')}?sort=price_asc`,
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
      const state = JSON.parse(stateMatch[1]);
      const products: any[] = state?.search?.results || state?.searchData?.results || state?.products || [];
      return products.slice(0, 10).map((p, i) => {
        const price = p.price?.selling || p.sellingPrice || p.price || 0;
        const orig = p.price?.mrp || p.mrp || 0;
        return {
          id: `mn_${p.id || i}`,
          title: `${p.brand || ''} ${p.product || p.productName || p.name || ''}`.trim(),
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
  } catch { /* skip */ }
  return [];
}

async function fetchAmazon(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEY) return [];
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: SCRAPER_KEY,
        url: `https://www.amazon.in/s?k=${encodeURIComponent(query)}&i=fashion&s=price-asc-rank`,
        render: false,
        country_code: 'in',
      },
      timeout: 25000,
    });

    if (typeof html !== 'string') return [];

    const asins = [...html.matchAll(/data-asin="([A-Z0-9]{10})"/gi)].map(x => x[1]).filter(Boolean);

    const titlePatterns = [
      /<span[^>]*class="[^"]*a-size-medium[^"]*a-color-base[^"]*s-inline[^"]*"[^>]*>([^<]+)<\/span>/gi,
      /<span[^>]*class="[^"]*a-size-base-plus[^"]*a-color-base[^"]*a-text-normal[^"]*"[^>]*>([^<]+)<\/span>/gi,
      /<h2[^>]*class="[^"]*a-size-mini[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]{10,})<\/span>/gi,
    ];

    let titles: string[] = [];
    for (const pat of titlePatterns) {
      const matches = [...html.matchAll(pat)].map(x => cleanText(x[1])).filter(t => t.length > 5);
      if (matches.length) { titles = matches; break; }
    }

    const prices = [...html.matchAll(/<span[^>]*class="a-price-whole"[^>]*>([\d,]+)/gi)].map(x => parsePrice(x[1]));
    const imgs = [...html.matchAll(/<img[^>]*class="s-image"[^>]*src="([^"]+)"/gi)].map(x => x[1]);

    const count = Math.min(titles.length, prices.length, 10);
    if (count > 0) {
      return Array.from({ length: count }, (_, i) => ({
        id: `az_${i}`,
        title: titles[i],
        price: prices[i],
        imageUrl: imgs[i] || '',
        platform: 'Amazon India',
        url: asins[i] ? `https://www.amazon.in/dp/${asins[i]}` : `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
      })).filter(p => p.price > 0 && p.title);
    }
  } catch { /* skip */ }
  return [];
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

  const [ms, aj, nk, tc, fk, mn, az] = await Promise.allSettled([
    fetchMeesho(query),
    fetchAjio(query),
    fetchNykaa(query),
    fetchTataCliq(query),
    fetchFlipkart(query),
    fetchMyntra(query),
    fetchAmazon(query),
  ]);

  const results = buildComparison([
    ms.status === 'fulfilled' ? ms.value : [],
    aj.status === 'fulfilled' ? aj.value : [],
    nk.status === 'fulfilled' ? nk.value : [],
    tc.status === 'fulfilled' ? tc.value : [],
    fk.status === 'fulfilled' ? fk.value : [],
    mn.status === 'fulfilled' ? mn.value : [],
    az.status === 'fulfilled' ? az.value : [],
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
