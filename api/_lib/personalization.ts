import type { IProduct } from './models/Product.js';
import type { IUserPreferences } from './models/UserPreferences.js';

// --- Public Interfaces ---

export interface ProductData {
  title: string;
  brand?: string;
  category?: string;
  price: number;
  platform: string;
  url: string;
  imageUrl?: string;
  createdAt?: Date;
}

export interface UserPrefs {
  categories: string[];
  brands: string[];
  priceRange: { min: number; max: number };
}

export interface SearchEntry {
  query: string;
  timestamp: Date;
}

export interface ScoredProduct extends ProductData {
  score: number;
  reason: string;
}

// --- Scoring Weights ---
const WEIGHT_CATEGORY = 0.35;
const WEIGHT_BRAND = 0.25;
const WEIGHT_PRICE = 0.20;
const WEIGHT_SEARCH = 0.15;
const WEIGHT_RECENCY = 0.05;

const RECENCY_WINDOW_DAYS = 7;

/**
 * Calculate a relevance score for a product based on user preferences and search history.
 * Pure function — no side effects.
 *
 * Scoring weights:
 *  - Category match: 0.35
 *  - Brand match: 0.25
 *  - Price range match: 0.20
 *  - Search history match: 0.15
 *  - Recency boost: 0.05
 */
export function calculateRelevanceScore(
  product: ProductData,
  preferences: UserPrefs,
  searchHistory: SearchEntry[]
): { score: number; reason: string } {
  let score = 0;
  let matchedCategory: string | undefined;
  let matchedBrand: string | undefined;
  let matchedSearchQuery: string | undefined;

  // Category match: 0.35
  if (product.category && preferences.categories.length > 0) {
    matchedCategory = preferences.categories.find(
      (cat) => product.category!.toLowerCase().includes(cat.toLowerCase())
    );
    if (matchedCategory) {
      score += WEIGHT_CATEGORY;
    }
  }

  // Brand match: 0.25
  if (product.brand && preferences.brands.length > 0) {
    matchedBrand = preferences.brands.find(
      (brand) => product.brand!.toLowerCase() === brand.toLowerCase()
    );
    if (matchedBrand) {
      score += WEIGHT_BRAND;
    }
  }

  // Price range match: 0.20
  const { min, max } = preferences.priceRange;
  if (product.price >= min && product.price <= max) {
    score += WEIGHT_PRICE;
  }

  // Search history match: 0.15
  if (searchHistory.length > 0 && product.title) {
    const titleLower = product.title.toLowerCase();
    const brandLower = product.brand?.toLowerCase() || '';
    const matchedEntry = searchHistory.find((entry) => {
      const queryLower = entry.query.toLowerCase();
      return titleLower.includes(queryLower) || brandLower.includes(queryLower);
    });
    if (matchedEntry) {
      score += WEIGHT_SEARCH;
      matchedSearchQuery = matchedEntry.query;
    }
  }

  // Recency boost: 0.05 (product created within last 7 days)
  if (product.createdAt) {
    const ageInDays = (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays <= RECENCY_WINDOW_DAYS) {
      score += WEIGHT_RECENCY;
    }
  }

  // Determine reason — priority: category > brand > search > fallback
  let reason: string;
  if (matchedCategory) {
    reason = `Based on your interest in ${matchedCategory}`;
  } else if (matchedBrand) {
    reason = `You follow ${matchedBrand}`;
  } else if (matchedSearchQuery) {
    reason = `Similar to your search "${matchedSearchQuery}"`;
  } else {
    reason = 'Trending in your area';
  }

  return { score: Math.min(score, 1), reason };
}

/**
 * Score an array of products, sort by score descending, and shuffle within score bands
 * (products with similar scores ±0.05 get random order for variety).
 */
export function scoreAndSortProducts(
  products: ProductData[],
  preferences: UserPrefs,
  searchHistory: SearchEntry[]
): ScoredProduct[] {
  // Score all products
  const scored: ScoredProduct[] = products.map((product) => {
    const { score, reason } = calculateRelevanceScore(product, preferences, searchHistory);
    return { ...product, score, reason };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Shuffle within score bands (products within ±0.05 of each other)
  const BAND_THRESHOLD = 0.05;
  const result: ScoredProduct[] = [];
  let bandStart = 0;

  for (let i = 1; i <= scored.length; i++) {
    // End of array or score difference exceeds threshold
    if (i === scored.length || scored[bandStart].score - scored[i].score > BAND_THRESHOLD) {
      // Shuffle the band [bandStart, i)
      const band = scored.slice(bandStart, i);
      shuffleArray(band);
      result.push(...band);
      bandStart = i;
    }
  }

  return result;
}

/** Fisher-Yates shuffle — mutates in place */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --- Adapter: Convert IProduct to ProductData ---

export function productToProductData(product: IProduct & { createdAt?: Date; cachedAt?: Date }): ProductData {
  const firstPlatform = product.platforms?.[0];
  return {
    title: product.title,
    brand: product.brand,
    category: product.category,
    price: firstPlatform?.price ?? 0,
    platform: firstPlatform?.platform ?? 'unknown',
    url: firstPlatform?.url ?? '',
    imageUrl: product.imageUrl,
    createdAt: (product as any).createdAt || product.cachedAt,
  };
}

/** Adapter to convert IUserPreferences to the pure UserPrefs interface */
export function prefsToUserPrefs(prefs: IUserPreferences): UserPrefs {
  return {
    categories: prefs.categories || [],
    brands: prefs.brands || [],
    priceRange: prefs.priceRange || { min: 0, max: 10000 },
  };
}
