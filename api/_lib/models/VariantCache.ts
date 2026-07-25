import mongoose from 'mongoose';
import type { AjioProductVariants } from '../types/productVariant.js';

interface IVariantCache {
  productId: string;
  data: AjioProductVariants;
  cachedAt: Date;
}

const schema = new mongoose.Schema<IVariantCache>({
  productId: { type: String, required: true, unique: true, index: true },
  data:      { type: mongoose.Schema.Types.Mixed, required: true },
  cachedAt:  { type: Date, default: Date.now },
});

schema.index({ cachedAt: 1 }, { expireAfterSeconds: 6 * 60 * 60 });

const VariantCacheModel = (mongoose.models.VariantCache as mongoose.Model<IVariantCache>) ||
  mongoose.model<IVariantCache>('VariantCache', schema);

export default VariantCacheModel;
