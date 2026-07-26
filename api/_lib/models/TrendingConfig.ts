import mongoose from 'mongoose';

/**
 * TrendingConfig — singleton document storing admin-configurable signal weights.
 *
 * Only one document exists (key: 'default'). Fetched at most once per
 * TRENDING_CACHE_TTL_MS by the engine; never hot-pathed per request.
 */

export interface ITrendingWeights {
  view:          number;
  compareClick:  number;
  wishlistAdd:   number;
  affiliateClick: number;
  priceAlert:    number;
}

export interface ITrendingConfig {
  key:     string;
  weights: ITrendingWeights;
  updatedAt: Date;
}

export const DEFAULT_WEIGHTS: ITrendingWeights = {
  view:           1,
  compareClick:   3,
  wishlistAdd:    4,
  affiliateClick: 5,
  priceAlert:     4,
};

const schema = new mongoose.Schema<ITrendingConfig>(
  {
    key:     { type: String, required: true, unique: true, default: 'default' },
    weights: {
      view:           { type: Number, default: DEFAULT_WEIGHTS.view },
      compareClick:   { type: Number, default: DEFAULT_WEIGHTS.compareClick },
      wishlistAdd:    { type: Number, default: DEFAULT_WEIGHTS.wishlistAdd },
      affiliateClick: { type: Number, default: DEFAULT_WEIGHTS.affiliateClick },
      priceAlert:     { type: Number, default: DEFAULT_WEIGHTS.priceAlert },
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const TrendingConfig =
  (mongoose.models.TrendingConfig as mongoose.Model<ITrendingConfig>) ||
  mongoose.model<ITrendingConfig>('TrendingConfig', schema);

export default TrendingConfig;
