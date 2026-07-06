import mongoose from 'mongoose';

export interface IAffiliateClick {
  userId?: mongoose.Types.ObjectId;
  platform: string;
  productTitle: string;
  sourceUrl?: string;
  affiliateUrl: string;
  device: string;
  browser?: string;
  sessionId?: string;
  converted: boolean;
  revenue?: number;
}

const affiliateClickSchema = new mongoose.Schema<IAffiliateClick>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    platform: { type: String, required: true },
    productTitle: { type: String, required: true },
    sourceUrl: { type: String },
    affiliateUrl: { type: String, required: true },
    device: { type: String, default: 'web' },
    browser: { type: String },
    sessionId: { type: String },
    converted: { type: Boolean, default: false },
    revenue: { type: Number },
  },
  { timestamps: true }
);

affiliateClickSchema.index({ platform: 1 });
affiliateClickSchema.index({ createdAt: -1 });
affiliateClickSchema.index({ userId: 1 });

export default mongoose.models.AffiliateClick ||
  mongoose.model<IAffiliateClick>('AffiliateClick', affiliateClickSchema);
