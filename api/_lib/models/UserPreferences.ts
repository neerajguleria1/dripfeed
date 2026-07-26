import mongoose from 'mongoose';

export interface ISearchEntry {
  query: string;
  timestamp: Date;
}

export interface IRecentProduct {
  canonicalId: string;
  title: string;
  brand?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  platform: string;
  url: string;
  viewedAt: Date;
}

export interface IUserPreferences {
  userId: mongoose.Types.ObjectId;
  categories: string[];
  brands: string[];
  priceRange: { min: number; max: number };
  occasions: string[];
  onboardingCompleted: boolean;
  searchHistory: ISearchEntry[];
  recentProducts: IRecentProduct[];
}

const searchHistoryEntrySchema = new mongoose.Schema(
  {
    query: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const recentProductSchema = new mongoose.Schema<IRecentProduct>(
  {
    canonicalId: { type: String, required: true },
    title:       { type: String, required: true },
    brand:       { type: String },
    imageUrl:    { type: String },
    price:       { type: Number, required: true },
    originalPrice: { type: Number },
    discount:    { type: Number },
    platform:    { type: String, required: true },
    url:         { type: String, required: true },
    viewedAt:    { type: Date, default: Date.now },
  },
  { _id: false }
);

const userPreferencesSchema = new mongoose.Schema<IUserPreferences>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    categories: [String],
    brands: [String],
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10000 },
    },
    occasions: [String],
    onboardingCompleted: { type: Boolean, default: false },
    searchHistory: { type: [searchHistoryEntrySchema], validate: [arrayLimit, '{PATH} exceeds the limit of 30'] },
    recentProducts: { type: [recentProductSchema], default: [] },
  },
  { timestamps: true }
);

function arrayLimit(val: ISearchEntry[]) {
  return val.length <= 30;
}

// Index already defined by unique: true in schema
// userPreferencesSchema.index({ userId: 1 }, { unique: true });

export const UserPreferences = mongoose.models.UserPreferences ||
  mongoose.model<IUserPreferences>('UserPreferences', userPreferencesSchema);

export default UserPreferences;
