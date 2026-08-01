/**
 * Mappers for converting various data sources into the unified HomeFeedProduct
 * DTO used by the content-first homepage feed endpoints.
 */

import type { SeedProduct } from '../seed-data';

// ─── HomeFeedProduct type (duplicated from src/types/homeFeed.ts for server-side use) ───

export interface HomeFeedProduct {
  id: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  discount: number;
  savings?: number;
  platform: string;
  url?: string;
  category?: string;
}

// ─── API Types (mirrored from src/utils/homeDealsMapping.ts for server-side use) ───

export interface DealApiItem {
  id: string;
  productTitle: string;
  brand?: string;
  imageUrl?: string;
  platform: string;
  currentPrice: number;
  previousPrice?: number;
  dropPercentage: number;
  url: string;
  detectedAt?: string;
  trackersCount?: number;
}

export interface TrendingApiItem {
  id: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  platform: string;
  url: string;
}

// ─── Mapper: Seed Data → HomeFeedProduct ─────────────────────────────────────

/**
 * Maps a SeedProduct (with multiple platform entries) to a single HomeFeedProduct
 * by selecting the cheapest platform and computing discount & savings from the
 * most expensive original price across all platforms.
 */
export function mapSeedToHomeFeed(seed: SeedProduct): HomeFeedProduct {
  const cheapest = seed.platforms.reduce((min, p) => p.price < min.price ? p : min);
  const mostExpensive = seed.platforms.reduce((max, p) =>
    (p.originalPrice || p.price) > (max.originalPrice || max.price) ? p : max
  );

  const originalPrice = mostExpensive.originalPrice || mostExpensive.price;
  const savings = originalPrice - cheapest.price;
  const discount = originalPrice > cheapest.price
    ? Math.round((originalPrice - cheapest.price) / originalPrice * 100)
    : 0;

  return {
    id: `seed_${seed.title.toLowerCase().replace(/\s+/g, '_').slice(0, 32)}`,
    title: seed.title,
    brand: seed.brand,
    imageUrl: seed.imageUrl,
    price: cheapest.price,
    originalPrice: originalPrice,
    discount,
    savings: savings > 200 ? savings : undefined,
    platform: cheapest.platform,
    url: cheapest.url,
    category: seed.category,
  };
}

// ─── Mapper: Deal API → HomeFeedProduct ──────────────────────────────────────

/**
 * Maps a DealApiItem (from /products/deals) to HomeFeedProduct.
 * Uses currentPrice as the price, previousPrice as originalPrice,
 * and dropPercentage as the pre-computed discount.
 */
export function mapDealApiToHomeFeed(deal: DealApiItem): HomeFeedProduct {
  const savings = deal.previousPrice
    ? deal.previousPrice - deal.currentPrice
    : 0;

  return {
    id: deal.id,
    title: deal.productTitle,
    brand: deal.brand,
    imageUrl: deal.imageUrl,
    price: deal.currentPrice,
    originalPrice: deal.previousPrice,
    discount: deal.dropPercentage,
    savings: savings > 200 ? savings : undefined,
    platform: deal.platform,
    url: deal.url,
  };
}

// ─── Mapper: Trending API → HomeFeedProduct ──────────────────────────────────

/**
 * Maps a TrendingApiItem (from /products/trending) to HomeFeedProduct.
 * Computes discount from originalPrice/price if not pre-provided.
 */
export function mapTrendingApiToHomeFeed(item: TrendingApiItem): HomeFeedProduct {
  const discount = item.discount ??
    (item.originalPrice && item.originalPrice > item.price
      ? Math.round((item.originalPrice - item.price) / item.originalPrice * 100)
      : 0);

  const savings = item.originalPrice
    ? item.originalPrice - item.price
    : 0;

  return {
    id: item.id,
    title: item.title,
    brand: item.brand,
    imageUrl: item.imageUrl,
    price: item.price,
    originalPrice: item.originalPrice,
    discount,
    savings: savings > 200 ? savings : undefined,
    platform: item.platform,
    url: item.url,
  };
}
