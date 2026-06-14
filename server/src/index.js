import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db.js';
import { startScheduler, startDeadlineScheduler } from './services/reminder.scheduler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { seedDatabase } from './scripts/seed.js';
import User from './models/User.js';
import mongoose from 'mongoose';

// Load routes
import authRouter from './routes/auth.routes.js';
import noticeRouter from './routes/notice.routes.js';
import eventRouter from './routes/event.routes.js';
import reminderRouter from './routes/reminder.routes.js';
import studyPlanRouter from './routes/studyplan.routes.js';
import chatRouter from './routes/chat.routes.js';
import notificationRouter from './routes/notification.routes.js';
import guardianRouter from './routes/guardian.routes.js';
import pushRouter from './routes/push.routes.js';
import attendanceRouter from './routes/attendance.routes.js';
import focusRouter from './routes/focus.routes.js';
import schedulingRouter from './routes/scheduling.routes.js';
import routineRouter from './routes/routine.routes.js';
import lifeCompanionRouter from './routes/lifeCompanion.routes.js';



dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);// Enable CORS


// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local uploads statically (essential for AWS S3 Mock Mode)
app.use('/uploads', express.static(path.resolve('uploads')));

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/notices', noticeRouter);
app.use('/api/events', eventRouter);
app.use('/api/reminders', reminderRouter);
app.use('/api/studyplans', studyPlanRouter);
app.use('/api/chat', chatRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/guardian', guardianRouter);
app.use('/api/push', pushRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/focus', focusRouter);
app.use('/api/scheduling', schedulingRouter);
app.use('/api/routine', routineRouter);
app.use('/api/life-companion', lifeCompanionRouter);



// Serve static React production build assets if in production mode (Task 59)
if (process.env.NODE_ENV === 'production') {
  console.log('Production mode enabled. Serving static client build assets...');
  app.use(express.static(path.resolve('public')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve('public', 'index.html'));
  });
}

// Global error handler (must be loaded last)
app.use(errorHandler);

// Boot server
const startServer = async () => {
  // Connect to DB
  await connectDB();

  // Auto-seed mock database on startup if database is empty/unseeded
  const adminExists = await User.findOne({ email: 'admin@campusflow.com' });
  if (!adminExists) {
    console.log('Seeded database not detected. Running database seeder...');
    await seedDatabase();
  } else {
    console.log('Database already seeded. Skipping seeder to preserve development data.');
  }

  // Start the background cron job for deadline reminders
  startScheduler();
  startDeadlineScheduler();

  app.listen(PORT, () => {
    console.log(`Campus Flow API Server is running on port ${PORT}`);
    console.log("MODEL_ID =", process.env.BEDROCK_MODEL_ID);
    console.log("AWS_REGION =", process.env.AWS_REGION);
  });
};

startServer();
