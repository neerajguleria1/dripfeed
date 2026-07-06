import mongoose from 'mongoose';

export interface ICollectionProduct {
  productTitle: string;
  brand: string;
  imageUrl: string;
  platform: string;
  price: number;
  url: string;
  addedAt: Date;
}

export interface ICollection {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  products: ICollectionProduct[];
  shareToken: string;
  isPublic: boolean;
}

const collectionProductSchema = new mongoose.Schema<ICollectionProduct>(
  {
    productTitle: { type: String },
    brand: { type: String },
    imageUrl: { type: String },
    platform: { type: String },
    price: { type: Number },
    url: { type: String },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const collectionSchema = new mongoose.Schema<ICollection>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, maxlength: 50 },
    description: { type: String, maxlength: 200 },
    products: [collectionProductSchema],
    shareToken: { type: String, unique: true },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Collection ||
  mongoose.model<ICollection>('Collection', collectionSchema);
