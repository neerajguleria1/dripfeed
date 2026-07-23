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
  // Variant info — NOT available uniformly across platforms. Populated only
  // when the platform's search API exposes it in structured form (verified
  // against live responses, not guessed):
  //   - Ajio: color reliable, size never present in search results
  //   - Flipkart: size reliable ("Size: S/M/L/XL" in titles.coSubtitle), color not structured
  //   - Amazon / Meesho: neither field available in search results
  // Leave undefined rather than guess — the UI must treat these as
  // "known for this platform" info, not a promise that applies everywhere.
  color?: string;
  size?: string;
}

// ─── ScraperAPI concurrency limiter ──────────────────────────────────────────
// Our ScraperAPI plan caps concurrent requests at 5 (concurrencyLimit=5). When
// Amazon/Flipkart/Myntra/Ajio all fire in parallel (searchProducts uses
// Promise.all), it's easy to momentarily exceed that limit — observed as
// random 403s or connection timeouts on whichever request loses the race,
// even though every platform works fine when called alone. This is a simple
// FIFO semaphore so at most MAX_CONCURRENT_SCRAPER_REQUESTS calls to
// api.scraperapi.com are ever in flight at once; everything else queues and
// runs as soon as a slot frees up, instead of racing and failing.
const MAX_CONCURRENT_SCRAPER_REQUESTS = 4; // stay one below the account's hard limit of 5
let activeScraperRequests = 0;
const scraperRequestQueue: Array<() => void> = [];

async function acquireScraperSlot(): Promise<void> {
  if (activeScraperRequests < MAX_CONCURRENT_SCRAPER_REQUESTS) {
    activeScraperRequests++;
    return;
  }
  await new Promise<void>((resolve) => scraperRequestQueue.push(resolve));
  activeScraperRequests++;
}

function releaseScraperSlot(): void {
  activeScraperRequests--;
  const next = scraperRequestQueue.shift();
  if (next) next();
}

/** Runs `fn` with an acquired ScraperAPI concurrency slot, always releasing it afterward. */
async function withScraperSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireScraperSlot();
  try {
    return await fn();
  } finally {
    releaseScraperSlot();
  }
}

// ─── Cache ────────────────────────────────────────────────────────────────────
// Platforms that only work via costly ScraperAPI tiers (premium/ultra_premium)
// get a much longer cache TTL so one expensive scrape serves many users instead
// of re-paying the credit cost every few hours.
const memCache = new Map<string, { data: SearchProduct[]; ts: number }>();
const MEM_TTL           = 2 * 60 * 60 * 1000;   // 2h — cheap platforms (Amazon/Flipkart)
const DB_TTL_MS         = 6 * 60 * 60 * 1000;   // 6h — cheap platforms
const EXPENSIVE_TTL_MS  = 24 * 60 * 60 * 1000;  // 24h — Ajio (may hit premium tier)

function getMemCached(key: string, ttl = MEM_TTL): SearchProduct[] | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) { memCache.delete(key); return null; }
  return entry.data;
}
function setMemCache(key: string, data: SearchProduct[]) {
  memCache.set(key, { data, ts: Date.now() });
}
async function getDbCached(query: string, ttl = DB_TTL_MS): Promise<SearchProduct[] | null> {
  try {
    await connectDB();
    const doc = await SearchCache.findOne({ query }).lean();
    if (!doc) return null;
    if (Date.now() - new Date(doc.cachedAt).getTime() > ttl) return null;
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

function toAbsoluteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://');
  if (url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

export function parseMeeshoProducts(html: string, query: string): SearchProduct[] {
  const root = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  const cardRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const products: SearchProduct[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = cardRe.exec(root))) {
    const href = match[1] || '';
    const inner = match[2] || '';
    if (!href || !href.includes('/p/')) continue;

    const priceMatch = inner.match(/₹\s?([0-9,]+(?:\.\d{1,2})?)/i) || inner.match(/\b([0-9,]+(?:\.\d{1,2})?)\b/);
    const price = priceMatch ? parsePrice(priceMatch[1]) : 0;
    const imgMatch = inner.match(/<img[^>]+src=["']([^"']+)["']/i);
    const imageUrl = toAbsoluteUrl(imgMatch?.[1] || '');

    // Extract only the title text, stopping before price/rating text so
    // "Adrika Refined Kurtis ₹313 4.1 Star 105 Reviews" doesn't get treated
    // as one long title — split on price marker and rating pattern first.
    const withoutImg = inner.replace(/<img[^>]*>/gi, '');
    const beforePrice = withoutImg.split(/₹\s?[0-9,]/)[0];
    const rawTitle = cleanText(beforePrice);
    const normalizedTitle = rawTitle
      .replace(/\s+/g, ' ')
      .replace(/\d+(\.\d+)?\s*star.*$/i, '')
      .replace(/^\+\d+\s*More/i, '') // strip Meesho's "+N More" color-variant badge text
      .trim();

    if (!normalizedTitle || price <= 0 || !imageUrl) continue;
    const key = `${normalizedTitle.toLowerCase()}::${price}`;
    if (seen.has(key)) continue;
    seen.add(key);

    products.push({
      id: `ms_${href}`,
      title: normalizedTitle,
      price,
      imageUrl,
      platform: 'Meesho',
      url: href.startsWith('http') ? href : `https://www.meesho.com${href.startsWith('/') ? href : `/${href}`}`,
      brand: undefined,
    });
  }

  return products
    .filter(p => isValidProduct(p))
    .filter(p => isRelevantToQuery(p, query))
    .slice(0, 20);
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

// ─── Relevance filter ─────────────────────────────────────────────────────────
// Platform search APIs sometimes return loosely-matched or unrelated products
// (e.g. searching "nail paint" occasionally surfaces a mobile case). We only
// check basic quality in isValidProduct() — this adds a real relevance check:
// require at least half of the query's significant words to appear in the
// product's title or brand before it's allowed into results.
function isRelevantToQuery(product: { title: string; brand?: string }, query: string): boolean {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
  if (queryTerms.length === 0) return true; // nothing meaningful to check against

  const haystack = `${product.title} ${product.brand || ''}`.toLowerCase();
  // Match on a shared word-prefix rather than the exact term, so spelling/
  // pluralization variants still count as relevant (e.g. query "kurta" vs.
  // title word "kurtis" — common on Meesho listings — both share "kurt").
  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  const matchCount = queryTerms.filter(t => {
    const prefixLen = Math.min(4, t.length);
    const prefix = t.slice(0, prefixLen);
    return words.some(w => w.startsWith(prefix));
  }).length;
  const requiredMatches = Math.max(1, Math.ceil(queryTerms.length / 2));
  return matchCount >= requiredMatches;
}

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

// ─── Per-platform circuit breaker ────────────────────────────────────────────
// After N consecutive failures, skip a platform for a cooldown window instead
// of burning credits retrying a site that is actively blocking every request.
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min
const platformFailures = new Map<string, { count: number; openedAt: number }>();

function isCircuitOpen(platform: string): boolean {
  const entry = platformFailures.get(platform);
  if (!entry) return false;
  if (entry.count < FAILURE_THRESHOLD) return false;
  if (Date.now() - entry.openedAt > COOLDOWN_MS) {
    platformFailures.delete(platform); // cooldown expired, allow retry
    return false;
  }
  return true;
}
function recordFailure(platform: string) {
  const entry = platformFailures.get(platform) || { count: 0, openedAt: 0 };
  entry.count += 1;
  if (entry.count === FAILURE_THRESHOLD) entry.openedAt = Date.now();
  platformFailures.set(platform, entry);
}
function recordSuccess(platform: string) {
  platformFailures.delete(platform);
}

// ─── Credit-efficient escalation ladder ──────────────────────────────────────
// Tries the cheapest ScraperAPI tier first and only pays for a costlier tier
// when the cheaper one is actually blocked (403/429/503). Tier costs:
//   plain = 1 credit | render = 10 | premium+render = 25 | ultra_premium+render = 75
type EscalationTier = 'plain' | 'render' | 'premium' | 'ultra';

interface EscalationResult {
  html: string | null;
  tier: string;
  credits: number;
}

const BLOCK_STATUS_CODES = new Set([403, 429, 503]);

async function fetchWithEscalation(
  targetUrl: string,
  platform: string,
  maxTier: EscalationTier = 'premium',
  needsRender = true, // false for JSON APIs where JS rendering is irrelevant — saves credits
  minTier: EscalationTier = 'plain', // set to 'render' for sites that never have data at the plain tier (e.g. client-rendered SPAs like Meesho)
  isSuccess?: (html: string) => boolean // custom content validator; defaults to size + block-keyword check
): Promise<EscalationResult> {
  if (!SCRAPER_KEYS.length) return { html: null, tier: 'no-keys', credits: 0 };
  if (isCircuitOpen(platform)) return { html: null, tier: 'circuit-open', credits: 0 };

  const tierOrder: EscalationTier[] = ['plain', 'render', 'premium', 'ultra'];
  const minIdx = tierOrder.indexOf(minTier);

  let tiers: { key: EscalationTier; name: string; params: Record<string, unknown>; credits: number }[] = needsRender
    ? [
        { key: 'plain', name: 'plain', params: {}, credits: 1 },
        { key: 'render', name: 'render', params: { render: true }, credits: 10 },
      ]
    : [
        { key: 'plain', name: 'plain', params: {}, credits: 1 },
      ];

  if (maxTier === 'premium' || maxTier === 'ultra') {
    tiers.push(needsRender
      ? { key: 'premium', name: 'premium+render', params: { premium: true, render: true }, credits: 25 }
      : { key: 'premium', name: 'premium', params: { premium: true }, credits: 10 });
  }
  if (maxTier === 'ultra') {
    tiers.push(needsRender
      ? { key: 'ultra', name: 'ultra_premium+render', params: { ultra_premium: true, render: true }, credits: 75 }
      : { key: 'ultra', name: 'ultra_premium', params: { ultra_premium: true }, credits: 30 });
  }

  // Skip tiers below the platform's known minimum (e.g. Meesho never has data
  // at 'plain', so don't waste a request confirming that every time).
  tiers = tiers.filter(t => tierOrder.indexOf(t.key) >= minIdx);

  const defaultValidator = (data: string) => {
    const looksBlocked = /access denied|captcha|are you a human|blocked/i.test(data.slice(0, 800));
    return data.length > 2000 && !looksBlocked;
  };
  const validate = isSuccess || defaultValidator;

  for (const tier of tiers) {
    try {
      const { data } = await withScraperSlot(() => axios.get('https://api.scraperapi.com/', {
        params: {
          api_key: getNextRoundRobinKey(),
          url: targetUrl,
          country_code: 'in',
          ...tier.params,
        },
        timeout: tier.params.render ? 40000 : 15000,
        transformResponse: [(res) => res], // keep raw string even for JSON content-type responses
      }));
      const text = typeof data === 'string' ? data : String(data);
      if (validate(text)) {
        recordSuccess(platform);
        return { html: text, tier: tier.name, credits: tier.credits };
      }
      // Response didn't pass content validation — escalate to next tier.
    } catch (e: any) {
      const status = e?.response?.status;
      const isTimeout = e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message || '');
      if (!isTimeout && !BLOCK_STATUS_CODES.has(status)) {
        // Non-bot-related, non-timeout error (e.g. DNS, network) — no point escalating tiers.
        break;
      }
      // Bot-block status or timeout — try the next, more expensive/patient tier.
    }
  }
  recordFailure(platform);
  return { html: null, tier: 'failed', credits: 0 };
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
    const { data } = await withScraperSlot(() => axios.get('https://api.scraperapi.com/structured/amazon/search', {
      params, timeout: 20000,
    }));
    const products: any[] = data?.results || data?.organic_results || [];
    console.log(`[Amazon] ${products.length} raw results`);
    return products.map((p, i) => mapAmazonProduct(p, page, i, query)).filter(p => isValidProduct(p));
  } catch (e: any) {
    console.error('[Amazon] error:', e?.response?.status, e?.message?.slice(0, 100));
    if (e?.response?.status === 429) {
      const fallbackKey = getNextKey(key);
      if (fallbackKey === key) return [];
      try {
        const { data } = await withScraperSlot(() => axios.get('https://api.scraperapi.com/structured/amazon/search', {
          params: { ...params, api_key: fallbackKey }, timeout: 20000,
        }));
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
    const { data: html } = await withScraperSlot(() => axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: getNextRoundRobinKey(),
        url: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`,
        render: false,
        country_code: 'in',
      },
      timeout: 15000,
    }));
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
      // coSubtitle is formatted "Size: S" / "Size: XL" etc. on apparel listings —
      // only present for sized products, so guard with the "Size:" prefix check.
      const coSubtitle: string = info.titles?.coSubtitle || '';
      const sizeMatch = coSubtitle.match(/^Size:\s*(.+)$/i);
      const size = sizeMatch ? sizeMatch[1].trim() : undefined;
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
        size,
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

// Pre-warm: fetch cookies immediately on module load so the first search
// doesn't pay the ~5s homepage round-trip cost. Refresh every 20 min.
function scheduleMyntraWarmup() {
  getMyntraSession().catch(() => {});
  setInterval(() => getMyntraSession().catch(() => {}), 20 * 60 * 1000);
}
scheduleMyntraWarmup();

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

function mapMyntraProduct(p: any): SearchProduct {
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
    url: p.landingPageUrl ? `https://www.myntra.com/${p.landingPageUrl}` : `https://www.myntra.com/search?q=${encodeURIComponent(p.query || '')}`,
    rating: p.rating || undefined,
  };
}

// Step 1 — free direct call (0 credits) using bootstrapped session cookies.
// Works when the request originates from a non-flagged (residential) IP.
async function fetchMyntraDirect(query: string): Promise<SearchProduct[] | null> {
  try {
    const cookies = await getMyntraSession();
    if (!cookies) return null;
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
        timeout: 10000,
      }
    );
    const products: any[] = data?.products || [];
    if (!products.length) return null; // treat empty as failure, not success
    return products.map(p => mapMyntraProduct({ ...p, query })).filter(p => isValidProduct(p));
  } catch { return null; } // silent — this path is expected to fail on cloud IPs
}

// Step 2 — ScraperAPI escalation ladder (costs credits). Only runs if the
// free direct call above failed. JSON endpoint, so JS rendering isn't needed.
async function fetchMyntraViaScraperApi(query: string): Promise<SearchProduct[]> {
  const targetUrl = `https://www.myntra.com/gateway/v2/search/${encodeURIComponent(query)}?p=1&rows=20&o=0&plaEnabled=false&sort=price_asc`;
  const { html, tier, credits } = await fetchWithEscalation(targetUrl, 'myntra', 'premium', false);
  console.log(`[Myntra] ScraperAPI tier=${tier} credits=${credits}`);
  if (!html) return [];
  try {
    const data = JSON.parse(html);
    const products: any[] = data?.products || [];
    return products.map(p => mapMyntraProduct({ ...p, query })).filter(p => isValidProduct(p));
  } catch { return []; }
}

async function fetchMyntra(query: string): Promise<SearchProduct[]> {
  try {
    const encoded = encodeURIComponent(query);
    const { data: html } = await axios.get(`https://www.myntra.com/${encoded}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: 15000,
      transformResponse: [(d) => d],
    });

    if (typeof html !== 'string') return [];

    // Extract window.__myx JSON using brace-counting parser
    const scriptStart = html.indexOf('window.__myx =');
    if (scriptStart === -1) { console.warn('[Myntra] window.__myx not found'); return []; }
    const objStart = html.indexOf('{', scriptStart);
    if (objStart === -1) return [];

    let depth = 0, end = 0;
    for (let i = objStart; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (!end) return [];

    const json = JSON.parse(html.slice(objStart, end));
    const products: any[] = json?.searchData?.results?.products || [];
    console.log(`[Myntra] ${products.length} products from window.__myx`);

    return products.slice(0, 20).map((p: any) => {
      const price = p.price || 0;
      const mrp = p.mrp || 0;
      const imageUrl = (p.searchImage || '').replace(/^http:\/\//, 'https://');
      const url = p.landingPageUrl
        ? `https://www.myntra.com/${p.landingPageUrl}`
        : `https://www.myntra.com/${encoded}`;
      return {
        id: `mn_${p.productId}`,
        title: cleanText(`${p.brand || ''} ${p.productName || ''}`.trim()),
        brand: p.brand || undefined,
        price,
        originalPrice: mrp > price ? mrp : undefined,
        discount: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined,
        imageUrl,
        platform: 'Myntra',
        url,
        rating: p.rating || undefined,
      };
    }).filter((p: any) => isValidProduct(p));
  } catch (e: any) {
    console.error('[Myntra] error:', e?.message?.slice(0, 100));
    return [];
  }
}

async function fetchMeesho(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEYS.length) return [];
  try {
    const encoded = encodeURIComponent(query);
    const target = `https://www.meesho.com/search?q=${encoded}`;
    const key = getNextRoundRobinKey();

    const { data: html } = await axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: key,
        url: target,
        render: true,
        country_code: 'in',
        wait: 8000,
      },
      timeout: 90000,
      transformResponse: [(d) => d],
    });

    if (typeof html !== 'string' || html.length < 500) {
      console.warn('[Meesho] Empty response from ScraperAPI');
      return [];
    }

    console.log(`[Meesho] ScraperAPI rendered page, length=${html.length}`);

    // Extract products from rendered <a> card elements
    // Each product is an <a> tag wrapping a CardStyled div with image + price
    const products: SearchProduct[] = [];
    const seen = new Set<string>();

    // Match anchor tags that contain a Meesho image and a rupee price
    const anchorRe = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\/\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorRe.exec(html)) !== null) {
      const href = match[1] || '';
      const inner = match[2] || '';
      if (!href.includes('/p/')) continue;
      if (!inner.includes('images.meesho.com')) continue;

      const priceMatch = inner.match(/₹\s?([0-9,]+)/);
      if (!priceMatch) continue;
      const price = parsePrice(priceMatch[1]);
      if (price <= 0) continue;

      const imgMatch = inner.match(/<img[^>]+src=["']([^"']+)["']/i);
      const imageUrl = imgMatch?.[1] || '';
      if (!imageUrl.includes('images.meesho.com')) continue;

      const altMatch = inner.match(/<img[^>]+alt=["']([^"']+)["']/i);
      const pMatch = inner.match(/<p[^>]*>([^<]{5,})<\/p>/i);
      const title = cleanText(altMatch?.[1] || pMatch?.[1] || '');
      if (!title || title.length < 3) continue;

      const url = href.startsWith('http') ? href : `https://www.meesho.com${href}`;
      const key2 = `${title.toLowerCase()}::${price}`;
      if (seen.has(key2)) continue;
      seen.add(key2);

      products.push({
        id: `ms_${href}`,
        title,
        price,
        imageUrl,
        platform: 'Meesho',
        url,
      });

      if (products.length >= 20) break;
    }

    console.log(`[Meesho] ${products.length} products extracted`);
    return products
      .filter(p => isValidProduct(p))
      .filter(p => isRelevantToQuery(p, query));
  } catch (e: any) {
    console.error('[Meesho] error:', e?.message?.slice(0, 100));
    return [];
  }
}

// ─── Ajio ─────────────────────────────────────────────────────────────────────
// Verified against a live ScraperAPI response: Ajio exposes its internal
// search API directly at /api/search?query=... which returns full structured
// JSON (price, wasPrice/MRP, images, brand, url) at the plain tier — no
// premium or render needed. This is the cheapest platform to support besides
// Amazon/Flipkart. (Note: /api/search?text=... — the pattern the frontend's
// own JS references — returns only a stub; ?query=... is the one that works.)
async function fetchAjio(query: string): Promise<SearchProduct[]> {
  const targetUrl = `https://www.ajio.com/api/search?query=${encodeURIComponent(query)}`;
  const { html, tier, credits } = await fetchWithEscalation(
    targetUrl, 'ajio', 'premium', false, 'plain',
    (data) => data.includes('"products"') && data.length > 5000
  );
  console.log(`[Ajio] ScraperAPI tier=${tier} credits=${credits}`);
  if (!html) return [];

  try {
    const data = JSON.parse(html);
    const products: any[] = data?.products || [];
    if (!products.length) return [];

    return products.slice(0, 20).map((p: any, i: number) => {
      const price = parsePrice(p.price?.value ?? 0);
      const mrp = parsePrice(p.wasPriceData?.value ?? 0);
      const imageUrl = (p.images?.[0]?.url || p.fnlColorVariantData?.outfitPictureURL || '').replace(/^http:\/\//, 'https://');
      const title = cleanText(`${p.fnlColorVariantData?.brandName || ''} ${p.name || ''}`.trim());
      // colorGroup is formatted "{productCode}_{colorName}" (e.g. "469486197_navy").
      // Strip the leading code + underscore and title-case the remainder.
      const colorGroup: string = p.fnlColorVariantData?.colorGroup || '';
      const colorRaw = colorGroup.replace(/^\d+_/, '');
      const color = colorRaw ? colorRaw.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;
      return {
        id: `aj_${p.code || i}`,
        title,
        brand: p.fnlColorVariantData?.brandName || undefined,
        price,
        originalPrice: mrp > price ? mrp : undefined,
        discount: mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : undefined,
        imageUrl,
        platform: 'Ajio',
        url: p.url ? `https://www.ajio.com${p.url}` : `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`,
        color,
      };
    }).filter(p => isValidProduct(p));
  } catch (e: any) {
    console.error('[Ajio] parse error:', e?.message?.slice(0, 100));
    return [];
  }
}

// ─── Per-platform retry wrapper ──────────────────────────────────────────────
// A single transient failure (momentary rate limit, timeout, one-off block)
// shouldn't zero out a whole platform for the user. But blindly retrying is
// dangerous: if the first attempt was already slow (e.g. it escalated through
// ScraperAPI's render/premium tiers, which can take up to 40s), a retry would
// just repeat that same slow path and make the overall search feel worse, not
// better. So we only retry when the first attempt failed FAST (< FAST_FAIL_MS)
// — that pattern usually means a quick network blip or an instant block
// response, not a slow escalation ladder that's unlikely to succeed twice in
// a row on retry anyway. We also cap the total time any single platform gets
// so one slow/hanging platform can never block the whole search response.
const FAST_FAIL_MS = 4000;
const PLATFORM_BUDGET_MS = 12000;

function withTimeout<T>(promise: Promise<T[]>, ms: number): Promise<T[]> {
  return Promise.race([
    promise,
    new Promise<T[]>((resolve) => setTimeout(() => resolve([]), ms)),
  ]);
}

async function withRetry<T>(
  fn: () => Promise<T[]>,
  label: string
): Promise<T[]> {
  const start = Date.now();
  let firstResult: T[] = [];
  try {
    firstResult = await withTimeout(fn(), PLATFORM_BUDGET_MS);
  } catch {
    firstResult = [];
  }
  if (firstResult.length) return firstResult;

  const elapsed = Date.now() - start;
  if (elapsed >= FAST_FAIL_MS) {
    // Already slow (likely went through a costly escalation tier) — a retry
    // would just repeat that same delay for little chance of a different
    // outcome. Better to return empty now than double the wait.
    return [];
  }

  // Fast, empty/failed result — likely a transient blip. One quick retry,
  // still bounded so it can't blow past the remaining time budget.
  try {
    return await withTimeout(fn(), PLATFORM_BUDGET_MS - elapsed);
  } catch (e: any) {
    console.error(`[${label}] failed after retry:`, e?.message?.slice(0, 100));
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Exported for diagnostic/testing purposes only (per-platform isolation).
export const __platformFetchers = { fetchAmazonPage, fetchFlipkart, fetchMyntra, fetchAjio, fetchMeesho };

export async function searchProducts(query: string): Promise<SearchProduct[]> {
  const cacheKey = normalizeQuery(query);
  const searchTerm = query.toLowerCase().trim();
  console.log(`[search] keys=${SCRAPER_KEYS.length} key0=${SCRAPER_KEYS[0]?.slice(0,8)}... query=${searchTerm}`);

  // Expensive platforms (Ajio may hit paid ScraperAPI tiers) get a longer
  // cache TTL so one costly scrape serves many searches, not just 6h worth.
  const mem = getMemCached(cacheKey, EXPENSIVE_TTL_MS);
  if (mem) return mem;

  const db = await getDbCached(cacheKey, EXPENSIVE_TTL_MS);
  if (db) { setMemCache(cacheKey, db); return db; }

  // Myntra dropped from the active pipeline: requires a residential/Indian
  // IP to work for free, and the ScraperAPI fallback (premium tier, 25
  // credits) consistently times out from Vercel's cloud IPs — see
  // fetchMyntra() above for the full explanation. Revisit if/when a
  // residential proxy is in place.
  const [az1, fk, aj, ms, mn] = await Promise.all([
    withRetry(() => fetchAmazonPage(searchTerm, 1), 'Amazon'),
    withRetry(() => fetchFlipkart(searchTerm), 'Flipkart'),
    withRetry(() => fetchAjio(searchTerm), 'Ajio'),
    withRetry(() => fetchMeesho(searchTerm), 'Meesho'),
    withRetry(() => fetchMyntra(searchTerm), 'Myntra'),
  ]);

  // Deduplicate Amazon by ASIN
  const seenAsins = new Set<string>();
  const dedupedAmazon = az1.filter(p => {
    const asin = p.url.split('/dp/')[1]?.split('?')[0];
    if (!asin || seenAsins.has(asin)) return false;
    seenAsins.add(asin);
    return true;
  });

  const allResults = [...dedupedAmazon, ...fk, ...aj, ...ms, ...mn]
    .filter(p => isValidProduct(p))
    .filter(p => isRelevantToQuery(p, searchTerm))
    .sort((a, b) => a.price - b.price);

  const withAffiliate = allResults.map(p => ({
    ...p,
    affiliateUrl: buildAffiliateUrl(p.platform, p.url),
  }));

  if (withAffiliate.length) {
    setMemCache(cacheKey, withAffiliate);
    setDbCache(cacheKey, withAffiliate);
  }

  return withAffiliate;
}

/**
 * Streaming variant of searchProducts(). Fires all platform fetchers in
 * parallel exactly like searchProducts(), but invokes `onPlatform` as soon as
 * EACH platform's results are ready — instead of waiting for the slowest one
 * (Myntra/Ajio can take 40-90s on ScraperAPI escalation, while Amazon/Flipkart
 * often resolve in a few seconds). This lets callers (e.g. an SSE endpoint)
 * show partial results immediately rather than blocking on the whole batch.
 *
 * Caching, dedup, validity/relevance filtering, and affiliate URL generation
 * are identical to searchProducts() — only the delivery timing differs.
 */
export async function searchProductsStreaming(
  query: string,
  onPlatform: (platform: string, products: SearchProduct[]) => void,
): Promise<SearchProduct[]> {
  const cacheKey = normalizeQuery(query);
  const searchTerm = query.toLowerCase().trim();

  const mem = getMemCached(cacheKey, EXPENSIVE_TTL_MS);
  if (mem) { if (mem.length) onPlatform('cache', mem); return mem; }

  const db = await getDbCached(cacheKey, EXPENSIVE_TTL_MS);
  if (db) { setMemCache(cacheKey, db); if (db.length) onPlatform('cache', db); return db; }

  const seenAsins = new Set<string>();
  const collected: SearchProduct[] = [];

  function processed(platform: string, raw: SearchProduct[]) {
    let items = raw;
    if (platform === 'amazon') {
      items = raw.filter(p => {
        const asin = p.url.split('/dp/')[1]?.split('?')[0];
        if (!asin || seenAsins.has(asin)) return false;
        seenAsins.add(asin);
        return true;
      });
    }
    const valid = items
      .filter(p => isValidProduct(p))
      .filter(p => isRelevantToQuery(p, searchTerm));
    const withAffiliate = valid.map(p => ({ ...p, affiliateUrl: buildAffiliateUrl(p.platform, p.url) }));
    collected.push(...withAffiliate);
    if (withAffiliate.length) {
      onPlatform(platform, [...withAffiliate].sort((a, b) => a.price - b.price));
    }
  }

  await Promise.all([
    fetchAmazonPage(searchTerm, 1).catch(() => []).then(r => processed('amazon', r)),
    fetchFlipkart(searchTerm).catch(() => []).then(r => processed('flipkart', r)),
    fetchAjio(searchTerm).catch(() => []).then(r => processed('ajio', r)),
    fetchMeesho(searchTerm).catch(() => []).then(r => processed('meesho', r)),
    fetchMyntra(searchTerm).catch(() => []).then(r => processed('myntra', r)),
  ]);

  const sorted = collected.sort((a, b) => a.price - b.price);

  if (sorted.length) {
    setMemCache(cacheKey, sorted);
    setDbCache(cacheKey, sorted);
  }

  return sorted;
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
