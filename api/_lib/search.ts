import axios from 'axios';
import { buildAffiliateUrl } from './affiliate.js';
import { connectDB } from './db.js';
import SearchCache from './models/SearchCache.js';

// SearchProduct is defined in its own file so the normalizer and tests
// can import the type without pulling in this module's heavy dependencies
// (axios, mongoose). Re-exported here so all existing callers are unaffected.
export type { SearchProduct } from './types/searchProduct.js';
import type { SearchProduct } from './types/searchProduct.js';

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
// Plain ScraperAPI HTML scrape — 1 credit, ~5-8s.
// Extracts product cards using data-component-type="s-search-result" blocks.

async function fetchAmazonPage(query: string, page = 1): Promise<SearchProduct[]> {
  if (!SCRAPER_KEYS.length) { console.error('[Amazon] No API keys'); return []; }
  if (isCircuitOpen('amazon')) return [];
  try {
    const { data: html } = await withScraperSlot(() => axios.get('https://api.scraperapi.com/', {
      params: { api_key: getNextRoundRobinKey(), url: `https://www.amazon.in/s?k=${encodeURIComponent(query)}&i=fashion&page=${page}`, country_code: 'in' },
      timeout: 20000,
      transformResponse: [(d) => d],
    }));
    if (typeof html !== 'string' || html.length < 1000) { recordFailure('amazon'); return []; }
    if (/captcha|robot|are you a human/i.test(html.slice(0, 2000))) { recordFailure('amazon'); return []; }
    recordSuccess('amazon');
    console.log(`[Amazon] plain tier, length=${html.length}`);

    const products: SearchProduct[] = [];
    const seen = new Set<string>();
    const cardSplits = html.split('data-component-type="s-search-result"');
    for (const card of cardSplits.slice(1, 21)) {
      const asinM = card.match(/data-asin="([A-Z0-9]{10})"/);
      if (!asinM) continue;
      const asin = asinM[1];
      if (seen.has(asin)) continue;
      seen.add(asin);
      const priceWholeM = card.match(/class="a-price-whole">([\d,]+)/);
      const priceFracM = card.match(/class="a-price-fraction">([\d]+)/);
      if (!priceWholeM) continue;
      const price = Math.round(parseFloat(priceWholeM[1].replace(/,/g, '') + (priceFracM ? `.${priceFracM[1]}` : '')));
      if (price <= 0) continue;
      const imgM = card.match(/<img[^>]+src="(https?:\/\/(?:m\.media-amazon\.com|images-na\.ssl-images-amazon\.com|images-eu\.ssl-images-amazon\.com)[^"]+)"/);
      const imageUrl = toAbsoluteUrl(imgM?.[1] || '');
      if (!imageUrl) continue;
      const imgAlt = imgM?.[0].match(/alt="([^"]{15,})"/)?.[1];
      const ariaMatches = [...card.matchAll(/aria-label="([^"]{15,})"/g)].map(m => m[1]);
      const ariaTitle = ariaMatches.find(t => !/sponsored|colours available|amazon.s choice|leave ad|rating|stars|out of 5/i.test(t));
      const spanTexts = [...card.matchAll(/<span[^>]*>([^<]{15,})<\/span>/g)]
        .map(m => m[1].trim())
        .filter(t => !/^[₹\d,\.%\s]+$/.test(t) && !/sponsored|mrp|off|back with|delivery|sun|mon|tue|wed|thu|fri|sat/i.test(t));
      const spanTitle = spanTexts.sort((a, b) => b.length - a.length)[0];
      const title = cleanText(imgAlt || ariaTitle || spanTitle || '');
      if (!title || title.length < 10) continue;
      const origM = card.match(/class="a-offscreen">\u20b9([\d,]+)</);
      const orig = origM ? parsePrice(origM[1]) : 0;
      products.push({
        id: `az_p${page}_${asin}`, title, price,
        originalPrice: orig > price ? orig : undefined,
        discount: orig > price ? Math.round(((orig - price) / orig) * 100) : undefined,
        imageUrl, platform: 'Amazon India', url: `https://www.amazon.in/dp/${asin}`,
      });
    }
    console.log(`[Amazon] ${products.length} results`);
    return products.filter(p => isValidProduct(p));
  } catch (e: any) {
    console.error('[Amazon] error:', e?.message?.slice(0, 100));
    recordFailure('amazon');
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

function parseFlipkartHtml(html: string, query: string): SearchProduct[] {
  const stateMarker = html.indexOf('window.__INITIAL_STATE__');
  if (stateMarker === -1) return [];
  const braceOpen = html.indexOf('{', stateMarker);
  if (braceOpen === -1) return [];
  let depth2 = 0, stateEnd = 0;
  for (let ci = braceOpen; ci < html.length; ci++) {
    if (html[ci] === '{') depth2++;
    else if (html[ci] === '}') { depth2--; if (depth2 === 0) { stateEnd = ci + 1; break; } }
  }
  if (!stateEnd) return [];
  const state = JSON.parse(html.slice(braceOpen, stateEnd));
  const pageData = state?.pageDataV4?.page?.data || {};
  const slots: any[] = Object.values(pageData).flat() as any[];
  const rawProducts: any[] = [];
  for (const slot of slots) {
    const p = (slot as any)?.widget?.data?.products;
    if (Array.isArray(p)) rawProducts.push(...p);
  }
  if (!rawProducts.length) return [];
  return rawProducts.slice(0, 20).map((p: any, i: number) => {
    const info = p.productInfo?.value || p;
    const prices: any[] = info.pricing?.prices || [];
    const mrpEntry = prices.find((x: any) => x.strikeOff === true);
    const spEntry  = prices.find((x: any) => x.priceType === 'SPECIAL_PRICE');
    const mrp   = mrpEntry?.value || 0;
    const price = spEntry?.value || mrpEntry?.value || 0;
    const disc  = info.pricing?.totalDiscount || 0;
    const rawImg = info.media?.images?.[0]?.url || '';
    const imageUrl = rawImg
      .replace('{@width}', '300').replace('{@height}', '400').replace('{@quality}', '70')
      .replace(/^http:\/\//, 'https://');
    const coSubtitle: string = info.titles?.coSubtitle || '';
    const sizeMatch = coSubtitle.match(/^Size:\s*(.+)$/i);
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
      size: sizeMatch ? sizeMatch[1].trim() : undefined,
    };
  }).filter(p => isValidProduct(p));
}

async function fetchFlipkart(query: string): Promise<SearchProduct[]> {
  if (isCircuitOpen('flipkart')) return [];

  // Fast path: hit Flipkart directly — no ScraperAPI, ~1-3s, 0 credits.
  // __INITIAL_STATE__ is server-rendered so no JS needed.
  try {
    const { data: html } = await axios.get('https://www.flipkart.com/search', {
      params: { q: query, sort: 'price_asc' },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: 8000,
      transformResponse: [(d) => d],
    });
    if (typeof html === 'string' && html.includes('window.__INITIAL_STATE__')) {
      const products = parseFlipkartHtml(html, query);
      if (products.length > 0) {
        recordSuccess('flipkart');
        console.log(`[Flipkart] direct: ${products.length} results`);
        return products;
      }
    }
  } catch (e: any) {
    console.warn('[Flipkart] direct failed:', e?.message?.slice(0, 60));
  }

  // Fallback: ScraperAPI plain tier — 1 credit
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
      transformResponse: [(d) => d],
    }));
    if (typeof html !== 'string' || !html.includes('window.__INITIAL_STATE__')) {
      recordFailure('flipkart'); return [];
    }
    recordSuccess('flipkart');
    console.log(`[Flipkart] ScraperAPI fallback: ${html.length}`);
    return parseFlipkartHtml(html, query);
  } catch (e: any) {
    console.error('[Flipkart] error:', e?.message?.slice(0, 100));
    recordFailure('flipkart');
    return [];
  }
}

async function fetchMyntra(query: string): Promise<SearchProduct[]> {
  if (!SCRAPER_KEYS.length) return [];
  try {
    const encoded = encodeURIComponent(query);
    // Myntra blocks Vercel datacenter IPs — route through ScraperAPI with Indian IP
    // Uses plain tier (1 credit) since window.__myx is server-rendered, no JS needed
    const { data: html } = await withScraperSlot(() => axios.get('https://api.scraperapi.com/', {
      params: {
        api_key: getNextRoundRobinKey(),
        url: `https://www.myntra.com/${encoded}`,
        country_code: 'in',
      },
      responseType: 'text',
      timeout: 25000,
    }));

    if (typeof html !== 'string' || !html.includes('window.__myx =')) {
      console.warn('[Myntra] window.__myx not found in ScraperAPI response, length:', typeof html === 'string' ? html.length : 0);
      return [];
    }

    const scriptStart = html.indexOf('window.__myx =');
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
    console.log(`[Myntra] ${products.length} products via ScraperAPI`);

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
    // Meesho internal catalog API — plain tier (1 credit, ~3-5s), no render needed
    const target = `https://www.meesho.com/api/v1/products/search?q=${encodeURIComponent(query)}&page=1&limit=20`;
    const { html, tier, credits } = await fetchWithEscalation(
      target, 'meesho', 'premium', false, 'plain',
      (data) => {
        try { const j = JSON.parse(data); return Array.isArray(j?.data) && j.data.length > 0; } catch { return false; }
      }
    );
    console.log(`[Meesho] tier=${tier} credits=${credits}`);

    if (html) {
      try {
        const json = JSON.parse(html);
        const items: any[] = json?.data || [];
        if (items.length > 0) {
          const products = items.slice(0, 20).map((p: any, i: number) => {
            const price = parsePrice(p.price?.discounted_price ?? p.price?.mrp ?? 0);
            const mrp = parsePrice(p.price?.mrp ?? 0);
            const imageUrl = toAbsoluteUrl(p.images?.[0]?.url || p.cover_image || '');
            const title = cleanText(p.name || p.product_name || '');
            const slug = p.product_slug || p.slug || '';
            const url = slug ? `https://www.meesho.com/${slug}/p/${p.id || i}` : `https://www.meesho.com/search?q=${encodeURIComponent(query)}`;
            return { id: `ms_${p.id || i}`, title, price, originalPrice: mrp > price ? mrp : undefined, discount: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined, imageUrl, platform: 'Meesho', url };
          }).filter(p => isValidProduct(p)).filter(p => isRelevantToQuery(p, query));
          if (products.length > 0) { console.log(`[Meesho] catalog API: ${products.length} results`); return products; }
        }
      } catch { /* fall through to GraphQL */ }
    }

    // Fallback: Meesho GraphQL API — plain tier, structured JSON
    const gqlTarget = 'https://www.meesho.com/api/v1/products/search/feed';
    const gqlBody = JSON.stringify({ query, page: 1, filters: {} });
    const gqlUrl = `https://api.scraperapi.com/?api_key=${getNextRoundRobinKey()}&url=${encodeURIComponent(gqlTarget)}&country_code=in`;
    const { data: gqlRaw } = await withScraperSlot(() => axios.post(gqlUrl, gqlBody, {
      headers: { 'Content-Type': 'application/json', 'x-meesho-client': 'web' },
      timeout: 20000,
      transformResponse: [(d) => d],
    }));
    const gqlText = typeof gqlRaw === 'string' ? gqlRaw : String(gqlRaw);
    const gqlJson = JSON.parse(gqlText);
    const gqlItems: any[] = gqlJson?.data?.products || gqlJson?.products || [];
    if (gqlItems.length > 0) {
      const products = gqlItems.slice(0, 20).map((p: any, i: number) => {
        const price = parsePrice(p.price?.discounted_price ?? p.price?.mrp ?? p.mrp ?? 0);
        const mrp = parsePrice(p.price?.mrp ?? p.mrp ?? 0);
        const imageUrl = toAbsoluteUrl(p.images?.[0]?.url || p.cover_image || '');
        const title = cleanText(p.name || p.product_name || '');
        const slug = p.product_slug || p.slug || '';
        const url = slug ? `https://www.meesho.com/${slug}/p/${p.id || i}` : `https://www.meesho.com/search?q=${encodeURIComponent(query)}`;
        return { id: `ms_gql_${p.id || i}`, title, price, originalPrice: mrp > price ? mrp : undefined, discount: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined, imageUrl, platform: 'Meesho', url };
      }).filter(p => isValidProduct(p)).filter(p => isRelevantToQuery(p, query));
      console.log(`[Meesho] GraphQL fallback: ${products.length} results`);
      return products;
    }

    console.warn('[Meesho] all methods returned 0 results');
    return [];
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
const PLATFORM_BUDGET_MS = 12000;  // default cap for fast platforms
const AMAZON_BUDGET_MS   = 35000;  // Amazon ScraperAPI plain can take 20-30s

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

  const [az1, fk, aj, ms, mn] = await Promise.all([
    withTimeout(fetchAmazonPage(searchTerm, 1), AMAZON_BUDGET_MS),
    withRetry(() => fetchFlipkart(searchTerm), 'Flipkart'),
    withRetry(() => fetchAjio(searchTerm), 'Ajio'),
    withRetry(() => fetchMeesho(searchTerm), 'Meesho'),
    withTimeout(fetchMyntra(searchTerm), 30000).catch(() => []),
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
  skipCacheCheck = false, // set true when caller already checked cache
): Promise<SearchProduct[]> {
  const cacheKey = normalizeQuery(query);
  const searchTerm = query.toLowerCase().trim();

  if (!skipCacheCheck) {
    const mem = getMemCached(cacheKey, EXPENSIVE_TTL_MS);
    if (mem) { if (mem.length) onPlatform('cache', mem); return mem; }
    const db = await getDbCached(cacheKey, EXPENSIVE_TTL_MS);
    if (db) { setMemCache(cacheKey, db); if (db.length) onPlatform('cache', db); return db; }
  }

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
    withTimeout(fetchAmazonPage(searchTerm, 1), AMAZON_BUDGET_MS).catch(() => []).then(r => processed('amazon', r)),
    fetchFlipkart(searchTerm).catch(() => []).then(r => processed('flipkart', r)),
    fetchAjio(searchTerm).catch(() => []).then(r => processed('ajio', r)),
    fetchMeesho(searchTerm).catch(() => []).then(r => processed('meesho', r)),
    withTimeout(fetchMyntra(searchTerm), 30000).catch(() => []).then(r => processed('myntra', r)),
  ]);

  const sorted = collected.sort((a, b) => a.price - b.price);

  if (sorted.length) {
    setMemCache(cacheKey, sorted);
    setDbCache(cacheKey, sorted);
  }

  return sorted;
}

export { getMemCached, getDbCached, normalizeQuery };

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
