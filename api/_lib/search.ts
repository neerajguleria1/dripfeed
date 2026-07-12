import axios from 'axios';
import { buildAffiliateUrl } from './affiliate.js';
import { connectDB } from './db.js';
import SearchCache from './models/SearchCache.js';

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
// L1: in-memory (instant, dies on cold start)
// L2: MongoDB (persistent across deploys and cold starts, 6hr TTL)
// This means the same query only hits ScraperAPI ONCE per 6 hours
// regardless of how many Vercel instances are running.

const memCache = new Map<string, { data: SearchProduct[]; ts: number }>();
const MEM_TTL  = 2 * 60 * 60 * 1000; // 2hr in-memory
const DB_TTL_MS = 6 * 60 * 60 * 1000; // 6hr MongoDB (matches schema expireAfterSeconds)

function getMemCached(key: string): SearchProduct[] | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > MEM_TTL) { memCache.delete(key); return null; }
  return entry.data;
}

function setMemCache(key: string, data: SearchProduct[]) {
  memCache.set(key, { data, ts: Date.now() });
}

async function getDbCached(query: string): Promise<SearchProduct[] | null> {
  try {
    await connectDB();
    const doc = await SearchCache.findOne({ query }).lean();
    if (!doc) return null;
    // Double-check TTL client-side (TTL index can lag by up to 60s)
    if (Date.now() - new Date(doc.cachedAt).getTime() > DB_TTL_MS) return null;
    return doc.results as SearchProduct[];
  } catch { return null; }
}

async function setDbCache(query: string, results: SearchProduct[]) {
  try {
    await connectDB();
    await SearchCache.findOneAndUpdate(
      { query },
      { results, cachedAt: new Date() },
      { upsert: true, new: true }
    );
  } catch { /* non-fatal — scraper result still returned */ }
}

function parsePrice(t: string | number): number {
  if (typeof t === 'number') return Math.round(t);
  const m = String(t).replace(/[₹,\s]/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

function cleanText(t: string): string {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

// ─── Product quality validator ────────────────────────────────────────────────
// Rejects slugs, category strings, and anything that doesn't look like a real product name

const CATEGORY_SLUGS = new Set([
  'women', 'men', 'kids', 'ethnic', 'western', 'fashion', 'clothing',
  'footwear', 'accessories', 'buy online', 'shop online', 'india',
]);

function isValidProduct(p: { title: string; price: number; imageUrl: string }): boolean {
  const t = p.title.trim();
  if (p.price <= 0) return false;
  if (t.length < 5) return false;
  if (CATEGORY_SLUGS.has(t.toLowerCase())) return false;
  if (!/[a-zA-Z]{3,}/.test(t)) return false;
  // Accept https:// URLs and data: base64 images (Google Shopping)
  if (!p.imageUrl || (!p.imageUrl.startsWith('https://') && !p.imageUrl.startsWith('data:'))) return false;
  return true;
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

// ─── Query normalizer ────────────────────────────────────────────────────────
// Normalizes user queries so "trousers women" and "women trousers" hit the same
// cache key, and common variants map to the best search term.
function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')         // collapse whitespace
    .replace(/s\b/g, '')          // remove trailing 's' (trousers→trouser, jeans→jean)
    .replace(/[^a-z0-9 ]/g, '')  // strip special chars
    .split(' ')
    .filter(Boolean)
    .sort()                        // canonical word order
    .join(' ');
}


  process.env.SCRAPER_API_KEY,
  process.env.SCRAPER_API_KEY_2,
  process.env.SCRAPER_API_KEY_3,
  process.env.SCRAPER_API_KEY_4,
  process.env.SCRAPER_API_KEY_5,
  process.env.SCRAPER_API_KEY_6,
  process.env.SCRAPER_API_KEY_7,
  process.env.SCRAPER_API_KEY_8,
  process.env.SCRAPER_API_KEY_9,
  process.env.SCRAPER_API_KEY_10,
].filter(Boolean) as string[];

// Round-robin counter — spreads load evenly across all keys
let rrIndex = 0;
function getNextRoundRobinKey(): string {
  if (!SCRAPER_KEYS.length) return '';
  const key = SCRAPER_KEYS[rrIndex % SCRAPER_KEYS.length];
  rrIndex = (rrIndex + 1) % SCRAPER_KEYS.length;
  return key;
}

// On 429, skip to the next key in rotation
function getNextKey(currentKey: string): string {
  const idx = SCRAPER_KEYS.indexOf(currentKey);
  return SCRAPER_KEYS[(idx + 1) % SCRAPER_KEYS.length] || currentKey;
}

// ─── Amazon structured — fetch one page ──────────────────────────────────────

async function fetchAmazonPage(query: string, page = 1): Promise<SearchProduct[]> {
  if (!SCRAPER_KEYS.length) return [];
  const key = getNextRoundRobinKey();
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params: { api_key: key, query, country_code: 'in', tld: 'in', page },
      timeout: 25000,
    });

    const products: any[] = data?.results || data?.organic_results || [];
    if (!products.length) return [];

    function mapAmazonProduct(p: any, i: number): SearchProduct {
    const price = typeof p.price === 'number' ? p.price : parsePrice(p.price || p.sale_price || '0');
    const orig = typeof p.original_price === 'number' ? p.original_price : parsePrice(p.original_price || p.list_price || '0');
    const imageUrl = (p.image || p.thumbnail || '') as string;
    return {
      id: `az_p${page}_${p.asin || i}`,
      title: cleanText(p.name || p.title || ''),
      price,
      originalPrice: orig > price ? orig : undefined,
      discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
      imageUrl: imageUrl.startsWith('https://') ? imageUrl : '',
      platform: 'Amazon India',
      url: p.asin ? `https://www.amazon.in/dp/${p.asin}` : `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
      brand: p.brand || undefined,
      rating: p.stars ? parseFloat(p.stars) : undefined,
    };
  }

    return products.map(mapAmazonProduct).filter(p => isValidProduct(p));
  } catch (e: any) {
    if (e?.response?.status === 429) {
      const fallbackKey = getNextKey(key);
      if (fallbackKey === key) return [];
      try {
        const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
          params: { api_key: fallbackKey, query, country_code: 'in', tld: 'in', page },
          timeout: 25000,
        });
        const products: any[] = data?.results || data?.organic_results || [];
        function mapAmazonProduct2(p: any, i: number): SearchProduct {
          const price = typeof p.price === 'number' ? p.price : parsePrice(p.price || p.sale_price || '0');
          const orig = typeof p.original_price === 'number' ? p.original_price : parsePrice(p.original_price || p.list_price || '0');
          const imageUrl = (p.image || p.thumbnail || '') as string;
          return {
            id: `az_p${page}_${p.asin || i}`,
            title: cleanText(p.name || p.title || ''),
            price,
            originalPrice: orig > price ? orig : undefined,
            discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
            imageUrl: imageUrl.startsWith('https://') ? imageUrl : '',
            platform: 'Amazon India',
            url: p.asin ? `https://www.amazon.in/dp/${p.asin}` : `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
            brand: p.brand || undefined,
            rating: p.stars ? parseFloat(p.stars) : undefined,
          };
        }
        return products.map(mapAmazonProduct2).filter((p: any) => isValidProduct(p));
      } catch { return []; }
    }
    return [];
  }
}

// ─── Flipkart via render:false (1 credit) ───────────────────────────────────────────────────
// __INITIAL_STATE__ is embedded in raw HTML — no render needed, saves credits.
// Image URLs use {@ width}/{@height} template — replace with fixed 300x400.
// Pricing: SPECIAL_PRICE = final price, FSP (strikeOff:true) = MRP.

async function fetchFlipkart(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEYS.length) return [];
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: getNextRoundRobinKey(),
        url: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`,
        render: false,
        country_code: 'in',
      },
      timeout: 20000,
    });
    if (typeof html !== 'string') return [];

    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/i);
    if (!jsonMatch) return [];

    const state = JSON.parse(jsonMatch[1]);
    const pageData = state?.pageDataV4?.page?.data || {};
    const slots: any[] = Object.values(pageData).flat() as any[];
    const products: any[] = [];
    for (const slot of slots) {
      const p = (slot as any)?.widget?.data?.products;
      if (Array.isArray(p)) products.push(...p);
    }
    if (!products.length) return [];

    return products.slice(0, 20).map((p: any, i: number) => {
      const info = p.productInfo?.value || p;
      const prices: any[] = info.pricing?.prices || [];
      const mrpEntry  = prices.find((x: any) => x.strikeOff === true);
      const spEntry   = prices.find((x: any) => x.priceType === 'SPECIAL_PRICE');
      const mrp   = mrpEntry?.value || 0;
      const price = spEntry?.value || mrpEntry?.value || 0;
      const disc  = info.pricing?.totalDiscount || 0;
      // Fix template image URL — replace placeholders with real dimensions
      const rawImg = info.media?.images?.[0]?.url || '';
      const imageUrl = rawImg
        .replace('{@width}', '300')
        .replace('{@height}', '400')
        .replace('{@quality}', '70')
        .replace(/^http:/, 'https:');
      return {
        id: `fk_${info.id || i}`,
        title: cleanText(info.titles?.title || info.titles?.newTitle || ''),
        brand: info.titles?.superTitle || undefined,
        price,
        originalPrice: mrp > price ? mrp : undefined,
        discount: disc > 0 ? disc : undefined,
        imageUrl,
        platform: 'Flipkart',
        url: info.baseUrl ? `https://www.flipkart.com${info.baseUrl}` : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
      };
    }).filter(p => isValidProduct(p));
  } catch { return []; }
}

// ─── Myntra via render:true ───────────────────────────────────────────────────
// Myntra category URLs: myntra.com/jeans, myntra.com/nike-shoes etc.
// Price/brand queries like "jeans under 500" or "levis jeans" don't work as slugs
// — fall back to myntra.com/search?q= for those.

function buildMyntraUrl(query: string): string {
  const q = query.toLowerCase().trim();
  // Price intent queries — use search
  if (/under\s*\d+|below\s*\d+|\d+\s*to\s*\d+/.test(q)) {
    return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  }
  // Single known-bad slugs that redirect to homepage — use search
  const BAD_SLUGS = new Set(['kurti', 'jean', 'kurtas', 'jeans under']);
  if (BAD_SLUGS.has(q)) {
    return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  }
  // Brand + product queries with 2+ words where first word is a brand
  // e.g. "levis jeans", "zara dress" — use search
  const BRANDS = new Set(['levis', 'zara', 'h&m', 'hm', 'puma', 'adidas', 'reebok', 'gap', 'mango', 'only', 'vero', 'forever']);
  const words = q.split(' ');
  if (words.length >= 2 && BRANDS.has(words[0])) {
    return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  }
  // Default: category slug
  return `https://www.myntra.com/${q.replace(/\s+/g, '-')}`;
}

async function fetchMyntra(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEYS.length) return [];
  try {
    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: getNextRoundRobinKey(),
        url: buildMyntraUrl(query),
        render: true,
        country_code: 'in',
      },
      timeout: 65000,
    });
    if (typeof html !== 'string') return [];

    // Extract individual product fields via targeted regex
    // Each product has: productId, brand, product/productName, mrp, discount (amount), searchImage, url slug
    const ids     = [...html.matchAll(/"productId"\s*:\s*(\d+)/g)].map(m => m[1]);
    const names   = [...html.matchAll(/"productName"\s*:\s*"([^"]+)"/g)].map(m => cleanText(m[1]));
    const brands  = [...html.matchAll(/"brand"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
    const mrps    = [...html.matchAll(/"mrp"\s*:\s*(\d+)/g)].map(m => parseInt(m[1]));
    const discAmt = [...html.matchAll(/"discount"\s*:\s*(\d+)/g)].map(m => parseInt(m[1]));
    const images  = [...html.matchAll(/"searchImage"\s*:\s*"((?:http|https):[^"]+)"/g)]
                    .map(m => m[1].replace(/\\u002F/g, '/').replace(/^http:/, 'https:'));
    const slugs   = [...html.matchAll(/"pdpUrl"\s*:\s*"([^"]+)"/g)]
                    .map(m => m[1].replace(/\\u002F/g, '/'));

    const count = Math.min(ids.length, names.length, mrps.length, images.length, 40);
    if (count === 0) return [];

    return Array.from({ length: count }, (_, i) => {
      const mrp = mrps[i] || 0;
      const disc = discAmt[i] || 0;
      const price = mrp - disc;
      const discPct = mrp > 0 && disc > 0 ? Math.round((disc / mrp) * 100) : undefined;
      return {
        id: `mn_${ids[i] || i}`,
        title: `${brands[i] || ''} ${names[i] || ''}`.trim(),
        brand: brands[i] || undefined,
        price,
        originalPrice: disc > 0 ? mrp : undefined,
        discount: discPct,
        imageUrl: (images[i] || '').replace(/^http:///, 'https://'),
        platform: 'Myntra',
        url: slugs[i] ? `https://www.myntra.com${slugs[i]}` : `https://www.myntra.com/${encodeURIComponent(query)}`,
      };
    }).filter(p => isValidProduct(p));
  } catch { return []; }
}

// ─── Google Shopping — catches Ajio + any platform Google indexes ────────────
// Costs 5 credits. Returns base64 thumbnails (not real URLs) so imageUrl is
// set to empty and filtered by isValidProduct — we relax the image check here.
// Links go through Google proxy — we extract the real retailer URL from the docid/link.
// Skips Amazon/Flipkart/Myntra since we already fetch those directly.

const GOOGLE_SKIP_PLATFORMS = new Set(['amazon.in', 'flipkart', 'myntra']);

function normalizePlatformName(source: string): string {
  const s = source.toLowerCase();
  if (s.includes('ajio')) return 'Ajio';
  if (s.includes('meesho')) return 'Meesho';
  if (s.includes('nykaa')) return 'Nykaa';
  if (s.includes('tatacliq') || s.includes('tata cliq')) return 'TataCliq';
  if (s.includes('westside')) return 'Westside';
  if (s.includes('libas')) return 'Libas';
  return source;
}

// Extract real retailer URL from ScraperAPI Google Shopping proxy link
function extractGoogleShoppingUrl(proxyLink: string): string {
  try {
    const u = new URL(proxyLink);
    const target = u.searchParams.get('url');
    if (target) return decodeURIComponent(target);
  } catch {}
  return proxyLink;
}

async function fetchGoogleShopping(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEYS.length) return [];
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/google/shopping', {
      params: { api_key: getNextRoundRobinKey(), query, country_code: 'in', tld: 'co.in' },
      timeout: 45000,
    });

    const results: any[] = data?.shopping_results || [];
    if (!results.length) return [];

    return results
      .filter(r => {
        const s = (r.source || '').toLowerCase();
        return !Array.from(GOOGLE_SKIP_PLATFORMS).some(p => s.includes(p));
      })
      .slice(0, 20)
      .map((r, i): SearchProduct => {
        const price = parsePrice(r.price || '0');
        const imageUrl = typeof r.thumbnail === 'string' && r.thumbnail.startsWith('https://')
          ? r.thumbnail
          : typeof r.thumbnail === 'string' && r.thumbnail.startsWith('data:')
          ? r.thumbnail  // base64 — valid as img src
          : '';
        const platform = normalizePlatformName(r.source || '');
        return {
          id: `gs_${i}_${r.docid || i}`,
          title: cleanText(r.title || ''),
          price,
          imageUrl,
          platform,
          url: extractGoogleShoppingUrl(r.link || ''),
        };
      })
      .filter(p => p.price > 100 && p.title.length >= 8 && p.title.includes(' ') && p.url);
  } catch { return []; }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchProducts(query: string): Promise<SearchProduct[]> {
  const cacheKey = normalizeQuery(query);
  const searchTerm = query.toLowerCase().trim(); // use original for actual search

  const mem = getMemCached(cacheKey);
  if (mem) return mem;

  const db = await getDbCached(cacheKey);
  if (db) { setMemCache(cacheKey, db); return db; }

  // All fetchers run in parallel — Google Shopping covers Ajio + others
  const [az1, fk, mn, gs] = await Promise.all([
    fetchAmazonPage(searchTerm, 1).catch(() => []),
    fetchFlipkart(searchTerm).catch(() => []),
    fetchMyntra(searchTerm).catch(() => []),
    fetchGoogleShopping(searchTerm).catch(() => []),
  ]);

  const [az2result] = await Promise.allSettled([
    az1.length < 10 ? fetchAmazonPage(searchTerm, 2) : Promise.resolve([] as SearchProduct[]),
  ]);

  const amazonResults = [
    ...az1,
    ...(az2result.status === 'fulfilled' ? az2result.value : []),
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
    ...fk,
    ...mn,
    ...gs,
  ]
    .filter(p => isValidProduct(p))
    .sort((a, b) => a.price - b.price);

  const withAffiliate = allResults.map(p => ({
    ...p,
    affiliateUrl: buildAffiliateUrl(p.platform, p.url),
  }));

  setMemCache(cacheKey, withAffiliate);
  setDbCache(cacheKey, withAffiliate);

  return withAffiliate;
}

const TRENDING_QUERIES = ['kurta sets women', 'sneakers men india', 'sarees silk', 'watches men under 5000'];

export async function getTrending(): Promise<SearchProduct[]> {
  const cacheKey = 'trending';
  const mem = getMemCached(cacheKey);
  if (mem) return mem;
  const db = await getDbCached(cacheKey);
  if (db) { setMemCache(cacheKey, db); return db; }

  const all = (await Promise.all(TRENDING_QUERIES.map(q => searchProducts(q).catch(() => [])))).flat();
  const seen = new Set<string>();
  const unique = all.filter(p => {
    const k = p.title.toLowerCase().slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 24);

  setMemCache(cacheKey, unique);
  setDbCache(cacheKey, unique);
  return unique;
}
