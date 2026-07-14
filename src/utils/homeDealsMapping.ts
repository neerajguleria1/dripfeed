import type { DealData } from '../types/product';

// ─── API Types ───────────────────────────────────────────────────────────────

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

// ─── Mapping Helpers ─────────────────────────────────────────────────────────

export function mapDealApiToDealData(d: DealApiItem): DealData {
  return {
    id: d.id,
    title: d.productTitle,
    brand: d.brand,
    imageUrl: d.imageUrl,
    price: d.currentPrice,
    originalPrice: d.previousPrice,
    discount: d.dropPercentage,
    platform: d.platform,
    url: d.url,
  };
}

export function mapTrendingApiToDealData(t: TrendingApiItem): DealData {
  return {
    id: t.id,
    title: t.title,
    brand: t.brand,
    imageUrl: t.imageUrl,
    price: t.price,
    originalPrice: t.originalPrice,
    discount: t.discount ?? 0,
    platform: t.platform,
    url: t.url,
  };
}
