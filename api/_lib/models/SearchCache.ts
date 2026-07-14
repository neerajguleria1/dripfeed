import mongoose from 'mongoose';
import type { SearchProduct } from '../search.js';

interface ISearchCache {
  query: string;
  results: SearchProduct[];
  cachedAt: Date;
}

const schema = new mongoose.Schema<ISearchCache>({
  query:     { type: String, required: true, unique: true, index: true },
  results:   { type: mongoose.Schema.Types.Mixed, required: true },
  cachedAt:  { type: Date, default: Date.now },
});

// Auto-delete documents older than 6 hours
schema.index({ cachedAt: 1 }, { expireAfterSeconds: 6 * 60 * 60 });

// Cast explicitly — mongoose.models.SearchCache is typed loosely (Model<any>),
// which causes the `||` fallback expression to lose the ISearchCache typing,
// making downstream calls like findOne({ query }) fail type-checking even
// though the field genuinely exists on the schema.
const SearchCacheModel = (mongoose.models.SearchCache as mongoose.Model<ISearchCache>) ||
  mongoose.model<ISearchCache>('SearchCache', schema);

export default SearchCacheModel;
