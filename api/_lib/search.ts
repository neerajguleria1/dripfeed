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
const memCache = new Map<string, { data: SearchProduct[]; ts: number }>();
const MEM_TTL   = 2 * 60 * 60 * 1000;
const DB_TTL_MS = 6 * 60 * 60 * 1000;

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
  } catch { /* non-fatal */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(t: string | number): number {
  if (typeof t === 'number') return Math.round(t);
  // Handle European thousands separator: "1.260 ₹" → 1260, "1,260 ₹" → 1260
  const s = String(t).replace(/[₹\s]/g, '').trim();
  // If dot is thousands separator (e.g. "1.260" or "12.592") — no decimal part or >2 decimal digits
  const dotIdx = s.lastIndexOf('.');
  const commaIdx = s.lastIndexOf(',');
  let normalized = s;
  if (dotIdx > 0 && commaIdx < 0) {
    const afterDot = s.slice(dotIdx + 1);
    // If 3 digits after dot → thousands separator, not decimal
    if (afterDot.length === 3) normalized = s.replace(/\./g, '');
    // If 1-2 digits after dot → decimal (e.g. "490.50")
    else normalized = s.replace(/,/g, '');
  } else {
    normalized = s.replace(/,/g, ''); // remove comma thousands separators
  }
  const m = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

function cleanText(t: string): string {
  return t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

// ─── Product quality validator ────────────────────────────────────────────────
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

// ─── Query normalizer ─────────────────────────────────────────────────────────
function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

// ─── ScraperAPI keys ──────────────────────────────────────────────────────────
const SCRAPER_KEYS = [
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

let rrIndex = 0;
function getNextRoundRobinKey(): string {
  if (!SCRAPER_KEYS.length) return '';
  const key = SCRAPER_KEYS[rrIndex % SCRAPER_KEYS.length];
  rrIndex = (rrIndex + 1) % SCRAPER_KEYS.length;
  return key;
}
function getNextKey(currentKey: string): string {
  const idx = SCRAPER_KEYS.indexOf(currentKey);
  return SCRAPER_KEYS[(idx + 1) % SCRAPER_KEYS.length] || currentKey;
}

// ─── Amazon ───────────────────────────────────────────────────────────────────
// Research findings:
//   - price: number (always, no parsing needed)
//   - original_price: { price, price_string, price_symbol } — NOT a number/string
//   - image: https:// URL (always valid)
//   - asin: always present
//   - brand: sometimes missing

function mapAmazonProduct(p: any, page: number, i: number, query: string): SearchProduct {
  const price = typeof p.price === 'number' ? p.price : parsePrice(p.price || '0');
  // original_price is an object: { price: number, price_string: "₹3,999", price_symbol: "₹" }
  const orig = typeof p.original_price === 'object' && p.original_price !== null
    ? (p.original_price.price || 0)
    : typeof p.original_price === 'number'
    ? p.original_price
    : parsePrice(p.original_price || '0');
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

async function fetchAmazonPage(query: string, page = 1): Promise<SearchProduct[]> {
  if (!SCRAPER_KEYS.length) { console.error('[Amazon] No API keys'); return []; }
  const key = getNextRoundRobinKey();
  const params = { api_key: key, query, country_code: 'in', tld: 'in', page };
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params, timeout: 20000,
    });
    const products: any[] = data?.results || data?.organic_results || [];
    console.log(`[Amazon] ${products.length} raw results`);
    return products.map((p, i) => mapAmazonProduct(p, page, i, query)).filter(p => isValidProduct(p));
  } catch (e: any) {
    console.error('[Amazon] error:', e?.response?.status, e?.message?.slice(0, 100));
    if (e?.response?.status === 429) {
      const fallbackKey = getNextKey(key);
      if (fallbackKey === key) return [];
      try {
        const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
          params: { ...params, api_key: fallbackKey }, timeout: 20000,
        });
        const products: any[] = data?.results || data?.organic_results || [];
        return products.map((p, i) => mapAmazonProduct(p, page, i, query)).filter((p: any) => isValidProduct(p));
      } catch { return []; }
    }
    return [];
  }
}

// ─── Flipkart ─────────────────────────────────────────────────────────────────
// Research findings:
//   - __INITIAL_STATE__ in raw HTML (render:false works, saves credits)
//   - ALL image URLs are http:// templates: "http://rukmini1.flixcart.com/image/{@width}/{@height}/..."
//   - Replace {@ placeholders AND http→https
//   - pricing.prices: FSP (strikeOff:true) = MRP, SPECIAL_PRICE = final price
//   - pricing.totalDiscount = discount % (not amount)
//   - All 40 products have price > 0

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
      timeout: 15000,
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
      // ALL Flipkart images are http:// templates — replace placeholders AND fix protocol
      const rawImg = info.media?.images?.[0]?.url || '';
      const imageUrl = rawImg
        .replace('{@width}', '300')
        .replace('{@height}', '400')
        .replace('{@quality}', '70')
        .replace(/^http:\/\//, 'https://');
      return {
        id: `fk_${info.id || i}`,
        title: cleanText(info.titles?.title || info.titles?.newTitle || ''),
        brand: info.titles?.superTitle || undefined,
        price,
        originalPrice: mrp > price ? mrp : undefined,
        discount: disc > 0 ? disc : undefined,
        imageUrl,
        platform: 'Flipkart',
        url: info.baseUrl
          ? `https://www.flipkart.com${info.baseUrl}`
          : `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
      };
    }).filter(p => isValidProduct(p));
  } catch(e: any) { console.error('[Flipkart] error:', e?.response?.status, e?.message?.slice(0,100)); return []; }
}

// ─── Myntra (session-based, 0 credits) ──────────────────────────────────────
// Bypass: hit homepage first to get session cookies, then call search API
// Works because Myntra checks for valid session cookies, not IP

let myntraSessionCookies = '';
let myntraCookieTs = 0;
const MYNTRA_COOKIE_TTL = 25 * 60 * 1000; // 25 min

async function getMyntraSession(): Promise<string> {
  if (myntraSessionCookies && Date.now() - myntraCookieTs < MYNTRA_COOKIE_TTL) {
    return myntraSessionCookies;
  }
  try {
    const resp = await axios.get('https://www.myntra.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: 10000,
      maxRedirects: 5,
    });
    const raw: string[] = (resp.headers['set-cookie'] as string[]) || [];
    myntraSessionCookies = raw.map((c: string) => c.split(';')[0]).join('; ');
    myntraCookieTs = Date.now();
    return myntraSessionCookies;
  } catch { return ''; }
}

async function fetchMyntra(query: string): Promise<SearchProduct[]> {
  try {
    const cookies = await getMyntraSession();
    if (!cookies) return [];
    const { data } = await axios.get(
      `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(query)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-IN,en;q=0.9',
          'Referer': 'https://www.myntra.com/',
          'Cookie': cookies,
          'x-myntraweb': 'Yes',
          'x-location-code': 'MH',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
        },
        timeout: 15000,
      }
    );
    const products: any[] = data?.products || [];
    return products.map((p: any) => {
      const price = p.price || 0;
      const mrp = p.mrp || 0;
      const discPct = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : undefined;
      const imageUrl = (p.searchImage || '').replace(/^http:\/\//, 'https://');
      return {
        id: `mn_${p.productId}`,
        title: cleanText(`${p.brand || ''} ${p.productName || p.product || ''}`.trim()),
        brand: p.brand || undefined,
        price,
        originalPrice: mrp > price ? mrp : undefined,
        discount: discPct,
        imageUrl,
        platform: 'Myntra',
        url: p.landingPageUrl ? `https://www.myntra.com/${p.landingPageUrl}` : `https://www.myntra.com/search?q=${encodeURIComponent(query)}`,
        rating: p.rating || undefined,
      };
    }).filter(p => isValidProduct(p));
  } catch(e: any) { console.error('[Myntra] error:', e?.response?.status, e?.message?.slice(0,100)); return []; }
}



// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchProducts(query: string): Promise<SearchProduct[]> {
  const cacheKey = normalizeQuery(query);
  const searchTerm = query.toLowerCase().trim();
  console.log(`[search] keys=${SCRAPER_KEYS.length} key0=${SCRAPER_KEYS[0]?.slice(0,8)}... query=${searchTerm}`);

  const mem = getMemCached(cacheKey);
  if (mem) return mem;

  const db = await getDbCached(cacheKey);
  if (db) { setMemCache(cacheKey, db); return db; }

  const [az1, fk, mn] = await Promise.all([
    fetchAmazonPage(searchTerm, 1).catch(() => []),
    fetchFlipkart(searchTerm).catch(() => []),
    fetchMyntra(searchTerm).catch(() => []),
  ]);

  // Deduplicate Amazon by ASIN
  const seenAsins = new Set<string>();
  const dedupedAmazon = az1.filter(p => {
    const asin = p.url.split('/dp/')[1]?.split('?')[0];
    if (!asin || seenAsins.has(asin)) return false;
    seenAsins.add(asin);
    return true;
  });

  const allResults = [...dedupedAmazon, ...fk, ...mn]
    .filter(p => isValidProduct(p))
    .sort((a, b) => a.price - b.price);

  const withAffiliate = allResults.map(p => ({
    ...p,
    affiliateUrl: buildAffiliateUrl(p.platform, p.url),
  }));

  if (!withAffiliate.length) return withAffiliate; // don't cache empty results

  setMemCache(cacheKey, withAffiliate);
  setDbCache(cacheKey, withAffiliate);

  return withAffiliate;
}

// ─── Related queries map ──────────────────────────────────────────────────────
// Maps a search intent to related product queries for "Complete the Look"
const RELATED_QUERIES: Record<string, { label: string; queries: string[] }> = {
  // Footwear
  shoes:          { label: 'Complete the Look', queries: ['socks', 'belt men', 'jeans men'] },
  sneakers:       { label: 'Complete the Look', queries: ['socks', 'track pants', 'cap men'] },
  'sports shoes': { label: 'Complete the Look', queries: ['track pants', 'sports bra', 'gym bag'] },
  heels:          { label: 'Complete the Look', queries: ['dress women', 'handbag women', 'earrings'] },
  sandals:        { label: 'Complete the Look', queries: ['shorts women', 'sunglasses women', 'handbag women'] },
  // Tops
  'tshirt men':   { label: 'Complete the Look', queries: ['jeans men', 'sneakers', 'cap men'] },
  'shirt men':    { label: 'Complete the Look', queries: ['trousers men', 'belt men', 'formal shoes'] },
  'kurta men':    { label: 'Complete the Look', queries: ['churidar men', 'mojari', 'watch men'] },
  'kurti women':  { label: 'Complete the Look', queries: ['leggings women', 'juttis', 'dupatta'] },
  'top women':    { label: 'Complete the Look', queries: ['jeans women', 'sneakers', 'handbag women'] },
  'crop top':     { label: 'Complete the Look', queries: ['high waist jeans', 'sneakers', 'sunglasses women'] },
  // Bottoms
  'jeans men':    { label: 'Complete the Look', queries: ['shirt men', 'sneakers', 'belt men'] },
  'jeans women':  { label: 'Complete the Look', queries: ['top women', 'sneakers', 'handbag women'] },
  'trousers men': { label: 'Complete the Look', queries: ['formal shirt', 'formal shoes', 'belt men'] },
  'leggings women': { label: 'Complete the Look', queries: ['kurti women', 'juttis', 'dupatta'] },
  // Ethnic
  saree:          { label: 'Complete the Look', queries: ['blouse women', 'heels', 'clutch bag'] },
  lehenga:        { label: 'Complete the Look', queries: ['heels', 'clutch bag', 'earrings'] },
  'salwar suit':  { label: 'Complete the Look', queries: ['dupatta', 'juttis', 'earrings'] },
  'kurta set women': { label: 'Complete the Look', queries: ['juttis', 'dupatta', 'earrings'] },
  sherwani:       { label: 'Complete the Look', queries: ['mojari', 'watch men', 'pocket square'] },
  // Outerwear
  'jacket men':   { label: 'Complete the Look', queries: ['jeans men', 'sneakers', 'tshirt men'] },
  'jacket women': { label: 'Complete the Look', queries: ['jeans women', 'sneakers', 'handbag women'] },
  'hoodie men':   { label: 'Complete the Look', queries: ['joggers', 'sneakers', 'cap men'] },
  // Sports / Gym
  gym:            { label: 'Complete the Look', queries: ['track pants', 'sports shoes', 'gym bag'] },
  'gym wear men': { label: 'Complete the Look', queries: ['sports shoes', 'gym bag', 'socks'] },
  'gym wear women': { label: 'Complete the Look', queries: ['sports shoes', 'sports bra', 'gym bag'] },
  'track pants':  { label: 'Complete the Look', queries: ['sports shoes', 'tshirt men', 'socks'] },
  'yoga pants':   { label: 'Complete the Look', queries: ['sports bra', 'yoga mat', 'sports shoes'] },
  // Accessories
  'watch men':    { label: 'Style with', queries: ['shirt men', 'belt men', 'wallet men'] },
  'handbag women': { label: 'Style with', queries: ['dress women', 'heels', 'sunglasses women'] },
  backpack:       { label: 'Style with', queries: ['sneakers', 'jeans men', 'cap men'] },
  // Use-case based
  wedding:        { label: 'Wedding Collection', queries: ['lehenga', 'heels', 'clutch bag', 'earrings'] },
  office:         { label: 'Office Look', queries: ['formal shirt', 'trousers men', 'formal shoes', 'belt men'] },
  casual:         { label: 'Casual Look', queries: ['jeans men', 'tshirt men', 'sneakers'] },
  beach:          { label: 'Beach Look', queries: ['shorts men', 'flip flops', 'sunglasses men'] },
  party:          { label: 'Party Look', queries: ['dress women', 'heels', 'clutch bag'] },
};

// Find related queries for a given search term
function findRelated(query: string): { label: string; queries: string[] } | null {
  const q = query.toLowerCase().trim();
  // exact match
  if (RELATED_QUERIES[q]) return RELATED_QUERIES[q];
  // partial match — check if query contains a key
  for (const [key, val] of Object.entries(RELATED_QUERIES)) {
    if (q.includes(key) || key.includes(q)) return val;
  }
  return null;
}

export async function getRelatedProducts(query: string): Promise<{ label: string; sections: { query: string; products: SearchProduct[] }[] }> {
  const related = findRelated(query);
  if (!related) return { label: 'You may also like', sections: [] };

  // Fetch all related queries in parallel — they'll hit cache if already searched
  const sections = await Promise.all(
    related.queries.slice(0, 3).map(async (q) => {
      const products = await searchProducts(q).catch(() => []);
      return { query: q, products: products.slice(0, 4) };
    })
  );

  return {
    label: related.label,
    sections: sections.filter(s => s.products.length > 0),
  };
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
