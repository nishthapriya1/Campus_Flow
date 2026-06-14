import mongoose from 'mongoose';
import dotenv from 'dotenv';
import StudyPlan from '../src/models/StudyPlan.js';
import User from '../src/models/User.js';

dotenv.config();

const inspect = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const users = await User.find();
  console.log('Users list:');
  users.forEach(u => console.log(`- ${u.email} (ID: ${u._id})`));

  const plans = await StudyPlan.find();
  console.log(`\nStudyPlans count: ${plans.length}`);
  plans.forEach(p => {
    console.log(`- Plan ID: ${p._id}, User: ${p.userId}, Status: ${p.status}, Sessions: ${p.sessions?.length}`);
  });

  await mongoose.connection.close();
};

inspect();
