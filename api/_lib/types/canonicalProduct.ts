import type { SearchProduct } from './searchProduct.js';

export interface Offer {
  readonly platform: string;
  readonly platformProductId: string;
  readonly title: string;
  readonly price: number;
  readonly originalPrice: number | undefined;
  readonly imageUrl: string;
  readonly productUrl: string;
  readonly originalProduct: SearchProduct;
}

export interface CanonicalProduct {
  readonly id: string;
  readonly title: string;
  readonly brand: string | undefined;
  readonly offers: readonly Offer[];
  readonly offerCount: number;
}
