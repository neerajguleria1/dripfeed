import mongoose from 'mongoose';

let cached: typeof mongoose | null = null;

export async function connectDB() {
  if (cached && mongoose.connection.readyState === 1) return cached;

  // Reset if previous connection failed
  if (cached && mongoose.connection.readyState === 0) {
    cached = null;
  }

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI environment variable not set');

  cached = await mongoose.connect(uri, {
    bufferCommands: true,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });

  return cached;
}
