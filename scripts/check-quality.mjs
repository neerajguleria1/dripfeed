import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGO_URI);

const col = mongoose.connection.db.collection('products');
const samples = await col.find({}).limit(10).toArray();

console.log('Sample products in DB:\n');
for (const p of samples) {
  console.log(`Title: ${p.title}`);
  console.log(`Image: ${p.imageUrl ? p.imageUrl.substring(0, 80) + '...' : '(none)'}`);
  console.log(`Platforms: ${p.platforms?.map(pl => `${pl.platform}:₹${pl.price}`).join(', ')}`);
  console.log(`Query: ${p.searchQuery}`);
  console.log('---');
}

await mongoose.disconnect();
process.exit(0);
