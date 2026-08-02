/**
 * HomeFeedCache model — stores pre-scraped products for the homepage feed.
 * 
 * Populated by the /api/cron/refresh-home-feed cron job every 24 hours.
 * The /api/feed/home endpoint reads from this collection for instant loading.
 * 
 * Only one document per category is stored (upsert pattern).
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IHomeFeedCacheProduct {
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

export interface IHomeFeedCache extends Document {
  category: string;          // e.g. "all", "kurta-sets", "sneakers"
  products: IHomeFeedCacheProduct[];
  scrapedAt: Date;
  expiresAt: Date;           // TTL — auto-delete after 48h (safety net)
}

const HomeFeedCacheProductSchema = new Schema({
  id: String,
  title: String,
  brand: String,
  imageUrl: String,
  price: Number,
  originalPrice: Number,
  discount: Number,
  savings: Number,
  platform: String,
  url: String,
  category: String,
}, { _id: false });

const HomeFeedCacheSchema = new Schema<IHomeFeedCache>({
  category: { type: String, required: true, unique: true, index: true },
  products: [HomeFeedCacheProductSchema],
  scrapedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 48 * 60 * 60 * 1000) },
});

// TTL index — MongoDB auto-deletes documents after expiresAt
HomeFeedCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.HomeFeedCache || mongoose.model<IHomeFeedCache>('HomeFeedCache', HomeFeedCacheSchema);
