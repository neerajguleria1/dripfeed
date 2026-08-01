/**
 * Shared types for the content-first homepage feed.
 * These mirror the API response shapes from /api/feed/home and /api/feed/discover.
 */

/** Client-side DTO for a product in the home feed */
export interface HomeFeedProduct {
  id: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  /** Pre-computed discount percentage */
  discount: number;
  /** Absolute savings in INR — only present when originalPrice - price > 200 */
  savings?: number;
  platform: string;
  url?: string;
  category?: string;
}

/** Response shape from GET /api/feed/home */
export interface HomeFeedResponse {
  products: HomeFeedProduct[];
  source: 'deals' | 'trending' | 'seed';
  cachedAt: string;
  geo: {
    country: string;
    isIndia: boolean;
  };
}

/** Response shape from GET /api/feed/discover */
export interface DiscoverFeedResponse {
  sections: FeedSection[];
  page: number;
  hasMore: boolean;
  totalPages: number;
}

/** A titled group of products in the discovery feed */
export interface FeedSection {
  id: string;
  title: string;
  products: HomeFeedProduct[];
}

/** A category chip item for homepage filtering */
export interface CategoryItem {
  id: string;
  label: string;
  query: string;
}

/** State shape for the discovery feed (used by useDiscoveryFeed hook) */
export interface FeedState {
  sections: FeedSection[];
  page: number;
  hasMore: boolean;
  loading: boolean;
}
