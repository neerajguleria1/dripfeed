import mongoose from 'mongoose';

export interface IPlatformListing {
  platform: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  url: string;
  affiliateUrl?: string;
  inStock?: boolean;
  rating?: number;
  deliveryInfo?: string;
  returnPolicy?: string;
}

export interface IPriceEntry {
  price: number;
  platform: string;
  recordedAt: Date;
}

export interface IProduct {
  title: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  description?: string;
  specifications?: Map<string, string>;
  platforms: IPlatformListing[];
  aiSummary?: string;
  aiPros?: string[];
  aiCons?: string[];
  aiRecommendation?: string;
  aiGeneratedAt?: Date;
  priceHistory: IPriceEntry[];
  searchQuery?: string;
  cachedAt?: Date;
}

const priceEntrySchema = new mongoose.Schema<IPriceEntry>({
  price: { type: Number, required: true },
  platform: { type: String, required: true },
  recordedAt: { type: Date, default: Date.now },
});

const platformListingSchema = new mongoose.Schema<IPlatformListing>({
  platform: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  discount: { type: Number },
  url: { type: String, required: true },
  affiliateUrl: { type: String },
  inStock: { type: Boolean, default: true },
  rating: { type: Number },
  deliveryInfo: { type: String },
  returnPolicy: { type: String },
});

const productSchema = new mongoose.Schema<IProduct>(
  {
    title: { type: String, required: true, index: true },
    brand: { type: String },
    category: { type: String },
    imageUrl: { type: String },
    description: { type: String },
    specifications: { type: Map, of: String },
    platforms: [platformListingSchema],
    aiSummary: { type: String },
    aiPros: [String],
    aiCons: [String],
    aiRecommendation: { type: String },
    aiGeneratedAt: { type: Date },
    priceHistory: [priceEntrySchema],
    searchQuery: { type: String, index: true },
    cachedAt: { type: Date, default: Date.now, index: { expires: '15m' } },
  },
  { timestamps: true }
);

productSchema.index({ title: 'text', brand: 'text' });

export default mongoose.model<IProduct>('Product', productSchema);
