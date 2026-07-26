import mongoose from 'mongoose';

/**
 * PriceAlert — one document per user-created price alert.
 *
 * Design (Atlas M0 free tier):
 *   - sessionId only — no userId, no PII beyond optional email
 *   - TTL index auto-deletes alerts after 30 days
 *   - status enum prevents double-trigger at DB level
 *   - versionKey: false saves bytes on every document
 */

export type AlertStatus = 'active' | 'triggered' | 'cancelled' | 'expired';

export interface IPriceAlert {
  canonicalId:  string;
  targetPrice:  number;
  currentPrice: number;
  email?:       string;
  sessionId:    string;
  status:       AlertStatus;
  productTitle: string;
  platform?:    string;
  imageUrl?:    string;
  createdAt:    Date;
  lastChecked?: Date;
  triggeredAt?: Date;
}

const RETENTION_DAYS = 30;

const schema = new mongoose.Schema<IPriceAlert>(
  {
    canonicalId:  { type: String, required: true },
    targetPrice:  { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    email:        { type: String },
    sessionId:    { type: String, required: true },
    status:       { type: String, enum: ['active', 'triggered', 'cancelled', 'expired'], default: 'active' },
    productTitle: { type: String, required: true },
    platform:     { type: String },
    imageUrl:     { type: String },
    createdAt:    { type: Date, default: Date.now },
    lastChecked:  { type: Date },
    triggeredAt:  { type: Date },
  },
  { versionKey: false }
);

// TTL — auto-deletes after RETENTION_DAYS
schema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86400 });
// Primary read paths
schema.index({ canonicalId: 1, status: 1 });
schema.index({ sessionId: 1, status: 1 });

const PriceAlert =
  (mongoose.models.PriceAlert as mongoose.Model<IPriceAlert>) ||
  mongoose.model<IPriceAlert>('PriceAlert', schema);

export default PriceAlert;
