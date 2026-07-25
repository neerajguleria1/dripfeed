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
