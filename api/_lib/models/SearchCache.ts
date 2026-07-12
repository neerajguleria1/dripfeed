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

export default mongoose.models.SearchCache ||
  mongoose.model<ISearchCache>('SearchCache', schema);
