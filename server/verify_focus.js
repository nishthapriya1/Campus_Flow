import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './src/models/User.js';
import FocusSession from './src/models/FocusSession.js';
import FocusInventory from './src/models/FocusInventory.js';
import FocusStreak from './src/models/FocusStreak.js';
import Notification from './src/models/Notification.js';

dotenv.config();

const API_URL = 'http://localhost:4000/api';

const runFocusTests = async () => {
  console.log('==================================================');
  console.log('STARTING CAMPUS FLOW FOCUS ZONE INTEGRATION TESTS');
  console.log('==================================================\n');

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✔ Connected to MongoDB.');

    const studentUser = await User.findOne({ email: 'student@campusflow.com' });
    if (!studentUser) throw new Error('Student user student@campusflow.com not found in database.');

    // 1. Authenticate Student
    console.log('Test 1: Student Login...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@campusflow.com',
        password: 'student123',
      }),
    });

    if (!loginRes.ok) throw new Error('Student login failed.');
    const loginData = await loginRes.json();
    const token = loginData.token;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    console.log('✔ Student login successful.');

    // Clear any prior test data to make it clean
    await FocusSession.deleteMany({ userId: studentUser._id });
    await FocusInventory.deleteMany({ userId: studentUser._id });
    await FocusStreak.deleteMany({ userId: studentUser._id });
    await Notification.deleteMany({ userId: studentUser._id, alertType: { $in: ['focus_complete', 'focus_milestone'] } });
    console.log('✔ Cleared prior focus test data.');

    // 2. Start Focus Session
    console.log('\nTest 2: POST /api/focus/start...');
    const startRes = await fetch(`${API_URL}/focus/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ duration: 25 }),
    });

    if (!startRes.ok) {
      const err = await startRes.json();
      throw new Error(`Failed to start focus session: ${err.error}`);
    }

    const session = await startRes.json();
    console.log(`✔ Focus session started. ID: ${session._id}, Duration: ${session.duration}m`);
    if (session.completed !== false || session.duration !== 25) {
      throw new Error('Start session response properties mismatch.');
    }

    // 3. Pause Focus Session
    console.log('\nTest 3: POST /api/focus/pause...');
    const pauseRes = await fetch(`${API_URL}/focus/pause`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId: session._id }),
    });
    if (!pauseRes.ok) throw new Error('Failed to pause focus session');
    const pauseData = await pauseRes.json();
    if (!pauseData.success) throw new Error('Pause response did not return success');
    console.log('✔ Focus session paused successfully.');

    // 4. Resume Focus Session
    console.log('\nTest 4: POST /api/focus/resume...');
    const resumeRes = await fetch(`${API_URL}/focus/resume`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId: session._id }),
    });
    if (!resumeRes.ok) throw new Error('Failed to resume focus session');
    const resumeData = await resumeRes.json();
    if (!resumeData.success) throw new Error('Resume response did not return success');
    console.log('✔ Focus session resumed successfully.');

    // 5. Complete Focus Session and assign reward
    console.log('\nTest 5: POST /api/focus/complete...');
    const completeRes = await fetch(`${API_URL}/focus/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId: session._id }),
    });

    if (!completeRes.ok) {
      const err = await completeRes.json();
      throw new Error(`Failed to complete focus session: ${err.error}`);
    }

    const completeData = await completeRes.json();
    console.log(`✔ Focus session completed. Earned Fruit: ${completeData.earnedFruit}`);
    
    // Validate reward fruit
    const fruits = ['Apple', 'Orange', 'Mango', 'Strawberry', 'Grapes', 'Banana'];
    if (!fruits.includes(completeData.earnedFruit)) {
      throw new Error(`Invalid reward fruit: ${completeData.earnedFruit}`);
    }

    // Verify FocusSession completion in DB
    const dbSession = await FocusSession.findById(session._id);
    if (!dbSession || !dbSession.completed || dbSession.rewardFruit !== completeData.earnedFruit) {
      throw new Error('FocusSession document was not updated correctly in database.');
    }
    console.log('✔ Verified FocusSession completion in database.');

    // Verify FocusInventory update in DB
    const dbInventory = await FocusInventory.findOne({ userId: studentUser._id });
    if (!dbInventory || dbInventory.totalFruits !== 1 || dbInventory.fruitCounts[completeData.earnedFruit] !== 1) {
      throw new Error('FocusInventory counts mismatch.');
    }
    console.log(`✔ Verified FocusInventory in database: ${completeData.earnedFruit} x1`);

    // Verify FocusStreak in DB
    const dbStreak = await FocusStreak.findOne({ userId: studentUser._id });
    if (!dbStreak || dbStreak.currentStreak !== 1 || dbStreak.longestStreak !== 1) {
      throw new Error('FocusStreak counts mismatch.');
    }
    console.log('✔ Verified FocusStreak in database: Current Streak is 1.');

    // Verify Notification document in MongoDB
    const focusNotification = await Notification.findOne({
      userId: studentUser._id,
      alertType: 'focus_complete'
    });
    if (!focusNotification) {
      throw new Error('Focus completion notification was not created in MongoDB.');
    }
    console.log(`✔ Focus complete notification found in database: "${focusNotification.title}"`);

    // 6. Get stats
    console.log('\nTest 6: GET /api/focus/stats...');
    const statsRes = await fetch(`${API_URL}/focus/stats`, { headers });
    if (!statsRes.ok) throw new Error('GET stats failed');
    const statsData = await statsRes.json();
    console.log('✔ Stats response:', statsData);
    if (statsData.totalSessions !== 1 || statsData.totalMinutes !== 25 || statsData.completionRate !== 100) {
      throw new Error('Stats values mismatch.');
    }

    // 7. Get inventory
    console.log('\nTest 7: GET /api/focus/inventory...');
    const invRes = await fetch(`${API_URL}/focus/inventory`, { headers });
    if (!invRes.ok) throw new Error('GET inventory failed');
    const invData = await invRes.json();
    console.log('✔ Inventory response:', invData);
    if (invData.totalFruits !== 1 || invData.fruitCounts[completeData.earnedFruit] !== 1) {
      throw new Error('Inventory values mismatch.');
    }

    // 8. Get streak
    console.log('\nTest 8: GET /api/focus/streak...');
    const streakRes = await fetch(`${API_URL}/focus/streak`, { headers });
    if (!streakRes.ok) throw new Error('GET streak failed');
    const streakResult = await streakRes.json();
    console.log('✔ Streak response current:', streakResult.currentStreak);
    if (streakResult.currentStreak !== 1) {
      throw new Error('Streak values mismatch.');
    }

    // Clean up test data
    await FocusSession.deleteMany({ userId: studentUser._id });
    await FocusInventory.deleteMany({ userId: studentUser._id });
    await FocusStreak.deleteMany({ userId: studentUser._id });
    await Notification.deleteMany({ userId: studentUser._id, alertType: { $in: ['focus_complete', 'focus_milestone'] } });
    console.log('\n✔ Cleaned up focus integration test data.');

    console.log('\n==================================================');
    console.log('ALL CAMPUS FLOW FOCUS ZONE TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ FAIL: Focus Zone E2E test suite encountered an error:', error.message);
    process.exit(1);
  }
};

runFocusTests();
