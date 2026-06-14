import mongoose from 'mongoose';
import { computeHash } from '../src/utils/hash.js';
import HabitLog from '../src/models/HabitLog.js';
import dotenv from 'dotenv';

dotenv.config();

const testHash = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const userId = '6a2c5e44cda0da1fd0a9009d'; // test student ID
  
  // Find or create a habit log
  let habit = await HabitLog.findOne({ userId });
  if (!habit) {
    habit = new HabitLog({
      userId,
      date: '2026-06-14',
      sleep: false,
      waterIntake: false,
      exercise: false,
      meditation: false,
      studyHours: false
    });
    await habit.save();
  }

  const logs1 = await HabitLog.find({ userId });
  const hash1 = computeHash({ logs: logs1 });
  console.log('Hash 1:', hash1);

  // Modify habit log
  habit.sleep = !habit.sleep;
  await habit.save();
  console.log('Modified sleep to:', habit.sleep);

  const logs2 = await HabitLog.find({ userId });
  const hash2 = computeHash({ logs: logs2 });
  console.log('Hash 2:', hash2);

  if (hash1 === hash2) {
    console.log('❌ ERROR: Hashes are identical after modification!');
  } else {
    console.log('✔ SUCCESS: Hashes are different after modification!');
  }

  await mongoose.disconnect();
};

testHash().catch(console.error);
