import mongoose, { Schema, Document } from 'mongoose';

export interface IWishlistItem extends Document {
  userId: string;
  productTitle: string;
  sourceUrl: string;
  platform: string;
  savedPrice: number;
  imageUrl?: string;
  brand?: string;
  createdAt: Date;
}

const WishlistItemSchema = new Schema<IWishlistItem>({
  userId: { type: String, required: true, index: true },
  productTitle: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  platform: { type: String, required: true },
  savedPrice: { type: Number, required: true },
  imageUrl: { type: String },
  brand: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const WishlistItem = mongoose.models.WishlistItem || mongoose.model<IWishlistItem>('WishlistItem', WishlistItemSchema);
