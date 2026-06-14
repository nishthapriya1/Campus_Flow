import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Notice from '../src/models/Notice.js';

dotenv.config();

const inspect = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const notices = await Notice.find();
  console.log(`Notices count: ${notices.length}`);
  notices.forEach(n => {
    console.log(`- Notice ID: ${n._id}, File: ${n.fileName}, Status: ${n.status}, Urgency: ${n.urgency}, UploadedBy: ${n.uploadedBy}`);
  });

  await mongoose.connection.close();
};

inspect();
