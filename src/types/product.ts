export interface ProductData {
  id?: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  platform: string;
  url: string;
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
