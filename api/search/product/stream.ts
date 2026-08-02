/**
 * api/search/product/stream.ts
 *
 * Vercel serverless function that streams search results via Server-Sent Events (SSE).
 *
 * Cache strategy (stale-while-revalidate):
 *   - Fresh (< 30 min): serve from cache immediately, emit done.
 *   - Stale (30 min – 7 days): serve cached results immediately, trigger background refresh.
 *   - Miss (> 7 days or absent): scrape all platforms in parallel, emit per-platform as results arrive.
 *
 * SSE event types:
 *   - platform_products: { platform: string, products: ValidatedProduct[] }
 *   - done: {}
 *   - error: { message: string }
 *
 * Requirements: 2.1, 2.2, 2.5, 2.7, 2.8
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../../_lib/db.js';
import SearchCache from '../../_lib/models/SearchCache.js';
import {
  searchProductsStreaming,
  normalizeQuery,
  getMemCached,
} from '../../_lib/search.js';
import type { SearchProduct } from '../../_lib/types/searchProduct.js';
import { validateProduct } from '../../../src/utils/validateProduct.js';
import type { ValidatedProduct } from '../../../src/utils/validateProduct.js';

export const config = { maxDuration: 60, regions: ['bom1'] };

// ─── Constants ────────────────────────────────────────────────────────────────

const FRESH_TTL_MS = 30 * 60 * 1000;       // 30 minutes
const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_QUERY_LENGTH = 2;

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sendSSE(res: VercelResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sendError(res: VercelResponse, message: string): void {
  sendSSE(res, 'error', { message });
  sendSSE(res, 'done', {});
  res.end();
}

// ─── Product transformation ───────────────────────────────────────────────────

/**
 * Converts raw SearchProduct[] into ValidatedProduct[] grouped by platform.
 * Each product is validated through validateProduct() — invalid products are dropped.
 */
function toValidatedProducts(products: SearchProduct[]): ValidatedProduct[] {
  const validated: ValidatedProduct[] = [];

  for (const p of products) {
    // Transform SearchProduct into the shape validateProduct() expects
    const raw = {
      id: p.id,
      title: p.title,
      brand: p.brand,
      imageUrl: p.imageUrl,
      offers: [{
        platform: mapPlatformName(p.platform),
        price: p.price,
        originalPrice: p.originalPrice,
        url: p.url,
        affiliateUrl: p.affiliateUrl,
        imageUrl: p.imageUrl,
      }],
    };

    const result = validateProduct(raw);
    if (result) validated.push(result);
  }

  return validated;
}

/**
 * Maps the platform name from SearchProduct format (e.g. "Amazon India", "Flipkart")
 * to the PlatformOffer format (e.g. "amazon", "flipkart").
 */
function mapPlatformName(platform: string): string {
  const map: Record<string, string> = {
    'Amazon India': 'amazon',
    'Amazon': 'amazon',
    'Flipkart': 'flipkart',
    'Myntra': 'myntra',
    'Meesho': 'meesho',
    'Ajio': 'ajio',
  };
  return map[platform] ?? platform.toLowerCase();
}

/**
 * Determines the display platform name from SearchProduct[] for SSE events.
 */
function getPlatformDisplayName(platform: string): string {
  const map: Record<string, string> = {
    'amazon': 'amazon',
    'flipkart': 'flipkart',
    'myntra': 'myntra',
    'meesho': 'meesho',
    'ajio': 'ajio',
    'cache': 'cache',
  };
  return map[platform.toLowerCase()] ?? platform.toLowerCase();
}

// ─── Cache age helpers ────────────────────────────────────────────────────────

interface CacheEntry {
  data: SearchProduct[];
  fetchedAt: Date;
}

/**
 * Check the in-memory LRU cache and MongoDB SearchCache for existing results.
 * Returns the cache entry with age classification.
 */
async function checkCache(query: string): Promise<{
  entry: CacheEntry | null;
  status: 'fresh' | 'stale' | 'miss';
}> {
  const cacheKey = normalizeQuery(query);

  // Check in-memory LRU first (using the existing getMemCached which has its own TTL)
  // We need raw access for age-based logic, so check the search module's exported helpers
  const memResult = getMemCached(cacheKey);
  if (memResult) {
    const ageMs = Date.now() - new Date(memResult.meta.fetchedAt).getTime();
    if (ageMs < FRESH_TTL_MS) {
      return { entry: { data: memResult.data, fetchedAt: new Date(memResult.meta.fetchedAt) }, status: 'fresh' };
    }
    if (ageMs < STALE_TTL_MS) {
      return { entry: { data: memResult.data, fetchedAt: new Date(memResult.meta.fetchedAt) }, status: 'stale' };
    }
    // Expired (> 7 days) — treat as miss
    return { entry: null, status: 'miss' };
  }

  // Check MongoDB SearchCache
  try {
    await connectDB();
    const doc = await SearchCache.findOne({ query: cacheKey }).lean();
    if (doc) {
      const fetchedAt = new Date(doc.fetchedAt ?? doc.cachedAt);
      const ageMs = Date.now() - fetchedAt.getTime();

      if (ageMs < FRESH_TTL_MS) {
        return { entry: { data: doc.results as SearchProduct[], fetchedAt }, status: 'fresh' };
      }
      if (ageMs < STALE_TTL_MS) {
        return { entry: { data: doc.results as SearchProduct[], fetchedAt }, status: 'stale' };
      }
    }
  } catch {
    // DB error — treat as cache miss, proceed to live scrape
  }

  return { entry: null, status: 'miss' };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract and validate query param
  const q = (req.query.q as string || '').trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return res.status(400).json({ error: `Query must be at least ${MIN_QUERY_LENGTH} characters` });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200);

  try {
    const { entry, status } = await checkCache(q);

    // ─── Fresh cache hit (< 30 min) ───────────────────────────────────────
    if (status === 'fresh' && entry) {
      const validated = toValidatedProducts(entry.data);
      if (validated.length > 0) {
        sendSSE(res, 'platform_products', {
          platform: 'cache',
          products: validated,
        });
      }
      sendSSE(res, 'done', {});
      res.end();
      return;
    }

    // ─── Stale cache (30 min – 7 days) ────────────────────────────────────
    if (status === 'stale' && entry) {
      // Emit cached results immediately
      const validated = toValidatedProducts(entry.data);
      if (validated.length > 0) {
        sendSSE(res, 'platform_products', {
          platform: 'cache',
          products: validated,
        });
      }

      // Trigger background refresh (fire-and-forget, don't block the response)
      // Use searchProductsStreaming with skipCacheCheck=true to force a live scrape
      searchProductsStreaming(
        q,
        () => {}, // Discard per-platform callbacks during background refresh
        true,     // skipCacheCheck — force live scrape
        false,    // not fastOnly
      ).catch(() => { /* non-fatal — stale data is still valid */ });

      sendSSE(res, 'done', {});
      res.end();
      return;
    }

    // ─── Cache miss — live scrape with streaming ──────────────────────────
    await searchProductsStreaming(
      q,
      (platform: string, products: SearchProduct[]) => {
        const platformName = getPlatformDisplayName(platform);
        const validated = toValidatedProducts(products);
        if (validated.length > 0) {
          sendSSE(res, 'platform_products', {
            platform: platformName,
            products: validated,
          });
        }
      },
      true,  // skipCacheCheck — we already checked above
      false, // not fastOnly — scrape all platforms
    );

    sendSSE(res, 'done', {});
    res.end();
  } catch (err: any) {
    const message = err?.message || 'An unexpected error occurred';
    sendError(res, message);
  }
}
