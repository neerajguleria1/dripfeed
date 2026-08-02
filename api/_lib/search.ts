import axios from 'axios';
import { buildAffiliateUrl } from './affiliate.js';
import { connectDB } from './db.js';
import SearchCache from './models/SearchCache.js';
import { normalizeProducts } from './normalizer.js';
import { groupIntoCanonicals } from './matcher.js';
import type { CanonicalProduct } from './types/canonicalProduct.js';
import { saveBulkSnapshots, type SnapshotInput } from './priceHistory.js';
import { evaluateAlerts } from './alertService.js';
import { LRUCache } from './lruCache.js';

// SearchProduct is defined in its own file so the normalizer and tests
// can import the type without pulling in this module's heavy dependencies
// (axios, mongoose). Re-exported here so all existing callers are unaffected.
export type { SearchProduct } from './types/searchProduct.js';
import type { SearchProduct } from './types/searchProduct.js';

// ─── Feature flags ─────────────────────────────────────────────────────────────
// Set ENABLE_TATACLIQ = true to show Tata CLiQ results to users.
// Tokens are NEVER consumed when disabled — the fetcher returns immediately.
// Requires ENABLE_TATACLIQ=true env var as well (double-gated for safety).
const ENABLE_TATACLIQ = false;

// ─── ScraperAPI concurrency limiter (priority-aware) ──────────────────────────
// Our ScraperAPI plan caps concurrent requests at 5 (concurrencyLimit=5). When
// Amazon/Flipkart/Myntra/Ajio all fire in parallel (searchProducts uses
// Promise.all), it's easy to momentarily exceed that limit — observed as
// random 403s or connection timeouts on whichever request loses the race,
// even though every platform works fine when called alone. This is a priority
// semaphore: fast platforms (Amazon, Flipkart, Myntra, Ajio) use HIGH priority
// and jump the queue ahead of slow platforms (Meesho, Tata CLiQ) so quick
// results arrive first and slow scrapes never block fast ones.
const MAX_CONCURRENT_SCRAPER_REQUESTS = 4;
let activeScraperRequests = 0;
const highPriorityQueue: Array<() => void> = [];
const lowPriorityQueue: Array<() => void> = [];

async function acquireScraperSlot(priority: 'high' | 'low' = 'high'): Promise<void> {
  if (activeScraperRequests < MAX_CONCURRENT_SCRAPER_REQUESTS) {
    activeScraperRequests++;
    return;
  }
  await new Promise<void>((resolve) => {
    if (priority === 'high') highPriorityQueue.push(resolve);
    else lowPriorityQueue.push(resolve);
  });
  activeScraperRequests++;
}

function releaseScraperSlot(): void {
  activeScraperRequests--;
  // High-priority waiters always run before low-priority ones
  const next = highPriorityQueue.shift() ?? lowPriorityQueue.shift();
  if (next) next();
}

/** Runs `fn` with an acquired ScraperAPI concurrency slot, always releasing it afterward. */
async function withScraperSlot<T>(fn: () => Promise<T>, priority: 'high' | 'low' = 'high'): Promise<T> {
  await acquireScraperSlot(priority);
  try {
    return await fn();
  } finally {
    releaseScraperSlot();
  }
}

// ─── Cache ────────────────────────────────────────────────────────────────────
import {
  QUERY_CACHE_TTL_MS,
  buildCacheMeta,
  liveCacheMeta,
  recordCacheHit,
  recordCacheMiss,
  type CacheMeta,
} from './cache/policy.js';

// Bounded LRU — max 500 entries prevents unbounded growth on long-running
// instances that receive thousands of distinct queries. LRU evicts the
// least-recently-used entry when the cap is reached, keeping hot queries warm.
interface MemEntry { data: SearchProduct[]; fetchedAt: Date; }
const memCache = new LRUCache<string, MemEntry>({ maxSize: 1000 });

function getMemCached(key: string): { data: SearchProduct[]; meta: CacheMeta } | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt.getTime() > QUERY_CACHE_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return { data: entry.data, meta: buildCacheMeta(entry.fetchedAt, 'memory') };
}
function setMemCache(key: string, data: SearchProduct[], fetchedAt = new Date()) {
  memCache.set(key, { data, fetchedAt });
}
async function getDbCached(query: string): Promise<{ data: SearchProduct[]; meta: CacheMeta } | null> {
  try {
    await connectDB();
    const doc = await SearchCache.findOne({ query }).lean();
    if (!doc) return null;
    const fetchedAt = doc.fetchedAt ?? doc.cachedAt;
    if (Date.now() - new Date(fetchedAt).getTime() > QUERY_CACHE_TTL_MS) return null;
    return { data: doc.results as SearchProduct[], meta: buildCacheMeta(new Date(fetchedAt), 'mongodb') };
  } catch { return null; }
}
async function setDbCache(query: string, results: SearchProduct[], fetchedAt = new Date(), canonicalIds: string[] = []) {
  try {
    await connectDB();
    await SearchCache.findOneAndUpdate(
      { query },
      { results, fetchedAt, cachedAt: fetchedAt, canonicalIds },
      { upsert: true, new: true }
    );
  } catch { /* non-fatal */ }
}

// ─── In-flight deduplication ──────────────────────────────────────────────────
// If two requests arrive for the same query simultaneously, only one live
// scrape fires. The second waits for the first to resolve and reuses its result.
const inFlight = new Map<string, Promise<{ data: SearchProduct[]; meta: CacheMeta }>>();

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
    const imageUrl = toAbsoluteUrl(imgMatch?.[1] || '').replace(/_\d+(\.\w+)$/, '_1024$1');

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

/**
 * Build a ScraperAPI URL with the key embedded in the query string.
 *
 * SECURITY: The api_key must NEVER be passed via axios `params` because axios
 * serialises params into the request config object, which appears verbatim in
 * error stack traces and Vercel function logs. Building the URL as a string
 * keeps the key out of any structured error object.
 */
function scraperUrl(
  targetUrl: string,
  extra: Record<string, string | boolean | number> = {},
): string {
  const key = getNextRoundRobinKey();
  const base = new URL('https://api.scraperapi.com/');
  base.searchParams.set('api_key', key);
  base.searchParams.set('url', targetUrl);
  base.searchParams.set('country_code', 'in');
  for (const [k, v] of Object.entries(extra)) {
    base.searchParams.set(k, String(v));
  }
  return base.toString();
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
      const url = scraperUrl(targetUrl, tier.params as Record<string, string | boolean | number>);
      const { data } = await withScraperSlot(() => axios.get(url, {
        timeout: tier.params.render ? 40000 : 15000,
        transformResponse: [(res) => res],
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
    const url = scraperUrl(`https://www.amazon.in/s?k=${encodeURIComponent(query)}&i=fashion&page=${page}`);
    const { data: html } = await withScraperSlot(() => axios.get(url, {
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
      const imageUrl = toAbsoluteUrl(imgM?.[1] || '').replace(/\._([A-Z]{2,})_\d+_\./, '._SL1500_.');
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
  return rawProducts.slice(0, 40).map((p: any, i: number) => {
    const info = p.productInfo?.value || p;
    const prices: any[] = info.pricing?.prices || [];
    const mrpEntry = prices.find((x: any) => x.strikeOff === true);
    const spEntry  = prices.find((x: any) => x.priceType === 'SPECIAL_PRICE');
    const mrp   = mrpEntry?.value || 0;
    const price = spEntry?.value || mrpEntry?.value || 0;
    const disc  = info.pricing?.totalDiscount || 0;
    const rawImg = info.media?.images?.[0]?.url || '';
    const imageUrl = rawImg
      .replace('{@width}', '600').replace('{@height}', '800').replace('{@quality}', '100')
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
    const url = scraperUrl(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}&sort=price_asc`);
    const { data: html } = await withScraperSlot(() => axios.get(url, {
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
    const url = scraperUrl(`https://www.myntra.com/${encoded}`);
    const { data: html } = await withScraperSlot(() => axios.get(url, {
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

    return products.slice(0, 40).map((p: any) => {
      const price = p.price || 0;
      const mrp = p.mrp || 0;
      const imageUrl = (p.searchImage || '').replace(/^http:\/\//, 'https://').replace(/w_\d+(?=[,\/]|$)/, 'w_800');
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
        color: p.primaryColour || undefined,
        size: typeof p.sizes === 'string' && p.sizes ? p.sizes.split(',').slice(0, 4).join('/') : undefined,
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
    const url = scraperUrl(`https://www.meesho.com/search?q=${encodeURIComponent(query)}`, { render: true, wait: 8000 });
    const { data: html } = await withScraperSlot(() => axios.get(url, {
      timeout: 30000,
      transformResponse: [(d) => d],
    }), 'low');

    if (typeof html !== 'string' || html.length < 500) {
      console.warn('[Meesho] empty response from ScraperAPI');
      return [];
    }
    console.log(`[Meesho] rendered page length=${html.length}`);

    const products: SearchProduct[] = [];
    const seen = new Set<string>();
    const anchorRe = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
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
      let imageUrl = imgMatch?.[1] || '';
      if (!imageUrl.includes('images.meesho.com')) continue;
      imageUrl = imageUrl.replace(/_\d+(\.\w+)$/, '_1024$1');

      const altMatch = inner.match(/<img[^>]+alt=["']([^"']+)["']/i);
      const pMatch = inner.match(/<p[^>]*>([^<]{5,})<\/p>/i);
      const title = cleanText(altMatch?.[1] || pMatch?.[1] || '');
      if (!title || title.length < 3) continue;

      // Color: Meesho renders swatch images with alt="ColorName" inside the card
      const swatchAlts = [...inner.matchAll(/<img[^>]+alt=["']([A-Za-z][^"']{1,20})["'][^>]*>/gi)]
        .map(m => m[1].trim())
        .filter(a => a !== title && !/^\d/.test(a) && a.length < 25);
      const color = swatchAlts[0];

      // Size: Meesho renders size pills as short text nodes like "S", "M", "XL", "38"
      const sizeMatches = [...inner.matchAll(/>\s*([A-Z0-9]{1,5})\s*</g)]
        .map(m => m[1].trim())
        .filter(s => /^(XS|S|M|L|XL|XXL|XXXL|[0-9]{2,3})$/.test(s));
      const size = sizeMatches.length ? sizeMatches.join('/') : undefined;

      const url = href.startsWith('http') ? href : `https://www.meesho.com${href}`;
      const key = `${title.toLowerCase()}::${price}`;
      if (seen.has(key)) continue;
      seen.add(key);

      products.push({ id: `ms_${href}`, title, price, imageUrl, platform: 'Meesho', url, color, size });
      if (products.length >= 20) break;
    }

    console.log(`[Meesho] ${products.length} products extracted`);
    return products.filter(p => isValidProduct(p)).filter(p => isRelevantToQuery(p, query));
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

    return products.slice(0, 40).map((p: any, i: number) => {
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

// ─── Tata CLiQ ────────────────────────────────────────────────────────────────
// Tata CLiQ is a React SPA — product data is NOT in __NEXT_DATA__.
// The product grid renders client-side. We use ScraperAPI render=true +
// wait_for_selector=.ProductModule__base to wait for cards, then parse DOM.
//
// Verified card structure (live render, 2025):
//   <a class="ProductModule__base" href="https://www.tatacliq.com/slug/p-MPID">
//     <img src="//img.tatacliq.com/images/...">
//     <h3 class="ProductDescription__boldText">Brand</h3>
//     <h2 class="ProductDescription__description">Title</h2>
//     <h3 class="ProductDescription__boldText"> ₹1324</h3>  ← selling price
//     <span> ₹4345</span>  (inside priceCancelled)           ← MRP
//     <div class="StarRating__starRatingHigh">3.6
//
// Cost: 10 credits (render tier). ~50s response time.

export function parseTataCliqHtml(html: string): SearchProduct[] {
  const products: SearchProduct[] = [];
  const seen = new Set<string>();
  const splits = html.split('class="ProductModule__base"');

  for (let i = 1; i < splits.length; i++) {
    const chunk = splits[i];

    // href — full URL or relative /slug/p-MPID
    const hrefM = chunk.match(/href="(https?:\/\/www\.tatacliq\.com\/[^"]+|\/[^"]+\/p-[^"]+)"/);
    if (!hrefM) continue;
    const url = hrefM[1].startsWith('http') ? hrefM[1] : `https://www.tatacliq.com${hrefM[1]}`;

    const styleIdM = url.match(/\/p-([A-Z0-9]+)/);
    const styleId = styleIdM?.[1] ?? String(i);
    if (seen.has(styleId)) continue;
    seen.add(styleId);

    // Image — protocol-relative //img.tatacliq.com/...
    const imgM = chunk.match(/src="(\/\/img\.tatacliq\.com\/[^"]+)"/);
    const imageUrl = imgM ? `https:${imgM[1]}`.replace(/_\d+x\d+_/, '_1000x1200_') : '';
    if (!imageUrl) continue;

    // Brand — first ProductDescription__boldText
    const brandM = chunk.match(/ProductDescription__boldText">([^<]+)</);
    const brand = brandM ? cleanText(brandM[1]) : undefined;

    // Title — ProductDescription__description h2
    const titleM = chunk.match(/ProductDescription__description[^"]*">([^<]+)</);
    const title = titleM ? cleanText(titleM[1]) : (brand ?? '');
    if (!title || title.length < 5) continue;

    // Selling price — last boldText h3 containing ₹
    const boldPrices = [...chunk.matchAll(/ProductDescription__boldText">[^\u20b9]*\u20b9\s*([\d,]+)/g)];
    const price = boldPrices.length ? parsePrice(boldPrices[boldPrices.length - 1][1]) : 0;
    if (price <= 0) continue;

    // MRP — inside priceCancelled
    const mrpM = chunk.match(/priceCancelled[^>]*>[^\u20b9]*\u20b9\s*([\d,]+)/);
    const mrp = mrpM ? parsePrice(mrpM[1]) : 0;

    // Rating
    const ratingM = chunk.match(/starRatingHigh">([\d.]+)/);
    const rating = ratingM ? Number(ratingM[1]) : undefined;

    products.push({
      id: `tc_${styleId}`,
      title,
      brand,
      price,
      originalPrice: mrp > price ? mrp : undefined,
      discount: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined,
      imageUrl,
      platform: 'Tata CLiQ',
      url,
      rating,
    });

    if (products.length >= 20) break;
  }

  return products;
}

async function fetchTataCliq(query: string): Promise<SearchProduct[]> {
  if (!ENABLE_TATACLIQ || process.env.ENABLE_TATACLIQ !== 'true') return [];
  if (!SCRAPER_KEYS.length) return [];
  if (isCircuitOpen('tatacliq')) return [];

  try {
    const targetUrl = `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(query)}`;
    const scraped = scraperUrl(targetUrl, { render: true });
    const { data: html } = await withScraperSlot(() => axios.get(scraped, {
      responseType: 'text',
      timeout: 25000,
    }), 'low');

    if (typeof html !== 'string' || html.length < 5000) {
      console.warn('[TataCliq] short/invalid response, length:', typeof html === 'string' ? html.length : 0);
      recordFailure('tatacliq');
      return [];
    }

    if (!html.includes('ProductModule__base')) {
      console.warn('[TataCliq] product grid did not render');
      recordFailure('tatacliq');
      return [];
    }

    const products = parseTataCliqHtml(html).filter(p => isValidProduct(p));
    console.log(`[TataCliq] ${products.length} products from rendered HTML`);
    recordSuccess('tatacliq');
    return products;
  } catch (e: any) {
    console.error('[TataCliq] error:', e?.message?.slice(0, 100));
    recordFailure('tatacliq');
    return [];
  }
}


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

// ─── Matcher integration ──────────────────────────────────────────────────────
// Normalizes a flat SearchProduct[] and groups it into CanonicalProduct[].
// Same-platform duplicates within a canonical keep only the cheapest offer.
// Canonicals are sorted by their cheapest offer price (ascending).
export function groupSearchResults(products: SearchProduct[]): CanonicalProduct[] {
  if (!products.length) return [];
  const canonicals = groupIntoCanonicals(normalizeProducts(products));
  return canonicals.map(canonical => {
    // Keep only the cheapest offer per platform inside each canonical
    const byPlatform = new Map<string, typeof canonical.offers[0]>();
    for (const offer of canonical.offers) {
      const key = offer.platform.toLowerCase();
      const existing = byPlatform.get(key);
      if (!existing || offer.price < existing.price) byPlatform.set(key, offer);
    }
    const deduped = Array.from(byPlatform.values()).sort((a, b) => a.price - b.price);
    return { ...canonical, offers: deduped, offerCount: deduped.length };
  }).sort((a, b) => (a.offers[0]?.price ?? Infinity) - (b.offers[0]?.price ?? Infinity));
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Exported for diagnostic/testing purposes only (per-platform isolation).
export const __platformFetchers = { fetchAmazonPage, fetchFlipkart, fetchMyntra, fetchAjio, fetchMeesho, fetchTataCliq };

export async function searchProducts(query: string, fastOnly = false): Promise<CanonicalProduct[]> {
  const { canonicals } = await searchProductsWithMeta(query, false, fastOnly);
  return canonicals;
}

/**
 * Streaming variant: fires all platform fetchers in parallel, calls
 * `onPlatform` as each platform resolves (drives the live status pills in
 * the UI), then groups all collected results into CanonicalProduct[] once
 * every platform has settled. Grouping requires seeing all platforms first
 * because a Flipkart result may match an Amazon result that arrived earlier.
 *
 * When `fastOnly` is true, slow/expensive platforms (Meesho, Tata CLiQ) are
 * skipped entirely — used for secondary/related searches where speed matters
 * more than completeness.
 */
export async function searchProductsStreaming(
  query: string,
  onPlatform: (platform: string, products: SearchProduct[]) => void,
  skipCacheCheck = false,
  fastOnly = false,
): Promise<{ canonicals: CanonicalProduct[]; meta: CacheMeta }> {
  const cacheKey = normalizeQuery(query);
  const searchTerm = query.toLowerCase().trim();

  if (!skipCacheCheck) {
    const mem = getMemCached(cacheKey);
    if (mem) {
      recordCacheHit('memory', cacheKey);
      onPlatform('cache', mem.data);
      return { canonicals: groupSearchResults(mem.data), meta: mem.meta };
    }
    const db = await getDbCached(cacheKey);
    if (db) {
      setMemCache(cacheKey, db.data, new Date(db.meta.fetchedAt));
      recordCacheHit('mongodb', cacheKey);
      onPlatform('cache', db.data);
      return { canonicals: groupSearchResults(db.data), meta: db.meta };
    }
  }

  recordCacheMiss(cacheKey);

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
      .filter(p => isRelevantToQuery(p, searchTerm))
      .map(p => ({ ...p, affiliateUrl: buildAffiliateUrl(p.platform, p.url) }));
    collected.push(...valid);
    if (valid.length) onPlatform(platform, valid);
  }

  const platformPromises: Promise<void>[] = [
    withTimeout(fetchAmazonPage(searchTerm, 1), AMAZON_BUDGET_MS).catch(() => []).then(r => processed('amazon', r)),
    withTimeout(fetchAmazonPage(searchTerm, 2), AMAZON_BUDGET_MS).catch(() => []).then(r => processed('amazon', r)),
    fetchFlipkart(searchTerm).catch(() => []).then(r => processed('flipkart', r)),
    fetchAjio(searchTerm).catch(() => []).then(r => processed('ajio', r)),
    withTimeout(fetchMyntra(searchTerm), 30000).catch(() => []).then(r => processed('myntra', r)),
  ];
  // Skip slow/expensive platforms for secondary searches (related products etc.)
  if (!fastOnly) {
    platformPromises.push(
      withTimeout(fetchMeesho(searchTerm), 35000).catch(() => []).then(r => processed('meesho', r)),
      withTimeout(fetchTataCliq(searchTerm), 30000).catch(() => []).then(r => processed('tatacliq', r)),
    );
  }
  await Promise.all(platformPromises);

  const fetchedAt = new Date();
  if (collected.length) {
    setMemCache(cacheKey, collected, fetchedAt);
    const canonicals = groupSearchResults(collected);
    setDbCache(cacheKey, collected, fetchedAt, canonicals.map(c => c.id));

    // Fire-and-forget price history persistence
    const snapshots: SnapshotInput[] = canonicals.flatMap(c =>
      c.offers.map(o => ({
        canonicalId:   c.id,
        platform:      o.platform,
        productId:     o.platformProductId,
        price:         o.price,
        originalPrice: o.originalPrice,
        discount:      o.discount,
        fetchedAt,
        rating:        o.rating,
      }))
    );
    saveBulkSnapshots(snapshots).catch(() => { /* non-fatal */ });
    // Evaluate price alerts fire-and-forget after live prices are fetched
    for (const c of canonicals) {
      const lowestPrice = c.offers[0]?.price;
      if (lowestPrice) evaluateAlerts(c.id, lowestPrice).catch(() => {});
    }

    // Fire-and-forget: warm trending cache for landing page speed
    if (!fastOnly) getTrending().catch(() => {});

    return { canonicals, meta: liveCacheMeta() };
  }

  return { canonicals: groupSearchResults(collected), meta: liveCacheMeta() };
}

export { getMemCached, getDbCached, normalizeQuery };

export type { CacheMeta } from './cache/policy.js';

// ─── searchProductsWithMeta ───────────────────────────────────────────────────
// Returns both the canonical products AND cache metadata.
// Used by the handler to attach freshness info to every API response.

export async function searchProductsWithMeta(
  query: string,
  bypassCache = false,
  fastOnly = false,
): Promise<{ canonicals: ReturnType<typeof groupSearchResults>; meta: CacheMeta }> {
  const cacheKey = normalizeQuery(query);
  const searchTerm = query.toLowerCase().trim();

  if (!bypassCache) {
    const mem = getMemCached(cacheKey);
    if (mem) {
      recordCacheHit('memory', cacheKey);
      return { canonicals: groupSearchResults(mem.data), meta: mem.meta };
    }
    const db = await getDbCached(cacheKey);
    if (db) {
      setMemCache(cacheKey, db.data, new Date(db.meta.fetchedAt));
      recordCacheHit('mongodb', cacheKey);
      return { canonicals: groupSearchResults(db.data), meta: db.meta };
    }
  }

  // In-flight dedup: if a live scrape is already running for this key, wait for it
  const existing = inFlight.get(cacheKey);
  if (existing) {
    const result = await existing;
    return { canonicals: groupSearchResults(result.data), meta: result.meta };
  }

  recordCacheMiss(cacheKey);

  const scrapePromise = (async (): Promise<{ data: SearchProduct[]; meta: CacheMeta }> => {
    const promises: Promise<SearchProduct[]>[] = [
      withTimeout(fetchAmazonPage(searchTerm, 1), AMAZON_BUDGET_MS),
      withRetry(() => fetchFlipkart(searchTerm), 'Flipkart'),
      withRetry(() => fetchAjio(searchTerm), 'Ajio'),
      withTimeout(fetchMyntra(searchTerm), 30000).catch(() => []),
    ];
    // Skip slow/expensive platforms for secondary searches
    if (!fastOnly) {
      promises.push(
        withTimeout(fetchMeesho(searchTerm), 35000).catch(() => []),
        withTimeout(fetchTataCliq(searchTerm), 30000).catch(() => []),
      );
    }
    const settled = await Promise.all(promises);
    const [az1, fk, aj, mn, ...rest] = settled;
    const ms = rest[0] ?? [];
    const tc = rest[1] ?? [];

    const seenAsins = new Set<string>();
    const dedupedAmazon = az1.filter(p => {
      const asin = p.url.split('/dp/')[1]?.split('?')[0];
      if (!asin || seenAsins.has(asin)) return false;
      seenAsins.add(asin);
      return true;
    });

    const allResults = [...dedupedAmazon, ...fk, ...aj, ...ms, ...mn, ...tc]
      .filter(p => isValidProduct(p))
      .filter(p => isRelevantToQuery(p, searchTerm))
      .map(p => ({ ...p, affiliateUrl: buildAffiliateUrl(p.platform, p.url) }));

    const fetchedAt = new Date();
    if (allResults.length) {
      setMemCache(cacheKey, allResults, fetchedAt);
      const canonicals = groupSearchResults(allResults);
      setDbCache(cacheKey, allResults, fetchedAt, canonicals.map(c => c.id));

      // Fire-and-forget: persist price snapshots without blocking the response.
      const snapshots: SnapshotInput[] = canonicals.flatMap(c =>
        c.offers.map(o => ({
          canonicalId:   c.id,
          platform:      o.platform,
          productId:     o.platformProductId,
          price:         o.price,
          originalPrice: o.originalPrice,
          discount:      o.discount,
          fetchedAt,
          rating:        o.rating,
        }))
      );
      saveBulkSnapshots(snapshots).catch(() => { /* non-fatal */ });
      // Evaluate price alerts fire-and-forget
      for (const c of canonicals) {
        const lowestPrice = c.offers[0]?.price;
        if (lowestPrice) evaluateAlerts(c.id, lowestPrice).catch(() => {});
      }
    }

    // Fire-and-forget: warm trending cache for landing page speed
    if (!fastOnly) getTrending().catch(() => {});

    return { data: allResults, meta: liveCacheMeta() };
  })();

  inFlight.set(cacheKey, scrapePromise);
  try {
    const result = await scrapePromise;
    return { canonicals: groupSearchResults(result.data), meta: result.meta };
  } finally {
    inFlight.delete(cacheKey);
  }
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

export async function getRelatedProducts(query: string): Promise<{ label: string; sections: { query: string; products: CanonicalProduct[] }[] }> {
  const related = findRelated(query);
  if (!related) return { label: 'You may also like', sections: [] };

  const RELATED_TIMEOUT_MS = 12000;
  const sections = await Promise.all(
    related.queries.slice(0, 3).map(async (q) => {
      const products = await withTimeout(searchProducts(q, true), RELATED_TIMEOUT_MS).catch(() => []);
      return { query: q, products: products.slice(0, 4) };
    })
  );

  return {
    label: related.label,
    sections: sections.filter(s => s.products.length > 0),
  };
}

const TRENDING_QUERIES = ['kurta sets women', 'sneakers men india', 'sarees silk', 'watches men under 5000'];

export async function getTrending(): Promise<CanonicalProduct[]> {
  const cacheKey = 'trending';
  const mem = getMemCached(cacheKey);
  if (mem) return groupSearchResults(mem.data);
  const db = await getDbCached(cacheKey);
  if (db) { setMemCache(cacheKey, db.data, new Date(db.meta.fetchedAt)); return groupSearchResults(db.data); }

  // Fetch all trending queries, collect flat products, then group once
  const TRENDING_TIMEOUT_MS = 15000;
  const allFlat = (await Promise.all(
    TRENDING_QUERIES.map(q =>
      withTimeout(searchProducts(q, true), TRENDING_TIMEOUT_MS)
        .then(canonicals => canonicals.flatMap(c => c.offers.map(o => o.originalProduct)))
        .catch(() => [] as SearchProduct[])
    )
  )).flat();

  const seen = new Set<string>();
  const unique = allFlat.filter(p => {
    const k = p.title.toLowerCase().slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  setMemCache(cacheKey, unique);
  setDbCache(cacheKey, unique);
  return groupSearchResults(unique).slice(0, 24);
}
