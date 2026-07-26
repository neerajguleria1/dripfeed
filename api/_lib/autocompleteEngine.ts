import { connectDB } from './db.js';
import AnalyticsEvent from './models/AnalyticsEvent.js';
import SearchCache from './models/SearchCache.js';
import { LRUCache } from './lruCache.js';
import type { SearchProduct } from './types/searchProduct.js';

export const AUTOCOMPLETE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
export const POPULAR_LOOKBACK_DAYS = 7;
export const MAX_POPULAR = 8;
export const MAX_PRODUCTS = 5;
export const MAX_BRANDS = 4;
export const MAX_CATEGORIES = 4;

export interface AutocompleteResult {
  popular: PopularSuggestion[];
  products: ProductSuggestion[];
  brands: string[];
  categories: string[];
}

export interface PopularSuggestion {
  query: string;
  count: number;
  /** 'exact' | 'prefix' | 'popular' — drives ranking in the UI */
  matchType: 'exact' | 'prefix' | 'popular';
}

export interface ProductSuggestion {
  title: string;
  brand?: string;
  imageUrl?: string;
  platform: string;
  price: number;
}

// ─── Module-level LRU cache keyed by normalised query ─────────────────────────
// maxSize=200: each entry is small (a few KB of JSON), 200 covers all hot queries
// on a typical session without unbounded growth.
export const _autocompleteCache = new LRUCache<string, AutocompleteResult>({
  maxSize: 200,
  ttlMs: AUTOCOMPLETE_CACHE_TTL_MS,
});

/** Exported for test reset. */
export function _clearAutocompleteCache() {
  _autocompleteCache.clear();
}

function normalise(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Fetch popular queries from AnalyticsEvent.search_performed in the last N days.
 * Groups by query, counts occurrences, sorts by count desc.
 * Returns at most MAX_POPULAR results.
 */
async function fetchPopularQueries(
  q: string,
  limit: number,
): Promise<PopularSuggestion[]> {
  const since = new Date(Date.now() - POPULAR_LOOKBACK_DAYS * 86400 * 1000);
  const norm = normalise(q);

  const pipeline: object[] = [
    {
      $match: {
        event: 'search_performed',
        ts: { $gte: since },
        query: norm.length >= 2 ? { $regex: norm, $options: 'i' } : { $exists: true, $ne: '' },
      },
    },
    { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit * 3 }, // over-fetch so we can rank after
  ];

  const rows: Array<{ _id: string; count: number }> = await AnalyticsEvent.aggregate(pipeline);

  // Rank: exact match first, then prefix, then popularity
  const exact: PopularSuggestion[] = [];
  const prefix: PopularSuggestion[] = [];
  const rest: PopularSuggestion[] = [];

  for (const row of rows) {
    if (!row._id) continue;
    const lower = row._id.toLowerCase();
    if (lower === norm) {
      exact.push({ query: row._id, count: row.count, matchType: 'exact' });
    } else if (lower.startsWith(norm)) {
      prefix.push({ query: row._id, count: row.count, matchType: 'prefix' });
    } else {
      rest.push({ query: row._id, count: row.count, matchType: 'popular' });
    }
  }

  return [...exact, ...prefix, ...rest].slice(0, limit);
}

/**
 * Fetch product/brand/category suggestions from SearchCache.
 * Scans cached results for the query and extracts unique titles, brands, categories.
 */
async function fetchCacheSuggestions(q: string): Promise<{
  products: ProductSuggestion[];
  brands: string[];
  categories: string[];
}> {
  const norm = normalise(q);
  if (norm.length < 2) return { products: [], brands: [], categories: [] };

  // Find cache docs whose query starts with or contains the input
  const docs = await SearchCache.find({
    query: { $regex: norm, $options: 'i' },
  })
    .select('results')
    .limit(3)
    .lean();

  const products: ProductSuggestion[] = [];
  const brandSet = new Set<string>();
  const categorySet = new Set<string>();
  const seenTitles = new Set<string>();

  for (const doc of docs) {
    const results = (doc.results as SearchProduct[]) ?? [];
    for (const p of results) {
      const titleKey = p.title.toLowerCase().slice(0, 40);
      if (!seenTitles.has(titleKey) && p.title.toLowerCase().includes(norm)) {
        seenTitles.add(titleKey);
        products.push({
          title:    p.title,
          brand:    p.brand,
          imageUrl: p.imageUrl,
          platform: p.platform,
          price:    p.price,
        });
      }
      if (p.brand && p.brand.toLowerCase().includes(norm)) {
        brandSet.add(p.brand);
      }
      // Derive category from platform-specific category field if present
      const cat = (p as any).category as string | undefined;
      if (cat && cat.toLowerCase().includes(norm)) {
        categorySet.add(cat);
      }
    }
    if (products.length >= MAX_PRODUCTS && brandSet.size >= MAX_BRANDS) break;
  }

  return {
    products:   products.slice(0, MAX_PRODUCTS),
    brands:     Array.from(brandSet).slice(0, MAX_BRANDS),
    categories: Array.from(categorySet).slice(0, MAX_CATEGORIES),
  };
}

/**
 * Main entry point. Returns ranked autocomplete suggestions for a query.
 * Results are cached in-process for AUTOCOMPLETE_CACHE_TTL_MS.
 */
export async function getAutocompleteSuggestions(
  q: string,
  limit = MAX_POPULAR,
): Promise<AutocompleteResult> {
  const norm = normalise(q);
  const cacheKey = `${norm}:${limit}`;

  const cached = _autocompleteCache.get(cacheKey);
  if (cached) return cached;

  await connectDB();

  const [popularResult, cacheResult] = await Promise.all([
    fetchPopularQueries(norm, limit).catch(() => [] as PopularSuggestion[]),
    fetchCacheSuggestions(norm).catch(() => ({ products: [], brands: [], categories: [] })),
  ]);

  const result: AutocompleteResult = {
    popular:    popularResult,
    products:   cacheResult.products,
    brands:     cacheResult.brands,
    categories: cacheResult.categories,
  };

  _autocompleteCache.set(cacheKey, result);
  return result;
}
