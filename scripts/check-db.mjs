import 'dotenv/config';
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGO_URI);
const collections = await mongoose.connection.db.listCollections().toArray();
console.log('Collections:', collections.map(c => c.name));
for (const c of collections) {
  const count = await mongoose.connection.db.collection(c.name).countDocuments();
  console.log(`  ${c.name}: ${count} docs`);
}
await mongoose.disconnect();
process.exit(0);
