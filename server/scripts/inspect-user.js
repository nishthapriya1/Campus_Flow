import mongoose from 'mongoose';
import dotenv from 'dotenv';
import StudyPlan from '../src/models/StudyPlan.js';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Attendance from '../src/models/Attendance.js';
import Notification from '../src/models/Notification.js';

dotenv.config();

const inspect = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const targetUserId = '6a2d3b9f2b9235f877324a06'; // aa@gmail.com

  const plans = await StudyPlan.find({ userId: targetUserId });
  console.log(`StudyPlans count: ${plans.length}`);

  const events = await Event.find({ userId: targetUserId });
  console.log(`Events count: ${events.length}`);

  const attendance = await Attendance.find({ userId: targetUserId });
  console.log(`Attendance count: ${attendance.length}`);

  const notifications = await Notification.find({ userId: targetUserId });
  console.log(`Notifications count: ${notifications.length}`);

  await mongoose.connection.close();
};

inspect();
