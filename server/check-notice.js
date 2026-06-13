import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Notice from './src/models/Notice.js';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');
    const notices = await Notice.find({}).sort({ uploadedAt: -1 }).limit(5);
    console.log('Last 5 notices:');
    notices.forEach(n => {
      console.log(`ID: ${n._id} | File: ${n.fileName} | Status: ${n.status} | Urgency: ${n.urgency} | Category: ${n.category}`);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};
run();
