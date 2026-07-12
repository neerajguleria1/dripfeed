import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
const result = await mongoose.connection.collection('searchcaches').deleteMany({});
console.log(`✅ Cleared ${result.deletedCount} cached queries`);
await mongoose.disconnect();
