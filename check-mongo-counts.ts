import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const mongoUri = process.env.MONGODB_URI || "mongodb://178.104.122.211:27017/stands_finance_db";

async function run() {
  console.log("Connecting to:", mongoUri);
  await mongoose.connect(mongoUri);
  console.log("Connected.");

  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const col of collections) {
    const count = await mongoose.connection.db.collection(col.name).countDocuments();
    console.log(`Collection: ${col.name} -> Count: ${count}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
