import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('No MONGO_URI'); process.exit(1); }

await mongoose.connect(MONGO_URI);
const result = await mongoose.connection.collection('searchcaches').deleteMany({});
console.log(`Deleted ${result.deletedCount} cached search results`);
await mongoose.disconnect();
