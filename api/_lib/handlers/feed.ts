// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../db.js';
import { getUserFromRequest } from '../auth.js';
import UserPreferences from '../models/UserPreferences.js';
import Product from '../models/Product.js';
import Deal from '../models/Deal.js';
import {
  scoreAndSortProducts,
  productToProductData,
  prefsToUserPrefs,
} from '../personalization.js';
import type { ScoredProduct } from '../personalization.js';
import { cacheGet, cacheSet, CACHE_CONFIG } from '../cache.js';
import {
  mapDealApiToHomeFeed,
  mapTrendingApiToHomeFeed,
  mapSeedToHomeFeed,
} from '../mappers/homeFeed.js';
import type { HomeFeedProduct } from '../mappers/homeFeed.js';
import { SEED_PRODUCTS, SEED_PRODUCTS_EXTENDED, SEED_PRODUCTS_PREMIUM } from '../seed-data.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const HOME_FEED_MIN_PRODUCTS = 8;
const HOME_FEED_MAX_PRODUCTS = 12;

// Discovery Feed constants
const DISCOVER_MAX_PAGES = 5;
const DISCOVER_PRODUCTS_PER_PAGE = 12;

/** Themed section definitions — one per page */
const DISCOVER_SECTION_THEMES: { id: string; title: string }[] = [
  { id: 'todays-deals', title: "Today's Deals" },
  { id: 'trending-now', title: 'Trending Now' },
  { id: 'under-999', title: 'Under ₹999' },
  { id: 'ethnic-favorites', title: 'Ethnic Favorites' },
  { id: 'best-discounts', title: 'Best Discounts' },
];

// ─── Home Feed ────────────────────────────────────────────────────────────────

interface HomeFeedCacheData {
  products: HomeFeedProduct[];
  source: 'deals' | 'trending' | 'seed';
  cachedAt: string;
}

async function home(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Geo detection from Vercel edge header
  const country = (req.headers['x-vercel-ip-country'] as string) || 'IN';
  const isIndia = country.toUpperCase() === 'IN';

  // Category from query params (used as cache key differentiator)
  const category = (req.query?.category as string) || 'all';
  const cacheKey = `home_feed_${category}`;

  // Check LRU cache
  const cached = cacheGet<HomeFeedCacheData>(cacheKey);
  if (cached) {
    // Serve cached data immediately
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    // Trigger background revalidation (non-blocking)
    revalidateHomeFeed(category, cacheKey).catch(() => {});
    return res.json({
      products: cached.products,
      source: cached.source,
      cachedAt: cached.cachedAt,
      geo: { country, isIndia },
    });
  }

  // Cache miss — fetch fresh data
  try {
    const result = await fetchHomeFeedData(category);
    const cacheData: HomeFeedCacheData = {
      products: result.products,
      source: result.source,
      cachedAt: new Date().toISOString(),
    };

    // Store in LRU cache
    cacheSet(cacheKey, cacheData, CACHE_CONFIG.homeFeed.ttl);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.json({
      products: cacheData.products,
      source: cacheData.source,
      cachedAt: cacheData.cachedAt,
      geo: { country, isIndia },
    });
  } catch (e: any) {
    // Final fallback: seed products (never fail the user)
    const seedProducts = SEED_PRODUCTS
      .map(mapSeedToHomeFeed)
      .sort((a, b) => b.discount - a.discount)
      .slice(0, HOME_FEED_MAX_PRODUCTS);

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.json({
      products: seedProducts,
      source: 'seed' as const,
      cachedAt: new Date().toISOString(),
      geo: { country, isIndia },
    });
  }
}

/**
 * Fetch home feed data with the fallback chain:
 * 1. Deals (sorted by discount descending)
 * 2. Trending products
 * 3. Seed products (static fallback)
 */
async function fetchHomeFeedData(category: string): Promise<{ products: HomeFeedProduct[]; source: 'deals' | 'trending' | 'seed' }> {
  await connectDB();

  // ─── Try deals first ────────────────────────────────────────────────────────
  try {
    const dealFilter: Record<string, unknown> = { active: true };
    if (category && category !== 'all') {
      dealFilter.category = { $regex: category, $options: 'i' };
    }

    const dealsList = await Deal.find(dealFilter)
      .select('productTitle brand imageUrl platform currentPrice previousPrice dropPercentage url detectedAt trackersCount')
      .sort({ dropPercentage: -1 })
      .limit(HOME_FEED_MAX_PRODUCTS)
      .lean();

    if (dealsList.length >= HOME_FEED_MIN_PRODUCTS) {
      const products = dealsList.map((d: any) => mapDealApiToHomeFeed({
        id: String(d._id),
        productTitle: d.productTitle,
        brand: d.brand,
        imageUrl: d.imageUrl,
        platform: d.platform,
        currentPrice: d.currentPrice,
        previousPrice: d.previousPrice,
        dropPercentage: d.dropPercentage,
        url: d.url,
        detectedAt: d.detectedAt,
        trackersCount: d.trackersCount,
      }));

      // Sort by highest discount descending
      products.sort((a, b) => b.discount - a.discount);

      return { products: products.slice(0, HOME_FEED_MAX_PRODUCTS), source: 'deals' };
    }
  } catch {
    // Fall through to trending
  }

  // ─── Fallback: trending products ────────────────────────────────────────────
  try {
    const trendingFilter: Record<string, unknown> = {};
    if (category && category !== 'all') {
      trendingFilter.category = category;
    }

    const trendingProducts = await Product.find(trendingFilter)
      .sort({ updatedAt: -1 })
      .limit(HOME_FEED_MAX_PRODUCTS)
      .lean();

    if (trendingProducts.length >= HOME_FEED_MIN_PRODUCTS) {
      const products = trendingProducts.map((p: any) => mapTrendingApiToHomeFeed({
        id: String(p._id),
        title: p.title,
        brand: p.brand,
        imageUrl: p.imageUrl,
        price: p.platforms?.[0]?.price || 0,
        originalPrice: p.platforms?.[0]?.originalPrice,
        discount: p.platforms?.[0]?.discount,
        platform: p.platforms?.[0]?.platform || '',
        url: p.platforms?.[0]?.url || '',
      }));

      return { products: products.slice(0, HOME_FEED_MAX_PRODUCTS), source: 'trending' };
    }
  } catch {
    // Fall through to seed
  }

  // ─── Final fallback: seed products ──────────────────────────────────────────
  const seedProducts = SEED_PRODUCTS
    .map(mapSeedToHomeFeed)
    .sort((a, b) => b.discount - a.discount)
    .slice(0, HOME_FEED_MAX_PRODUCTS);

  return { products: seedProducts, source: 'seed' };
}

/**
 * Background revalidation — refreshes the cache without blocking the response.
 * Called when serving stale cached data.
 */
async function revalidateHomeFeed(category: string, cacheKey: string): Promise<void> {
  try {
    const result = await fetchHomeFeedData(category);
    const cacheData: HomeFeedCacheData = {
      products: result.products,
      source: result.source,
      cachedAt: new Date().toISOString(),
    };
    cacheSet(cacheKey, cacheData, CACHE_CONFIG.homeFeed.ttl);
  } catch {
    // Silently fail — stale data is still being served
  }
}

// ─── Discover Feed ────────────────────────────────────────────────────────────

async function discover(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Parse query params — page capped at 5
  const pageRaw = parseInt(req.query.page as string) || 1;
  const page = Math.max(1, Math.min(pageRaw, DISCOVER_MAX_PAGES));
  const category = (req.query.category as string) || '';

  // Check LRU cache (key: category + page)
  const cacheKey = `discover_${category}_${page}`;
  const cached = cacheGet<{
    sections: { id: string; title: string; products: HomeFeedProduct[] }[];
    page: number;
    hasMore: boolean;
    totalPages: number;
  }>(cacheKey);

  if (cached) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.json(cached);
  }

  // Gather products from DB or seed fallback
  let products: HomeFeedProduct[] = [];

  try {
    await connectDB();

    // Build DB query with optional category filter
    const query: Record<string, any> = {};
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }

    const skip = (page - 1) * DISCOVER_PRODUCTS_PER_PAGE;
    const rawProducts = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(DISCOVER_PRODUCTS_PER_PAGE)
      .lean();

    if (rawProducts.length > 0) {
      products = rawProducts.map((p: any) => {
        const platforms = p.platforms || [];
        if (platforms.length === 0) {
          return {
            id: String(p._id),
            title: p.title || 'Unknown Product',
            brand: p.brand,
            imageUrl: p.imageUrl,
            price: 0,
            discount: 0,
            platform: 'unknown',
            category: p.category,
          } as HomeFeedProduct;
        }

        const cheapest = platforms.reduce(
          (min: any, plat: any) => (plat.price < min.price ? plat : min),
          platforms[0]
        );
        const mostExpensive = platforms.reduce(
          (max: any, plat: any) =>
            ((plat.originalPrice || plat.price) > (max.originalPrice || max.price) ? plat : max),
          platforms[0]
        );

        const originalPrice = mostExpensive.originalPrice || mostExpensive.price;
        const savings = originalPrice - cheapest.price;
        const discount =
          originalPrice > cheapest.price
            ? Math.round((originalPrice - cheapest.price) / originalPrice * 100)
            : 0;

        return {
          id: String(p._id),
          title: p.title || 'Unknown Product',
          brand: p.brand,
          imageUrl: p.imageUrl,
          price: cheapest.price,
          originalPrice,
          discount,
          savings: savings > 200 ? savings : undefined,
          platform: cheapest.platform,
          url: cheapest.url,
          category: p.category,
        } as HomeFeedProduct;
      });
    }
  } catch {
    // DB unavailable — fall through to seed fallback
  }

  // Fallback to seed data if DB returned nothing
  if (products.length === 0) {
    const allSeeds = [
      ...SEED_PRODUCTS,
      ...(SEED_PRODUCTS_EXTENDED || []),
      ...(SEED_PRODUCTS_PREMIUM || []),
    ];
    let filtered = allSeeds;
    if (category) {
      filtered = allSeeds.filter(
        (s) => s.category.toLowerCase().includes(category.toLowerCase())
      );
      // If category filter yields nothing, use all seeds
      if (filtered.length === 0) filtered = allSeeds;
    }

    const skip = (page - 1) * DISCOVER_PRODUCTS_PER_PAGE;
    const sliced = filtered.slice(skip, skip + DISCOVER_PRODUCTS_PER_PAGE);
    products = sliced.map(mapSeedToHomeFeed);
  }

  // Apply page-specific theming (sort/prioritize products based on section theme)
  const theme = DISCOVER_SECTION_THEMES[page - 1] || DISCOVER_SECTION_THEMES[0];
  let sectionProducts = products;

  switch (theme.id) {
    case 'under-999':
      // Prioritize products under ₹999
      sectionProducts = [...products].sort((a, b) => {
        const aUnder = a.price < 999 ? 0 : 1;
        const bUnder = b.price < 999 ? 0 : 1;
        return aUnder - bUnder || a.price - b.price;
      });
      break;
    case 'best-discounts':
      sectionProducts = [...products].sort((a, b) => b.discount - a.discount);
      break;
    case 'ethnic-favorites':
      // Prioritize ethnic-wear category products
      sectionProducts = [...products].sort((a, b) => {
        const aEthnic = a.category?.toLowerCase().includes('ethnic') ? 0 : 1;
        const bEthnic = b.category?.toLowerCase().includes('ethnic') ? 0 : 1;
        return aEthnic - bEthnic;
      });
      break;
    case 'trending-now':
      // Reverse the default order for variety
      sectionProducts = [...products].reverse();
      break;
    default:
      // "Today's Deals" — sort by highest discount
      sectionProducts = [...products].sort((a, b) => b.discount - a.discount);
      break;
  }

  // Determine if there are more pages available
  const hasMore = page < DISCOVER_MAX_PAGES && sectionProducts.length === DISCOVER_PRODUCTS_PER_PAGE;

  const response = {
    sections: [
      {
        id: theme.id,
        title: theme.title,
        products: sectionProducts,
      },
    ],
    page,
    hasMore,
    totalPages: DISCOVER_MAX_PAGES,
  };

  // Cache the result (5-min TTL, max 50 entries)
  cacheSet(cacheKey, response, CACHE_CONFIG.discoverFeed.ttl);

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.json(response);
}

// ─── Personalized Feed ────────────────────────────────────────────────────────

async function personalized(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await connectDB();

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));

  const preferences = await UserPreferences.findOne({ userId: user.userId }).lean();
  if (!preferences) {
    return res.json({ products: [], hasMore: false, page, noPreferences: true });
  }

  const rawProducts = await Product.find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const productDataList = rawProducts.map((p) => productToProductData(p as any));
  const userPrefs = prefsToUserPrefs(preferences as any);
  const searchHistory = (preferences.searchHistory || []).map((entry: any) => ({
    query: entry.query,
    timestamp: new Date(entry.timestamp),
  }));

  const scored: ScoredProduct[] = scoreAndSortProducts(productDataList, userPrefs, searchHistory);

  const start = (page - 1) * limit;
  const paginated = scored.slice(start, start + limit);
  const hasMore = start + limit < scored.length;

  return res.json({ products: paginated, hasMore, page });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function handleFeed(req: VercelRequest, res: VercelResponse, subpath: string) {
  switch (subpath) {
    case 'home': return home(req, res);
    case 'discover': return discover(req, res);
    case 'personalized': return personalized(req, res);
    default: return res.status(404).json({ error: 'Not found' });
  }
}
