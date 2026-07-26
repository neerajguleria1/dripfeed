export interface ProductData {
  id: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating?: number;
  platform: string;
  url: string;
  // Variant info — populated when the platform's search response includes it.
  // Ajio: color | Flipkart: size | Myntra: color + size | Meesho: color + size (best-effort)
  // Amazon: neither. Always guard for undefined in the UI.
  color?: string;
  size?: string;
}

/** One platform offer inside a CanonicalProductData */
export interface OfferData {
  platform: string;
  platformProductId: string;
  title: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  imageUrl: string;
  /** Always use this for outbound links — it is the affiliate-wrapped URL */
  productUrl: string;
  affiliateUrl: string;
  color?: string;
  size?: string;
  rating?: number;
}

/**
 * The canonical grouped product returned by the search API.
 * One CanonicalProductData = one physical product with N platform offers.
 */
export interface CanonicalProductData {
  id: string;
  title: string;
  brand?: string;
  offerCount: number;
  /** Sorted cheapest-first */
  offers: OfferData[];
}

export interface DealData {
  id: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  discount: number;
  platform: string;
  url: string;
}
