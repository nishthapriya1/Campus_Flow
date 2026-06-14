import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './src/models/User.js';
import WellnessLog from './src/models/WellnessLog.js';
import Expense from './src/models/Expense.js';
import HabitLog from './src/models/HabitLog.js';
import Notification from './src/models/Notification.js';
import CachedAnalysis from './src/models/CachedAnalysis.js';
import MonthlyBudget from './src/models/MonthlyBudget.js';

dotenv.config();

const API_URL = 'http://localhost:4000/api';

const runTests = async () => {
  console.log('==================================================');
  console.log('STARTING STUDENT LIFE AI COMPANION INTEGRATION TESTS');
  console.log('==================================================\n');

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✔ Connected to MongoDB.');

    const studentUser = await User.findOne({ email: 'student@campusflow.com' });
    if (!studentUser) {
      throw new Error('Student user student@campusflow.com not found in database.');
    }
    const userId = studentUser._id;
    console.log(`✔ Found Student User ID: ${userId}`);

    // Clear old test data
    console.log('Cleaning existing wellness logs, habits logs, expenses, budgets, companion notifications, and cached analyses...');
    await WellnessLog.deleteMany({ userId });
    await HabitLog.deleteMany({ userId });
    await Expense.deleteMany({ userId });
    await MonthlyBudget.deleteMany({ userId });
    await CachedAnalysis.deleteMany({ userId });
    await Notification.deleteMany({
      userId,
      alertType: { $in: ['budget_exceeded', 'burnout_risk_increase', 'sleep_deficit', 'upcoming_overloaded_week', 'savings_opportunity', 'wellness_decline'] }
    });
    console.log('✔ Database cleaned for student user.');

    // 1. Authenticate Student
    console.log('\n--- Test 1: Student Login ---');
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

    // 2. Log wellness logs (trigger sleep_deficit)
    console.log('\n--- Test 2: Create Wellness Log & Assert sleep_deficit Trigger ---');
    const wellnessRes = await fetch(`${API_URL}/life-companion/wellness`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        mood: 4,
        sleepHours: 5, // < 6 hours triggers sleep_deficit
        stressLevel: 2,
        exerciseMins: 35
      })
    });
    if (!wellnessRes.ok) {
      const err = await wellnessRes.json();
      throw new Error(`Failed to log wellness metrics: ${JSON.stringify(err)}`);
    }
    const wellnessLog = await wellnessRes.json();
    console.log('✔ Wellness log successfully created:', wellnessLog);

    // Verify sleep_deficit notification was created
    const sleepDeficitNotification = await Notification.findOne({
      userId,
      alertType: 'sleep_deficit'
    });
    if (!sleepDeficitNotification) {
      throw new Error('FAIL: sleep_deficit notification was not generated.');
    }
    console.log('✔ Success: sleep_deficit notification found in DB:', sleepDeficitNotification.title);

    // 3. Log another wellness log with sleep deficit to test 24h Cooldown
    console.log('\n--- Test 3: Test 24-hour Cooldown on sleep_deficit ---');
    const wellnessRes2 = await fetch(`${API_URL}/life-companion/wellness`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        mood: 4,
        sleepHours: 4, // Still < 6, should trigger, but cooldown should block it
        stressLevel: 2,
        exerciseMins: 40
      })
    });
    if (!wellnessRes2.ok) throw new Error('Failed to log second wellness log.');
    
    // Count sleep_deficit notifications (should still be exactly 1)
    const countSleepDeficit = await Notification.countDocuments({
      userId,
      alertType: 'sleep_deficit'
    });
    if (countSleepDeficit !== 1) {
      throw new Error(`FAIL: Cooldown check failed. Expected 1 notification, got ${countSleepDeficit}`);
    }
    console.log('✔ Success: Cooldown check suppressed duplicate sleep_deficit notification.');

    // 4. Log Expense & Assert budget_exceeded and savings_opportunity
    console.log('\n--- Test 4: Create Budget Overrun Expense & Assert Alerts ---');
    const expenseRes = await fetch(`${API_URL}/life-companion/expense`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        amount: 550, // exceeds $500 monthly limit
        category: 'Shopping',
        description: 'Semester textbooks and jacket',
        date: new Date().toISOString()
      })
    });
    if (!expenseRes.ok) {
      const err = await expenseRes.json();
      throw new Error(`Failed to log expense: ${JSON.stringify(err)}`);
    }
    const loggedExpense = await expenseRes.json();
    console.log('✔ Expense successfully logged:', loggedExpense);

    // Fetch dashboard to trigger evaluation of budget limit/savings notification creation
    console.log('Fetching dashboard to invoke budget limits checking...');
    const dbRes = await fetch(`${API_URL}/life-companion/dashboard`, {
      method: 'GET',
      headers: studentHeaders
    });
    if (!dbRes.ok) {
      const errText = await dbRes.text();
      throw new Error(`Failed to fetch dashboard: Status ${dbRes.status}. Error: ${errText}`);
    }
    const dashboardData = await dbRes.json();

    // Verify budget notifications exist
    const budgetAlert = await Notification.findOne({ userId, alertType: 'budget_exceeded' });
    const savingsAlert = await Notification.findOne({ userId, alertType: 'savings_opportunity' });
    if (!budgetAlert) {
      throw new Error('FAIL: budget_exceeded notification was not generated.');
    }
    if (!savingsAlert) {
      throw new Error('FAIL: savings_opportunity notification was not generated.');
    }
    console.log('✔ Success: budget_exceeded alert generated:', budgetAlert.title);
    console.log('✔ Success: savings_opportunity alert generated:', savingsAlert.title);

    // 5. Delete Expense
    console.log('\n--- Test 5: Delete Expense Log ---');
    const deleteRes = await fetch(`${API_URL}/life-companion/expense/${loggedExpense._id}`, {
      method: 'DELETE',
      headers: studentHeaders
    });
    if (!deleteRes.ok) throw new Error('Failed to delete expense.');
    console.log('✔ Success: Expense record deleted.');

    // 6. Habit checklist log toggle
    console.log('\n--- Test 6: Toggle Daily Habits ---');
    const habitRes = await fetch(`${API_URL}/life-companion/habits`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        sleep: true,
        waterIntake: true,
        exercise: false,
        meditation: true,
        studyHours: false
      })
    });
    if (!habitRes.ok) throw new Error('Failed to log habits.');
    const loggedHabits = await habitRes.json();
    console.log('✔ Habits successfully logged:', loggedHabits);
    if (!loggedHabits.sleep || !loggedHabits.waterIntake || !loggedHabits.meditation) {
      throw new Error('FAIL: Habit states did not update correctly.');
    }
    console.log('✔ Success: Habit states verified.');

    // 7. Verify Dashboard Scores and AI recommendation format
    console.log('\n--- Test 7: Verify Companion Dashboard scoring & AI Recommendations ---');
    const dbResFinal = await fetch(`${API_URL}/life-companion/dashboard`, {
      method: 'GET',
      headers: studentHeaders
    });
    if (!dbResFinal.ok) throw new Error('Failed to fetch dashboard final stats.');
    const dashboardDataFinal = await dbResFinal.json();

    console.log('Dashboard metrics response fields check:');
    console.log('Routine Brain Routine Score:', dashboardDataFinal.routineBrain?.routineScore);
    console.log('Wellness Engine Wellness Score:', dashboardDataFinal.lifeCompanion?.wellnessScore);
    console.log('Expense Intelligence Budget Score:', dashboardDataFinal.expenseIntelligence?.budgetScore);
    console.log('Habit Tracker Completion Metrics:', dashboardDataFinal.habitTracker?.completionMetrics);
    console.log('Burnout Guardian Burnout Risk Score:', dashboardDataFinal.burnoutGuardian?.burnoutRiskScore);
    console.log('Burnout Guardian Level:', dashboardDataFinal.burnoutGuardian?.burnoutLevel);

    if (
      dashboardDataFinal.routineBrain?.routineScore === undefined ||
      dashboardDataFinal.lifeCompanion?.wellnessScore === undefined ||
      dashboardDataFinal.expenseIntelligence?.budgetScore === undefined ||
      dashboardDataFinal.habitTracker?.completionMetrics === undefined ||
      dashboardDataFinal.burnoutGuardian?.burnoutRiskScore === undefined ||
      dashboardDataFinal.burnoutGuardian?.burnoutLevel === undefined
    ) {
      throw new Error('FAIL: Dashboard score metrics are missing or undefined.');
    }

    console.log('Checking recommendations format...');
    const recs = dashboardDataFinal.recommendations;
    if (!recs || !recs.academicRecommendations || !recs.weeklyActionPlan) {
      throw new Error('FAIL: AI Recommendations do not match the expected structure.');
    }
    console.log('✔ Recommendations structured correctly.');
    console.log('Sample Academic Advice:', recs.academicRecommendations[0]);
    console.log('Sample Weekly Task:', recs.weeklyActionPlan[0]);

    console.log('\n==================================================');
    console.log('ALL STUDENT LIFE AI COMPANION INTEGRATION TESTS PASSED!');
    console.log('==================================================\n');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST RUNNER EXCEPTION:', error.message);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

runTests();
