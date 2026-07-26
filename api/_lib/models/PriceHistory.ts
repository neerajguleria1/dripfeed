import mongoose from 'mongoose';

/**
 * PriceHistory — one document per price snapshot from a LIVE scrape.
 *
 * Design constraints (MongoDB Atlas M0 free tier):
 *   - No currency field  — always INR, storing it wastes bytes on every doc
 *   - No availability    — never populated by scrapers, pure waste
 *   - TTL index          — auto-deletes docs older than PRICE_HISTORY_RETENTION_DAYS
 *   - 3 indexes total    — TTL + two compound; M0 handles this comfortably
 *   - versionKey: false  — __v field removed from every document
 */

export interface IPriceHistory {
  canonicalId:   string;
  platform:      string;   // lowercase: 'amazon india', 'flipkart', 'myntra', 'ajio', 'meesho'
  productId:     string;   // platform-native id (ASIN, FK id, Myntra productId, etc.)
  price:         number;   // final selling price in INR
  originalPrice?: number;  // MRP before discount
  discount?:     number;   // discount percentage
  rating?:       number;   // platform rating at snapshot time
  fetchedAt:     Date;     // when this was scraped live — drives TTL
}

const RETENTION_DAYS = parseInt(process.env.PRICE_HISTORY_RETENTION_DAYS ?? '90', 10) || 90;

const schema = new mongoose.Schema<IPriceHistory>(
  {
    canonicalId:   { type: String, required: true },
    platform:      { type: String, required: true },
    productId:     { type: String, required: true },
    price:         { type: Number, required: true },
    originalPrice: { type: Number },
    discount:      { type: Number },
    rating:        { type: Number },
    fetchedAt:     { type: Date,   required: true, default: Date.now },
  },
  { versionKey: false }
);

// ─── Indexes (3 total — minimal, purposeful) ──────────────────────────────────

// 1. TTL — auto-deletes documents after RETENTION_DAYS. This is the free-tier
//    storage safety net. MongoDB runs the TTL reaper every ~60 seconds.
schema.index({ fetchedAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

// 2. Primary read path: "all history for canonical X [on platform Y], chronological"
//    Covers getPriceHistory(), getStats() aggregation.
schema.index({ canonicalId: 1, fetchedAt: 1 });

// 3. Dedup lookup: "most recent snapshot for productId+platform within window"
//    Used by saveBulkSnapshots() aggregate to skip unchanged prices.
schema.index({ productId: 1, platform: 1, fetchedAt: -1 });

const PriceHistoryModel =
  (mongoose.models.PriceHistory as mongoose.Model<IPriceHistory>) ||
  mongoose.model<IPriceHistory>('PriceHistory', schema);

export default PriceHistoryModel;
