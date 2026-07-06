import mongoose from 'mongoose';

export interface IDeal {
  productTitle: string;
  brand?: string;
  imageUrl?: string;
  category?: string;
  platform: string;
  currentPrice: number;
  previousPrice: number;
  dropPercentage: number;
  url: string;
  detectedAt: Date;
  trackersCount: number;
  active: boolean;
}

const DealSchema = new mongoose.Schema<IDeal>(
  {
    productTitle: { type: String, required: true },
    brand: { type: String },
    imageUrl: { type: String },
    category: { type: String },
    platform: { type: String, required: true },
    currentPrice: { type: Number, required: true },
    previousPrice: { type: Number, required: true },
    dropPercentage: { type: Number, required: true },
    url: { type: String, required: true },
    detectedAt: { type: Date, default: Date.now },
    trackersCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

DealSchema.index({ detectedAt: -1 });
DealSchema.index({ platform: 1 });
DealSchema.index({ active: 1 });
// TTL: remove deals older than 48 hours
DealSchema.index({ detectedAt: 1 }, { expireAfterSeconds: 172800 });

export default mongoose.models.Deal || mongoose.model<IDeal>('Deal', DealSchema);
