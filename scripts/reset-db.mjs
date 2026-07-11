import 'dotenv/config';
import mongoose from 'mongoose';
const uri = process.env.MONGO_URI;
await mongoose.connect(uri);
const r = await mongoose.connection.db.collection('products').deleteMany({});
console.log('Cleared:', r.deletedCount, 'products');
await mongoose.disconnect();
process.exit(0);
