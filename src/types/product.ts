export interface ProductData {
  id?: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating?: number;
  platform: string;
  url: string;
  // Variant info — only populated when the source platform's search API
  // exposes it (Ajio: color, Flipkart: size). Not available for every
  // platform/listing, so always guard for undefined in the UI.
  color?: string;
  size?: string;
}

export interface DealData {
  id?: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  discount: number;
  platform: string;
  url: string;
}
