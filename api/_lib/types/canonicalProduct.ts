import type { SearchProduct } from './searchProduct.js';

export interface Offer {
  readonly platform: string;
  readonly platformProductId: string;
  readonly title: string;
  readonly price: number;
  readonly originalPrice: number | undefined;
  readonly discount: number | undefined;
  readonly imageUrl: string;
  readonly productUrl: string;
  /** Affiliate-wrapped URL — use this for all outbound links */
  readonly affiliateUrl: string | undefined;
  readonly color: string | undefined;
  readonly size: string | undefined;
  readonly rating: number | undefined;
  readonly originalProduct: SearchProduct;
}

export interface CanonicalProduct {
  readonly id: string;
  readonly title: string;
  readonly brand: string | undefined;
  readonly offers: readonly Offer[];
  readonly offerCount: number;
  /** 0–1 confidence that all offers in this canonical represent the same product. */
  readonly confidence: number;
}
