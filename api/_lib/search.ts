import axios from 'axios';
import { buildAffiliateUrl } from './affiliate.js';
import { ALL_SEED_PRODUCTS, type SeedProduct } from './seed-data.js';

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

function cleanText(t: string): string {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

function parsePrice(t: string | number): number {
  if (typeof t === 'number') return t;
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

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';

function scraperUrl(targetUrl: string): string {
  if (!SCRAPER_API_KEY) return targetUrl;
  return `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}`;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html',
  'Accept-Language': 'en-IN,en;q=0.9',
};

async function searchGoogleShopping(query: string): Promise<SearchProduct[]> {
  try {
    const { data: html } = await axios.get(
      scraperUrl(`https://www.google.com/search?q=${encodeURIComponent(query + ' buy online India')}&tbm=shop&num=20&hl=en&gl=in`),
      { headers: HEADERS, timeout: 15000 }
    );

    const results: SearchProduct[] = [];
    const ldPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = ldPattern.exec(html)) !== null) {
      try {
        const d = JSON.parse(m[1]);
        if (d['@type'] === 'Product' || d?.offers) {
          const price = d.offers?.lowPrice || d.offers?.price;
          if (price && d.name) {
            const url = d.url || d.offers?.url || '';
            results.push({
              id: `gs_${results.length}`,
              title: d.name,
              price: typeof price === 'string' ? parseFloat(price) : price,
              imageUrl: d.image || '',
              platform: platformFrom(url),
              url,
              brand: d.brand?.name || d.brand || undefined,
              rating: d.aggregateRating?.ratingValue || undefined,
            });
          }
        }
      } catch { /* skip */ }
    }

    // NOTE: Removed broken HTML fallback that misaligned images with titles.
    // The LD+JSON path above is the only reliable source from Google Shopping.
    // HTML scraping of Google results is fragile and produces wrong image/title pairs.

    return results.slice(0, 20);
  } catch {
    return [];
  }
}

async function searchFlipkart(query: string): Promise<SearchProduct[]> {
  try {
    const { data: html } = await axios.get(
      scraperUrl(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}`),
      { headers: HEADERS, timeout: 15000 }
    );

    const titles = [...html.matchAll(/class="_4rR01T"[^>]*>([^<]+)/gi)].map(x => cleanText(x[1]));
    const prices = [...html.matchAll(/class="_30jeq3"[^>]*>₹([\d,]+)/gi)].map(x => parsePrice(x[1]));
    const origPrices = [...html.matchAll(/class="_3I9_wc"[^>]*>₹([\d,]+)/gi)].map(x => parsePrice(x[1]));
    const imgs = [...html.matchAll(/class="_396cs4"[^>]*src="([^"]+)"/gi)].map(x => x[1]);
    const links = [...html.matchAll(/class="_1fQZEK"[^>]*href="([^"]+)"/gi)].map(x => x[1]);
    const ratings = [...html.matchAll(/class="_3LWZlK"[^>]*>([^<]+)/gi)].map(x => parseFloat(x[1]));

    const results: SearchProduct[] = [];
    for (let i = 0; i < Math.min(titles.length, prices.length, 10); i++) {
      if (prices[i] > 0 && titles[i]) {
        const url = `https://www.flipkart.com${links[i] || ''}`;
        const orig = origPrices[i] || 0;
        results.push({
          id: `fk_${i}`,
          title: titles[i],
          price: prices[i],
          originalPrice: orig > prices[i] ? orig : undefined,
          discount: orig > prices[i] ? Math.round(((orig - prices[i]) / orig) * 100) : undefined,
          imageUrl: imgs[i] || '',
          platform: 'Flipkart',
          url,
          rating: ratings[i] || undefined,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function searchMeesho(query: string): Promise<SearchProduct[]> {
  try {
    const { data } = await axios.post(
      'https://www.meesho.com/api/v1/products/search',
      { query, page: 1, limit: 10 },
      {
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json',
          'x-meesho-client': 'meesho-web',
        },
        timeout: 8000,
      }
    );
    const products = data?.data?.products || data?.products || [];
    return products.slice(0, 10).map((p: any, i: number) => {
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
        url: `https://www.meesho.com/product/${p.id || ''}`,
        brand: p.brand_name || undefined,
        rating: p.ratings?.average || undefined,
      };
    }).filter((p: SearchProduct) => p.price > 0 && p.title);
  } catch {
    return [];
  }
}

async function searchAmazon(query: string): Promise<SearchProduct[]> {
  try {
    const { data: html } = await axios.get(
      scraperUrl(`https://www.amazon.in/s?k=${encodeURIComponent(query)}&i=fashion`),
      { headers: { ...HEADERS, 'Accept': 'text/html,application/xhtml+xml' }, timeout: 15000 }
    );
    const results: SearchProduct[] = [];
    // Amazon embeds product data in __NEXT_DATA__ or data-asin blocks
    const asinBlocks = [...html.matchAll(/data-asin="([A-Z0-9]{10})"[\s\S]*?data-component-type="s-search-result"/gi)];
    const titles = [...html.matchAll(/<span[^>]*class="[^"]*a-size-medium[^"]*a-color-base[^"]*s-inline[^"]*"[^>]*>([^<]+)<\/span>/gi)].map(x => cleanText(x[1]));
    const prices = [...html.matchAll(/<span[^>]*class="a-price-whole"[^>]*>([\d,]+)/gi)].map(x => parsePrice(x[1]));
    const imgs = [...html.matchAll(/<img[^>]*class="s-image"[^>]*src="([^"]+)"/gi)].map(x => x[1]);
    const asins = [...html.matchAll(/data-asin="([A-Z0-9]{10})"/gi)].map(x => x[1]).filter(Boolean);

    for (let i = 0; i < Math.min(titles.length, prices.length, 10); i++) {
      if (prices[i] > 0 && titles[i]) {
        results.push({
          id: `az_${i}`,
          title: titles[i],
          price: prices[i],
          imageUrl: imgs[i] || '',
          platform: 'Amazon India',
          url: asins[i] ? `https://www.amazon.in/dp/${asins[i]}` : `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function searchAjio(query: string): Promise<SearchProduct[]> {
  try {
    // Ajio has a public search API used by their website
    const { data } = await axios.get(
      `https://www.ajio.com/api/search?text=${encodeURIComponent(query)}&pageSize=10&currentPage=0&format=json`,
      {
        headers: {
          ...HEADERS,
          'Accept': 'application/json',
          'Referer': 'https://www.ajio.com/',
        },
        timeout: 8000,
      }
    );
    const products = data?.searchresult?.products || data?.products || [];
    return products.slice(0, 10).map((p: any, i: number) => {
      const price = p.price?.value || p.wasPriceData?.value || 0;
      const orig = p.wasPriceData?.value || p.price?.value || 0;
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
    }).filter((p: SearchProduct) => p.price > 0 && p.title);
  } catch {
    return [];
  }
}

async function searchMyntra(query: string): Promise<SearchProduct[]> {
  try {
    const slug = query.toLowerCase().replace(/\s+/g, '-');
    const { data: html } = await axios.get(scraperUrl(`https://www.myntra.com/${slug}`), {
      headers: HEADERS,
      timeout: 15000,
    });

    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const products = state?.search?.results || state?.products || [];
        return products.slice(0, 10).map((p: any, i: number) => ({
          id: `mn_${p.id || i}`,
          title: `${p.brand || ''} ${p.product || p.name || ''}`.trim(),
          price: p.price?.selling || p.sellingPrice || 0,
          originalPrice: p.price?.mrp || p.mrp || undefined,
          discount: p.discount || undefined,
          imageUrl: p.searchImage || p.image || '',
          platform: 'Myntra',
          url: `https://www.myntra.com/${p.id || i}`,
          brand: p.brand || undefined,
        }));
      } catch { /* fall through */ }
    }

    // NOTE: Removed broken HTML fallback that misaligned images with prices.
    // The __INITIAL_STATE__ JSON path above is the only reliable source from Myntra.
    return [];
  } catch {
    return [];
  }
}

function mergeResults(arrays: SearchProduct[][]): SearchProduct[] {
  const seen = new Set<string>();
  const merged: SearchProduct[] = [];
  for (const arr of arrays) {
    for (const p of arr) {
      const key = p.title.toLowerCase().slice(0, 40);
      if (!seen.has(key) && p.title && p.price > 0) {
        seen.add(key);
        merged.push(p);
      }
    }
  }
  return merged.sort((a, b) => a.price - b.price);
}

/**
 * Fallback search through local seed data when scrapers fail.
 * Matches query words against product title, brand, and category.
 */
function searchSeedData(query: string): SearchProduct[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (terms.length === 0) return [];

  const matches: SearchProduct[] = [];

  for (const sp of ALL_SEED_PRODUCTS) {
    const searchable = `${sp.title} ${sp.brand} ${sp.category}`.toLowerCase();
    const score = terms.filter(t => searchable.includes(t)).length;

    if (score > 0) {
      // Expand each platform entry into a separate SearchProduct
      for (const plat of sp.platforms) {
        const discount = plat.originalPrice > plat.price
          ? Math.round(((plat.originalPrice - plat.price) / plat.originalPrice) * 100)
          : 0;

        // Only use seed imageUrl if it's from a trusted source (unsplash is fine for seed data
        // but we mark it so the frontend can show a "stock image" indicator)
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

  // Sort by relevance (score) would require tracking, so just sort by price
  return matches.sort((a, b) => a.price - b.price).slice(0, 30);
}

export async function searchProducts(query: string): Promise<SearchProduct[]> {
  const key = `search:${query.toLowerCase().trim()}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [gs, fk, mn, ms, az, aj] = await Promise.allSettled([
    searchGoogleShopping(query),
    searchFlipkart(query),
    searchMyntra(query),
    searchMeesho(query),
    searchAmazon(query),
    searchAjio(query),
  ]);

  let results = mergeResults([
    gs.status === 'fulfilled' ? gs.value : [],
    fk.status === 'fulfilled' ? fk.value : [],
    mn.status === 'fulfilled' ? mn.value : [],
    ms.status === 'fulfilled' ? ms.value : [],
    az.status === 'fulfilled' ? az.value : [],
    aj.status === 'fulfilled' ? aj.value : [],
  ]);

  // Fallback to seed data if all scrapers returned empty
  // (common on Vercel serverless — cloud IPs get blocked by retailers)
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
