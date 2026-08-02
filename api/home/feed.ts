// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../_lib/db.js';
import SearchCache from '../_lib/models/SearchCache.js';
import { searchProducts } from '../_lib/search.js';
import { LRUCache } from '../_lib/lruCache.js';
import { validateProduct } from '../../src/utils/validateProduct.js';
import type { ValidatedProduct } from '../../src/utils/validateProduct.js';

// ─── Configuration ────────────────────────────────────────────────────────────

export const config = { maxDuration: 60, regions: ['bom1'] };

const PAGE_SIZE = 20;

/** LRU cache: 30-minute TTL, max 1000 entries (per design doc). */
const FEED_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface FeedCacheEntry {
  products: ValidatedProduct[];
  fetchedAt: number;
}

const feedCache = new LRUCache<string, FeedCacheEntry>({ maxSize: 1000, ttlMs: FEED_CACHE_TTL_MS });

// ─── Category → search query mapping ─────────────────────────────────────────

const CATEGORY_QUERIES: Record<string, string> = {
  all: 'trending fashion',
  women: 'women kurta dress',
  men: 'men shirt casual',
  kids: 'kids clothing',
  ethnic: 'ethnic wear saree',
  western: 'western dress tops',
  footwear: 'shoes sneakers',
  accessories: 'bags watches accessories',
};

function categoryToQuery(category: string): string {
  if (!category || category === 'all') return CATEGORY_QUERIES.all;
  return CATEGORY_QUERIES[category.toLowerCase()] || category;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const category = (req.query.category as string) || 'all';
    const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
    const searchQuery = categoryToQuery(category);
    const cacheKey = `home_feed:${searchQuery}`;

    // ── Layer 1: In-memory LRU cache ──────────────────────────────────────────
    const memEntry = feedCache.get(cacheKey);
    if (memEntry) {
      const age = Date.now() - memEntry.fetchedAt;
      if (age < FEED_CACHE_TTL_MS) {
        // Fresh cache — serve directly
        return respondWithProducts(res, memEntry.products, offset);
      }
    }

    // ── Layer 2: MongoDB SearchCache ──────────────────────────────────────────
    await connectDB();
    const dbDoc = await SearchCache.findOne({ query: searchQuery }).lean();

    if (dbDoc && dbDoc.results && Array.isArray(dbDoc.results)) {
      const fetchedAt = dbDoc.fetchedAt ?? dbDoc.cachedAt;
      const age = Date.now() - new Date(fetchedAt).getTime();

      if (age < STALE_THRESHOLD_MS) {
        // Valid DB cache (< 7 days) — validate products and serve
        const validated = validateResults(dbDoc.results);
        // Store in memory cache for subsequent requests
        feedCache.set(cacheKey, { products: validated, fetchedAt: new Date(fetchedAt).getTime() });

        // If stale (> 30 min), trigger background refresh (non-blocking)
        if (age > FEED_CACHE_TTL_MS) {
          refreshInBackground(searchQuery, cacheKey).catch(() => {});
        }

        return respondWithProducts(res, validated, offset);
      }
    }

    // ── Layer 3: Live scrape ──────────────────────────────────────────────────
    const canonicals = await searchProducts(searchQuery, true); // fastOnly=true for homepage speed

    // Convert canonical products to raw format for validation
    const validated = validateCanonicals(canonicals);

    if (validated.length > 0) {
      // Cache validated results
      feedCache.set(cacheKey, { products: validated, fetchedAt: Date.now() });
    }

    // Always return array — never seed data
    return respondWithProducts(res, validated, offset);
  } catch (error: any) {
    console.error('[home/feed] Error:', error?.message?.slice(0, 200));
    // Return empty products on error — never fall back to seed data
    return res.status(200).json({
      products: [],
      hasMore: false,
      total: 0,
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Apply validateProduct() to every result. Only validated products are returned.
 * Never falls back to seed data.
 */
function validateResults(rawResults: any[]): ValidatedProduct[] {
  const validated: ValidatedProduct[] = [];

  for (const raw of rawResults) {
    // SearchProduct → format expected by validateProduct
    const toValidate = {
      id: raw.id,
      title: raw.title,
      brand: raw.brand,
      imageUrl: raw.imageUrl,
      offers: raw.offers ?? [{
        platform: normalizePlatform(raw.platform),
        price: raw.price,
        originalPrice: raw.originalPrice,
        url: raw.url,
        affiliateUrl: raw.affiliateUrl,
        imageUrl: raw.imageUrl,
      }],
    };

    const product = validateProduct(toValidate);
    if (product) {
      validated.push(product);
    }
  }

  return validated;
}

/**
 * Convert CanonicalProduct[] from searchProducts() into ValidatedProduct[].
 * CanonicalProduct shape: { id, title, brand, offers: Offer[], offerCount }
 * Offer shape: { platform, price, originalPrice, imageUrl, productUrl, affiliateUrl }
 */
function validateCanonicals(canonicals: any[]): ValidatedProduct[] {
  const validated: ValidatedProduct[] = [];

  for (const canonical of canonicals) {
    // CanonicalProduct.offers[] — each offer is a platform listing
    const offers = (canonical.offers || []).map((offer: any) => ({
      platform: normalizePlatform(offer.platform),
      price: offer.price,
      originalPrice: offer.originalPrice,
      url: offer.productUrl || offer.url,
      affiliateUrl: offer.affiliateUrl,
      imageUrl: offer.imageUrl,
    }));

    if (offers.length === 0) continue;

    const toValidate = {
      id: canonical.id,
      title: canonical.title,
      brand: canonical.brand,
      imageUrl: offers[0]?.imageUrl,
      offers,
    };

    const product = validateProduct(toValidate);
    if (product) {
      validated.push(product);
    }
  }

  return validated;
}

/**
 * Normalize platform names to the lowercase format expected by validateProduct.
 */
function normalizePlatform(platform: string | undefined): string {
  if (!platform) return 'flipkart';
  const lower = platform.toLowerCase().replace(/\s+/g, '');
  if (lower.includes('flipkart')) return 'flipkart';
  if (lower.includes('myntra')) return 'myntra';
  if (lower.includes('amazon')) return 'amazon';
  if (lower.includes('meesho')) return 'meesho';
  if (lower.includes('ajio')) return 'ajio';
  return 'flipkart';
}

/**
 * Paginate validated products and respond with the standard format.
 */
function respondWithProducts(
  res: VercelResponse,
  allProducts: ValidatedProduct[],
  offset: number,
) {
  const total = allProducts.length;
  const page = allProducts.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < total;

  return res.status(200).json({
    products: page,
    hasMore,
    total,
  });
}

/**
 * Background refresh: fetch fresh data and update caches without blocking the response.
 */
async function refreshInBackground(searchQuery: string, cacheKey: string): Promise<void> {
  try {
    const canonicals = await searchProducts(searchQuery, true);
    const validated = validateCanonicals(canonicals);
    if (validated.length > 0) {
      feedCache.set(cacheKey, { products: validated, fetchedAt: Date.now() });
    }
  } catch {
    // Non-fatal — stale data continues to be served
  }
}
