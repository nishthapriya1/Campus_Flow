import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './src/models/User.js';
import Event from './src/models/Event.js';
import Attendance from './src/models/Attendance.js';
import SchedulingPreferences from './src/models/SchedulingPreferences.js';
import CachedAnalysis from './src/models/CachedAnalysis.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:4500/api';

const runTests = async () => {
  console.log('==================================================');
  console.log('STARTING SMART SCHEDULING AGENT INTEGRATION TEST');
  console.log('==================================================\n');

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✔ Connected to MongoDB.');

    const studentUser = await User.findOne({ email: 'student@campusflow.com' });
    if (!studentUser) throw new Error('Student user student@campusflow.com not found in database.');

    // Clear old test cached analyses
    console.log('Cleaning old cached scheduler analysis...');
    await CachedAnalysis.deleteMany({ userId: studentUser._id });
    console.log('✔ Cached analyses cleaned.');

    // 1. Authenticate Student
    console.log('\nTest 1: Student Login...');
    const studentLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student@campusflow.com',
        password: 'student123',
      }),
    });
    if (!studentLoginRes.ok) throw new Error('Student login failed.');
    const studentLoginData = await studentLoginRes.json();
    const studentToken = studentLoginData.token;
    const studentHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    };
    console.log('✔ Student login successful.');

    // 2. Fetch Preferences
    console.log('\nTest 2: GET /api/scheduling/preferences...');
    const getPrefRes = await fetch(`${API_URL}/scheduling/preferences`, {
      headers: studentHeaders
    });
    if (!getPrefRes.ok) throw new Error(`Fetch preferences failed with status: ${getPrefRes.status}`);
    const defaultPref = await getPrefRes.json();
    console.log('✔ Preferences fetched successfully.');
    console.log('  Sleep Hours:', defaultPref.sleepStart, 'to', defaultPref.sleepEnd);
    console.log('  Travel Time:', defaultPref.travelTimeMins, 'mins');
    console.log('  Study hours style:', defaultPref.preferredStudyHours);

    // 3. Update Preferences
    console.log('\nTest 3: POST /api/scheduling/preferences...');
    const updatePayload = {
      sleepStart: '22:30',
      sleepEnd: '06:30',
      preferredStudyHours: 'morning',
      breakfastTime: '07:30',
      lunchTime: '12:30',
      dinnerTime: '19:30',
      travelTimeMins: 45,
      productivityPreference: 'High intensity blocks',
      personalCommitments: ['Gym', 'Yoga']
    };

    const updatePrefRes = await fetch(`${API_URL}/scheduling/preferences`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify(updatePayload)
    });
    if (!updatePrefRes.ok) throw new Error(`Update preferences failed with status: ${updatePrefRes.status}`);
    const updatedPref = await updatePrefRes.json();
    console.log('✔ Preferences updated successfully.');
    console.log('  Updated Sleep Hours:', updatedPref.sleepStart, 'to', updatedPref.sleepEnd);
    console.log('  Updated Travel Time:', updatedPref.travelTimeMins, 'mins');
    console.log('  Updated commitments:', updatedPref.personalCommitments);

    if (updatedPref.sleepStart === '22:30' && updatedPref.travelTimeMins === 45) {
      console.log('✔ Success: Updated fields verified in response.');
    } else {
      throw new Error('❌ Fail: Preferences response fields do not match update payload.');
    }

    // 4. Fetch Scheduling Analysis
    console.log('\nTest 4: GET /api/scheduling/analyze...');
    const analyzeRes = await fetch(`${API_URL}/scheduling/analyze`, {
      headers: studentHeaders
    });
    if (!analyzeRes.ok) throw new Error(`Fetch schedule analysis failed with status: ${analyzeRes.status}`);
    const analyzeData = await analyzeRes.json();
    console.log('✔ Schedule analysis report retrieved successfully.');
    console.log('  Schedule Summary:', analyzeData.analysis.scheduleSummary);
    console.log('  Next Best Action:', analyzeData.analysis.nextBestAction);
    console.log('  Today Plan items:', analyzeData.analysis.todayPlan?.length);
    console.log('  Weekly Busiest Day:', analyzeData.analysis.weeklyInsights?.busiestDay);
    console.log('  Burnout Risk Score:', analyzeData.analysis.weeklyInsights?.burnoutRiskScore);

    if (
      analyzeData.analysis.scheduleSummary &&
      Array.isArray(analyzeData.analysis.todayPlan) &&
      Array.isArray(analyzeData.analysis.upcomingDeadlines) &&
      Array.isArray(analyzeData.analysis.attendanceStatus) &&
      Array.isArray(analyzeData.analysis.conflictsDetected) &&
      Array.isArray(analyzeData.analysis.risksIdentified) &&
      Array.isArray(analyzeData.analysis.recommendations) &&
      Array.isArray(analyzeData.analysis.scheduleChangesMade) &&
      analyzeData.analysis.weeklyInsights &&
      analyzeData.analysis.nextBestAction
    ) {
      console.log('✔ Success: Correct scheduling report structure validated.');
    } else {
      throw new Error('❌ Fail: Scheduling analysis response structure is missing mandatory fields.');
    }

    // 5. Post Schedule Optimization
    console.log('\nTest 5: POST /api/scheduling/optimize...');
    const optimizeRes = await fetch(`${API_URL}/scheduling/optimize`, {
      method: 'POST',
      headers: studentHeaders
    });
    if (!optimizeRes.ok) throw new Error(`Schedule optimization failed with status: ${optimizeRes.status}`);
    const optimizeData = await optimizeRes.json();
    console.log('✔ Schedule optimization completed.');
    console.log('  Changes Made Log:', optimizeData.changesMade);
    console.log('  Updated Changes Log in Analysis:', optimizeData.analysis.scheduleChangesMade);

    if (Array.isArray(optimizeData.changesMade) && optimizeData.changesMade.length > 0) {
      console.log('✔ Success: Optimization changes logged successfully.');
    } else {
      throw new Error('❌ Fail: Expected at least one optimization log or balance log.');
    }

    // Let's verify Mongoose models were updated/created
    const studentEvents = await Event.find({ userId: studentUser._id });
    console.log(`\nVerifying database state after optimization...`);
    console.log(`Total events for Arjun in DB: ${studentEvents.length}`);
    studentEvents.forEach(ev => {
      console.log(`- "${ev.title}" [${ev.type}] from ${ev.startTime.toISOString()} to ${ev.endTime.toISOString()}`);
    });

    console.log('\n✔ All Smart Scheduling Agent integration tests PASSED successfully.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Integration Test FAILED:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

runTests();
