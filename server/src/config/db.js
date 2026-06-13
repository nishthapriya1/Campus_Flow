import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let mongod = null;

export const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;

    if (!uri) {
      console.log('No MONGODB_URI found in environment. Initializing in-memory MongoDB Server...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      console.log(`In-memory MongoDB database online at: ${uri}`);
    }

    await mongoose.connect(uri);
    console.log('Mongoose connected to MongoDB.');
  } catch (error) {
    console.error('MongoDB connection failure:', error.message);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    if (mongod) {
      await mongod.stop();
    }
    console.log('Mongoose connection closed.');
  } catch (error) {
    console.error('Error closing MongoDB connection:', error.message);
  }
};
