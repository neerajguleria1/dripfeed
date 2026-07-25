import mongoose from 'mongoose';
import type { SearchProduct } from '../search.js';
import { MONGO_TTL_SECONDS } from '../cache/policy.js';

interface ISearchCache {
  query: string;
  results: SearchProduct[];
  /** Canonical IDs present in this cache doc — written at save time for O(1) product lookup. */
  canonicalIds: string[];
  /** When these results were fetched from the live platforms. */
  fetchedAt: Date;
  /** Alias kept for backward compat — same value as fetchedAt. */
  cachedAt: Date;
}

const schema = new mongoose.Schema<ISearchCache>({
  query:        { type: String, required: true, unique: true, index: true },
  results:      { type: mongoose.Schema.Types.Mixed, required: true },
  canonicalIds: { type: [String], default: [] },
  fetchedAt:    { type: Date, required: true, default: Date.now },
  cachedAt:     { type: Date, default: Date.now },
});

// MongoDB TTL index — deletes documents after MONGO_TTL_SECONDS (24h).
// Application-level TTL checks (per-platform) control freshness before that.
schema.index({ fetchedAt: 1 }, { expireAfterSeconds: MONGO_TTL_SECONDS });
// Sparse index on canonicalIds for O(1) product detail lookup.
// productDetail.ts queries { canonicalIds: canonicalId } which uses this index.
schema.index({ canonicalIds: 1 }, { sparse: true });

const SearchCacheModel = (mongoose.models.SearchCache as mongoose.Model<ISearchCache>) ||
  mongoose.model<ISearchCache>('SearchCache', schema);

export default SearchCacheModel;
