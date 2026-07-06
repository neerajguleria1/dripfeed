import mongoose from 'mongoose';

let cached: typeof mongoose | null = null;

export async function connectDB() {
  if (cached) return cached;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI environment variable not set');

  cached = await mongoose.connect(uri, {
    bufferCommands: false,
  });

  return cached;
}
