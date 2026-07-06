import mongoose from 'mongoose';

export interface IThriftListing {
  sellerId: mongoose.Types.ObjectId;
  title: string;
  brand?: string;
  category: string;
  size: string;
  condition: 'like-new' | 'good' | 'fair';
  price: number;
  description?: string;
  images: string[];
  city: string;
  whatsappNumber: string;
  status: 'active' | 'sold' | 'removed';
}

const thriftListingSchema = new mongoose.Schema<IThriftListing>(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    brand: { type: String },
    category: { type: String, required: true },
    size: { type: String, required: true },
    condition: { type: String, enum: ['like-new', 'good', 'fair'], required: true },
    price: { type: Number, required: true },
    description: { type: String },
    images: { type: [String], validate: [(v: string[]) => v.length <= 5, 'Max 5 images'] },
    city: { type: String, required: true },
    whatsappNumber: { type: String, required: true },
    status: { type: String, enum: ['active', 'sold', 'removed'], default: 'active' },
  },
  { timestamps: true }
);

thriftListingSchema.index({ category: 1, city: 1, status: 1 });

export default mongoose.models.ThriftListing ||
  mongoose.model<IThriftListing>('ThriftListing', thriftListingSchema);
