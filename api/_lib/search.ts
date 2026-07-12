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
  if (!SCRAPER_KEYS.length) return [];
  const key = getNextRoundRobinKey();
  const params = { api_key: key, query, country_code: 'in', tld: 'in', page };
  try {
    const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params, timeout: 25000,
    });
    const products: any[] = data?.results || data?.organic_results || [];
    return products.map((p, i) => mapAmazonProduct(p, page, i, query)).filter(p => isValidProduct(p));
  } catch (e: any) {
    if (e?.response?.status === 429) {
      const fallbackKey = getNextKey(key);
      if (fallbackKey === key) return [];
      try {
        const { data } = await axios.get('https://api.scraperapi.com/structured/amazon/search', {
          params: { ...params, api_key: fallbackKey }, timeout: 25000,
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
  } catch { return []; }
}

// ─── Myntra ───────────────────────────────────────────────────────────────────
// Research findings:
//   - Data is in window.__myx.searchData.results.products[]
//   - Products are deeply nested (brace depth 4) — self-contained block regex FAILS
//   - Must extract products array using balanced-brace parser
//   - Product fields: productId, productName, brand, mrp, discount (AMOUNT not %), price (final price!),
//     searchImage (http://assets.myntassets.com/...), landingPageUrl
//   - ALL images are http:// — must convert to https://
//   - Use p.price directly (Myntra provides final price, no need to compute mrp-discount)
//   - 500 errors on: sarees, jeans, dresses — use search?q= for those

const SLUG_MAP: Record<string, string> = {
  saree: 'sarees', kurta: 'kurtas', jean: 'jeans', trouser: 'trousers',
  legging: 'leggings', dress: 'dresses', skirt: 'skirts', top: 'tops',
  shoe: 'shoes', sandal: 'sandals', sneaker: 'sneakers', boot: 'boots',
  jacket: 'jackets', blazer: 'blazers', hoodie: 'hoodies', shirt: 'shirts',
  pant: 'pants', short: 'shorts', suit: 'suits', coat: 'coats',
  bag: 'bags', watch: 'watches', sari: 'sarees',
};

// Slugs that return 500 on Myntra — must use search?q= instead
const MYNTRA_500_SLUGS = new Set([
  'sarees', 'jeans', 'dresses', 'leggings', 'skirts', 'tops', 'shoes',
  'blazers', 'hoodies', 'pants', 'shorts', 'suits', 'coats', 'bags', 'watches',
  // additional confirmed 500s
  'heels', 'lehenga', 'lehnga', 'kurta-men', 'kurti-women', 'tops-women',
  'kurtas', 'kurtis',
]);

function buildMyntraUrl(query: string): string {
  const q = query.toLowerCase().trim();
  // Price intent queries
  if (/under\s*\d+|below\s*\d+|\d+\s*to\s*\d+/.test(q)) {
    return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  }
  // Known bad single-word slugs
  const BAD_SLUGS = new Set(['kurti', 'jean', 'kurtas', 'ladies', 'gents', 'women', 'men']);
  if (BAD_SLUGS.has(q)) {
    return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  }
  // Brand queries — some brands work on search, some 500. Use search for all brand queries.
  const BRANDS = new Set(['levis', 'zara', 'h&m', 'hm', 'puma', 'adidas', 'reebok', 'gap', 'mango', 'only', 'vero', 'forever', 'nike', 'bata', 'woodland', 'fastrack']);
  const words = q.split(' ');
  if (BRANDS.has(words[0])) {
    // Try brand slug first only for single-word brand queries, else search
    if (words.length >= 2) return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  }
  // Apply singular→plural correction
  const corrected = SLUG_MAP[q] || q.replace(/\s+/g, '-');
  // If the corrected slug is known to 500, use search
  if (MYNTRA_500_SLUGS.has(corrected)) {
    return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  }
  // Multi-word slugs with known-bad patterns
  if (/^(kurta|kurti|tops?)-/.test(corrected)) {
    return `https://www.myntra.com/search?q=${encodeURIComponent(q)}`;
  }
  return `https://www.myntra.com/${corrected}`;
}

// Extract individual product objects from Myntra's deeply-nested JSON
// using a balanced-brace parser anchored on "products":[{
function extractMyntraProducts(html: string): any[] {
  // Find the products array — it's inside window.__myx.searchData.results
  const startMarker = '"products":[{';
  const startIdx = html.indexOf(startMarker);
  if (startIdx < 0) return [];

  const arrayStart = startIdx + '"products":'.length;
  const objects: any[] = [];
  let i = arrayStart;

  // Skip the opening [
  while (i < html.length && html[i] !== '[') i++;
  i++; // skip [

  while (i < html.length) {
    if (html[i] === '{') {
      // Extract balanced object
      let depth = 0;
      const objStart = i;
      while (i < html.length) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}') {
          depth--;
          if (depth === 0) {
            try {
              objects.push(JSON.parse(html.slice(objStart, i + 1)));
            } catch { /* skip malformed */ }
            i++;
            break;
          }
        }
        i++;
      }
    } else if (html[i] === ']') {
      break; // end of products array
    } else {
      i++;
    }
  }
  return objects;
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

    const products = extractMyntraProducts(html);
    if (!products.length) return [];

    return products.slice(0, 40).map((p: any) => {
      // p.price = final selling price (Myntra provides this directly)
      // p.mrp = original price
      // p.discount = discount AMOUNT (not %)
      const price = p.price || 0;
      const mrp = p.mrp || 0;
      const discPct = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : undefined;
      // ALL Myntra images are http:// — convert to https://
      const imageUrl = (p.searchImage || '').replace(/^http:\/\//, 'https://');
      const slug = p.landingPageUrl || '';
      return {
        id: `mn_${p.productId || Math.random()}`,
        title: cleanText(`${p.brand || ''} ${p.productName || p.product || ''}`.trim()),
        brand: p.brand || undefined,
        price,
        originalPrice: mrp > price ? mrp : undefined,
        discount: discPct,
        imageUrl,
        platform: 'Myntra',
        url: slug ? `https://www.myntra.com/${slug}` : `https://www.myntra.com/search?q=${encodeURIComponent(query)}`,
        rating: p.rating || undefined,
      };
    }).filter(p => isValidProduct(p));
  } catch { return []; }
}

// ─── Google Shopping ──────────────────────────────────────────────────────────
// Research findings:
//   - price field uses European format: "1.260 ₹" = ₹1260, "360 ₹" = ₹360
//   - extracted_price divides by 100 (bug in ScraperAPI): 12.6 for ₹1260
//   - CORRECT approach: use parsePrice(r.price) with dot-as-thousands fix
//   - link = Google catalog URL (not retailer URL) — no product_link/merchant_link field
//   - thumbnail: mix of https:// (20) and data:base64 (20) — both valid
//   - Sources include: Ajio, Myntra, Amazon, Libas, Soch, Westside, Manyavar, Koskii etc.

const GOOGLE_SKIP_PLATFORMS = new Set(['amazon.in', 'flipkart', 'myntra']);

function normalizePlatformName(source: string): string {
  const s = source.toLowerCase();
  if (s.includes('ajio')) return 'Ajio';
  if (s.includes('meesho')) return 'Meesho';
  if (s.includes('nykaa')) return 'Nykaa';
  if (s.includes('tatacliq') || s.includes('tata cliq')) return 'TataCliq';
  if (s.includes('westside')) return 'Westside';
  if (s.includes('libas')) return 'Libas';
  if (s.includes('manyavar')) return 'Manyavar';
  if (s.includes('soch')) return 'Soch';
  if (s.includes('koskii')) return 'Koskii';
  if (s.includes('jaypore')) return 'Jaypore';
  if (s.includes('biba')) return 'Biba';
  if (s.includes('w for woman') || s === 'w') return 'W';
  return source;
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
        // Use parsePrice on the raw price string — our fixed parsePrice handles
        // European dot-as-thousands: "1.260 ₹" → 1260, "360 ₹" → 360
        const price = parsePrice(r.price || '0');
        const imageUrl = typeof r.thumbnail === 'string' && r.thumbnail.startsWith('https://')
          ? r.thumbnail
          : typeof r.thumbnail === 'string' && r.thumbnail.startsWith('data:')
          ? r.thumbnail
          : '';
        const platform = normalizePlatformName(r.source || '');
        return {
          id: `gs_${i}_${r.docid || i}`,
          title: cleanText(r.title || ''),
          price,
          imageUrl,
          platform,
          // link is a Google catalog URL — best we have without a second API call
          url: r.link || '',
        };
      })
      // Filter: price must be > 100 (real fashion item), title must be descriptive
      .filter(p => p.price > 100 && p.title.length >= 8 && p.url);
  } catch { return []; }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchProducts(query: string): Promise<SearchProduct[]> {
  const cacheKey = normalizeQuery(query);
  const searchTerm = query.toLowerCase().trim();

  const mem = getMemCached(cacheKey);
  if (mem) return mem;

  const db = await getDbCached(cacheKey);
  if (db) { setMemCache(cacheKey, db); return db; }

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

  const allResults = [...dedupedAmazon, ...fk, ...mn, ...gs]
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
