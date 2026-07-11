import axios from 'axios';
import { buildAffiliateUrl } from './affiliate.js';
import { ALL_SEED_PRODUCTS } from './seed-data.js';

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

// ─── Cache ────────────────────────────────────────────────────────────────────

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

function cleanText(t: string): string {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

function parsePrice(t: string | number): number {
  if (typeof t === 'number') return Math.round(t);
  const m = String(t).match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
}

function platformFrom(url: string): string {
  if (!url) return 'Online';
  if (url.includes('flipkart')) return 'Flipkart';
  if (url.includes('myntra')) return 'Myntra';
  if (url.includes('amazon')) return 'Amazon India';
  if (url.includes('ajio')) return 'Ajio';
  if (url.includes('meesho')) return 'Meesho';
  if (url.includes('nykaa')) return 'Nykaa Fashion';
  if (url.includes('tatacliq')) return 'Tata CLiQ';
  if (url.includes('snapdeal')) return 'Snapdeal';
  return 'Online';
}

/**
 * Cleans a URL slug into a searchable product name.
 * e.g. "exclusive-brown-rayon-embroidered-kurta-with-bell-sleeves-pant"
 *   -> "brown rayon embroidered kurta"
 */
const STOP_WORDS = new Set([
  'with', 'and', 'for', 'the', 'buy', 'online', 'india', 'new', 'best',
  'latest', 'exclusive', 'special', 'offer', 'sale', 'free', 'shipping',
  'set', 'combo', 'pack', 'piece', 'pcs', 'pair',
]);

export function slugToSearchQuery(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\d{4,}/g, '')           // remove long numeric IDs
    .split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 5)                       // keep max 5 meaningful words
    .join(' ')
    .trim();
}

// ─── ScraperAPI proxy ─────────────────────────────────────────────────────────

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';

function scraperUrl(targetUrl: string): string {
  if (!SCRAPER_API_KEY) return targetUrl;
  return `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}`;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept-Language': 'en-IN,en;q=0.9',
};

// ─── Per-platform scrapers ────────────────────────────────────────────────────
// Each scraper searches the query on that platform and returns the TOP result
// (cheapest / most relevant). One result per platform = clean comparison view.

async function fetchFlipkart(query: string): Promise<SearchProduct | null> {
  try {
    const { data: html } = await axios.get(
      scraperUrl(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`),
      { headers: { ...HEADERS, Accept: 'text/html' }, timeout: 15000 }
    );

    // Flipkart embeds product JSON in <script> tags
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (jsonMatch) {
      try {
        const state = JSON.parse(jsonMatch[1]);
        const products = state?.pageDataV4?.page?.data?.['10']?.[0]?.widget?.data?.products
          || state?.searchData?.h?.results
          || [];
        const p = products[0];
        if (p) {
          const price = p.productInfo?.value?.pricing?.finalPrice?.decimalValue
            || p.productInfo?.value?.pricing?.finalPrice?.value || 0;
          const orig = p.productInfo?.value?.pricing?.mrpPrice?.decimalValue || 0;
          const id = p.productInfo?.value?.id || '';
          return {
            id: `fk_0`,
            title: p.productInfo?.value?.titles?.title || '',
            price: parsePrice(price),
            originalPrice: orig > price ? parsePrice(orig) : undefined,
            discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
            imageUrl: p.productInfo?.value?.media?.images?.[0]?.url || '',
            platform: 'Flipkart',
            url: id ? `https://www.flipkart.com/p/${id}` : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
          };
        }
      } catch { /* fall through to HTML parse */ }
    }

    // HTML fallback — Flipkart class names
    const titleMatch = html.match(/class="(?:_4rR01T|s1Q9rs|IRpwTa)"[^>]*>([^<]+)/i);
    const priceMatch = html.match(/class="(?:_30jeq3|_1_WHN1)"[^>]*>₹([\d,]+)/i);
    const imgMatch = html.match(/class="(?:_396cs4|_2r_T1I)"[^>]*src="([^"]+)"/i);
    const linkMatch = html.match(/class="(?:_1fQZEK|s1Q9rs IRpwTa)"[^>]*href="([^"]+)"/i);

    if (titleMatch && priceMatch) {
      return {
        id: 'fk_0',
        title: cleanText(titleMatch[1]),
        price: parsePrice(priceMatch[1]),
        imageUrl: imgMatch?.[1] || '',
        platform: 'Flipkart',
        url: linkMatch ? `https://www.flipkart.com${linkMatch[1]}` : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchMyntra(query: string): Promise<SearchProduct | null> {
  try {
    const slug = query.toLowerCase().replace(/\s+/g, '-');
    const { data: html } = await axios.get(
      scraperUrl(`https://www.myntra.com/${slug}?sort=price_asc`),
      { headers: { ...HEADERS, Accept: 'text/html' }, timeout: 15000 }
    );

    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (stateMatch) {
      const state = JSON.parse(stateMatch[1]);
      const products = state?.search?.results || state?.products || [];
      const p = products[0];
      if (p && (p.price?.selling || p.sellingPrice)) {
        return {
          id: `mn_${p.id || 0}`,
          title: `${p.brand || ''} ${p.product || p.name || ''}`.trim(),
          price: p.price?.selling || p.sellingPrice || 0,
          originalPrice: p.price?.mrp || p.mrp || undefined,
          discount: p.discount || undefined,
          imageUrl: p.searchImage || p.image || '',
          platform: 'Myntra',
          url: `https://www.myntra.com/${p.id}`,
          brand: p.brand || undefined,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchMeesho(query: string): Promise<SearchProduct | null> {
  try {
    const { data } = await axios.post(
      'https://www.meesho.com/api/v1/products/search',
      { query, page: 1, limit: 10, filters: {}, sort: 'price_asc' },
      {
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json',
          'x-meesho-client': 'meesho-web',
          Accept: 'application/json',
        },
        timeout: 10000,
      }
    );
    const products = data?.data?.products || data?.products || [];
    if (!products.length) return null;

    // Sort by price and take cheapest
    products.sort((a: any, b: any) => {
      const pa = a.min_price || a.price?.min || a.price || 0;
      const pb = b.min_price || b.price?.min || b.price || 0;
      return pa - pb;
    });

    const p = products[0];
    const price = p.min_price || p.price?.min || p.price || 0;
    const orig = p.mrp || p.price?.max || 0;
    return {
      id: `ms_${p.id || 0}`,
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
  } catch {
    return null;
  }
}

async function fetchAmazon(query: string): Promise<SearchProduct | null> {
  try {
    const { data: html } = await axios.get(
      scraperUrl(`https://www.amazon.in/s?k=${encodeURIComponent(query)}&i=fashion&s=price-asc-rank`),
      { headers: { ...HEADERS, Accept: 'text/html,application/xhtml+xml' }, timeout: 15000 }
    );

    const asins = [...html.matchAll(/data-asin="([A-Z0-9]{10})"/gi)].map(x => x[1]).filter(Boolean);
    const titles = [...html.matchAll(/<span[^>]*class="[^"]*a-size-medium[^"]*a-color-base[^"]*s-inline[^"]*"[^>]*>([^<]+)<\/span>/gi)].map(x => cleanText(x[1]));
    const prices = [...html.matchAll(/<span[^>]*class="a-price-whole"[^>]*>([\d,]+)/gi)].map(x => parsePrice(x[1]));
    const imgs = [...html.matchAll(/<img[^>]*class="s-image"[^>]*src="([^"]+)"/gi)].map(x => x[1]);

    if (titles[0] && prices[0]) {
      return {
        id: 'az_0',
        title: titles[0],
        price: prices[0],
        imageUrl: imgs[0] || '',
        platform: 'Amazon India',
        url: asins[0] ? `https://www.amazon.in/dp/${asins[0]}` : `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAjio(query: string): Promise<SearchProduct | null> {
  try {
    const { data } = await axios.get(
      `https://www.ajio.com/api/search?text=${encodeURIComponent(query)}&pageSize=10&currentPage=0&format=json&sortBy=price-asc`,
      {
        headers: { ...HEADERS, Accept: 'application/json', Referer: 'https://www.ajio.com/' },
        timeout: 10000,
      }
    );
    const products = data?.searchresult?.products || data?.products || [];
    if (!products.length) return null;

    const p = products[0];
    const price = p.price?.value || 0;
    const orig = p.wasPriceData?.value || 0;
    return {
      id: `aj_${p.code || 0}`,
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
  } catch {
    return null;
  }
}

async function fetchNykaa(query: string): Promise<SearchProduct | null> {
  try {
    const { data } = await axios.get(
      `https://www.nykaafashion.com/rest/appapi/V2/search/result?q=${encodeURIComponent(query)}&page=1&pageSize=10&sortBy=price_asc`,
      {
        headers: { ...HEADERS, Accept: 'application/json', Referer: 'https://www.nykaafashion.com/' },
        timeout: 10000,
      }
    );
    const products = data?.response?.products || data?.products || [];
    if (!products.length) return null;

    const p = products[0];
    const price = p.price || p.selling_price || 0;
    const orig = p.mrp || p.market_price || 0;
    return {
      id: `nk_${p.id || 0}`,
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
  } catch {
    return null;
  }
}

async function fetchTataCliq(query: string): Promise<SearchProduct | null> {
  try {
    const { data } = await axios.get(
      `https://www.tatacliq.com/api/v2/search/?searchCategory=all&text=${encodeURIComponent(query)}&pageSize=10&currentPage=0&sortBy=price-asc`,
      {
        headers: { ...HEADERS, Accept: 'application/json', Referer: 'https://www.tatacliq.com/' },
        timeout: 10000,
      }
    );
    const products = data?.searchresult?.products || data?.products || [];
    if (!products.length) return null;

    const p = products[0];
    const price = p.price?.value || p.sellingPrice || 0;
    const orig = p.mrpPrice?.value || p.mrp || 0;
    return {
      id: `tc_${p.code || 0}`,
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
  } catch {
    return null;
  }
}

// ─── Merge — one result per platform, sorted by price ────────────────────────

function buildComparison(results: (SearchProduct | null)[]): SearchProduct[] {
  return results
    .filter((p): p is SearchProduct => p !== null && p.price > 0 && !!p.title)
    .sort((a, b) => a.price - b.price);
}

// ─── Seed data fallback ───────────────────────────────────────────────────────

function searchSeedData(query: string): SearchProduct[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (!terms.length) return [];

  const matches: SearchProduct[] = [];
  for (const sp of ALL_SEED_PRODUCTS) {
    const searchable = `${sp.title} ${sp.brand} ${sp.category}`.toLowerCase();
    if (terms.some(t => searchable.includes(t))) {
      for (const plat of sp.platforms) {
        const discount = plat.originalPrice > plat.price
          ? Math.round(((plat.originalPrice - plat.price) / plat.originalPrice) * 100) : 0;
        matches.push({
          id: `seed_${sp.title.slice(0, 10)}_${plat.platform}_${matches.length}`,
          title: sp.title,
          brand: sp.brand,
          price: plat.price,
          originalPrice: plat.originalPrice > plat.price ? plat.originalPrice : undefined,
          discount: discount > 0 ? discount : undefined,
          imageUrl: sp.imageUrl || '',
          platform: plat.platform.charAt(0).toUpperCase() + plat.platform.slice(1),
          url: plat.url,
        });
      }
    }
  }
  return matches.sort((a, b) => a.price - b.price).slice(0, 30);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Searches all 7 platforms in parallel for the same product query.
 * Returns one result per platform (cheapest match), sorted by price.
 */
export async function searchProducts(query: string): Promise<SearchProduct[]> {
  const key = `search:${query.toLowerCase().trim()}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [fk, mn, ms, az, aj, nk, tc] = await Promise.allSettled([
    fetchFlipkart(query),
    fetchMyntra(query),
    fetchMeesho(query),
    fetchAmazon(query),
    fetchAjio(query),
    fetchNykaa(query),
    fetchTataCliq(query),
  ]);

  let results = buildComparison([
    fk.status === 'fulfilled' ? fk.value : null,
    mn.status === 'fulfilled' ? mn.value : null,
    ms.status === 'fulfilled' ? ms.value : null,
    az.status === 'fulfilled' ? az.value : null,
    aj.status === 'fulfilled' ? aj.value : null,
    nk.status === 'fulfilled' ? nk.value : null,
    tc.status === 'fulfilled' ? tc.value : null,
  ]);

  if (results.length === 0) {
    results = searchSeedData(query);
  }

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
