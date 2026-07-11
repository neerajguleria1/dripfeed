import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGO_URI);

const col = mongoose.connection.db.collection('products');

// List and drop all indexes
const indexes = await col.indexes();
console.log('Current indexes:', indexes.map(i => `${i.name} (expires: ${i.expireAfterSeconds}s)`));

// Drop the TTL index if it exists
for (const idx of indexes) {
  if (idx.expireAfterSeconds !== undefined) {
    console.log(`Dropping TTL index: ${idx.name}`);
    await col.dropIndex(idx.name);
  }
}

console.log('✅ TTL indexes dropped. Products will no longer auto-delete.');
await mongoose.disconnect();
process.exit(0);
