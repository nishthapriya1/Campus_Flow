import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import RoutineFeedback from './src/models/RoutineFeedback.js';

dotenv.config();

const API_URL = 'http://localhost:4000/api';

const runTests = async () => {
  console.log('==================================================');
  console.log('STARTING CAMPUS FLOW ROUTINE INTELLIGENCE INTEGRATION TEST');
  console.log('==================================================\n');

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✔ Connected to MongoDB.');

    const studentUser = await User.findOne({ email: 'student@campusflow.com' });
    if (!studentUser) {
      throw new Error('Student user student@campusflow.com not found in database.');
    }

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
    if (!studentLoginRes.ok) {
      throw new Error('Student login failed.');
    }
    const studentLoginData = await studentLoginRes.json();
    const studentToken = studentLoginData.token;
    const studentHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    };
    console.log('✔ Student login successful.');

    // 2. Fetch Routine Intelligence Analysis
    console.log('\nTest 2: Fetching Routine Analysis...');
    const analyzeRes = await fetch(`${API_URL}/routine/analyze`, {
      headers: studentHeaders,
    });
    if (!analyzeRes.ok) {
      const errText = await analyzeRes.text();
      throw new Error(`Failed to fetch routine analysis: ${errText}`);
    }
    const analyzeData = await analyzeRes.json();
    console.log('✔ Routine analysis response received successfully.');
    
    // Validate response payload structure
    const { analysis, feedback } = analyzeData;
    if (!analysis) {
      throw new Error('Response payload is missing the "analysis" field.');
    }
    console.log('✔ Analysis Structure Validation:');
    console.log('  Routine Score:', analysis.routineScore);
    console.log('  Confidence Score:', analysis.confidenceScore);
    console.log('  Productivity Profile:', JSON.stringify(analysis.productivityProfile));
    console.log('  Study Profile:', JSON.stringify(analysis.studyProfile));
    console.log('  Attendance Profile:', JSON.stringify(analysis.attendanceProfile));
    console.log('  Recommendations:', analysis.personalizedRecommendations?.length);

    if (
      typeof analysis.routineScore !== 'number' ||
      typeof analysis.confidenceScore !== 'number' ||
      !analysis.productivityProfile ||
      !analysis.studyProfile ||
      !analysis.attendanceProfile ||
      !Array.isArray(analysis.personalizedRecommendations)
    ) {
      throw new Error('Analysis payload structure does not match expected fields.');
    }
    console.log('✔ Analysis payload validated successfully.');

    // Clean up any existing feedback for the test ID to make it clean
    const testInsightId = 'rec_routine_1';
    await RoutineFeedback.deleteMany({ userId: studentUser._id, insightId: testInsightId });

    // 3. Post Helpfulness Feedback
    console.log('\nTest 3: Submitting Recommendations Helpfulness Feedback...');
    const feedbackRes = await fetch(`${API_URL}/routine/feedback`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        insightId: testInsightId,
        isHelpful: true,
        comments: 'This recommendation is very helpful!',
      }),
    });
    if (!feedbackRes.ok) {
      const errText = await feedbackRes.text();
      throw new Error(`Failed to post feedback: ${errText}`);
    }
    const feedbackData = await feedbackRes.json();
    console.log('✔ Feedback response:', JSON.stringify(feedbackData));
    
    if (feedbackData.insightId !== testInsightId || feedbackData.isHelpful !== true || feedbackData.comments !== 'This recommendation is very helpful!') {
      throw new Error('Saved feedback properties do not match submission.');
    }
    console.log('✔ Feedback saved correctly in database.');

    // 4. Verify learning/adaptation works (re-fetch should include feedback logs)
    console.log('\nTest 4: Re-fetching Analysis & Verifying Feedback Adaptation...');
    const reAnalyzeRes = await fetch(`${API_URL}/routine/analyze`, {
      headers: studentHeaders,
    });
    const reAnalyzeData = await reAnalyzeRes.json();
    const updatedFeedbackList = reAnalyzeData.feedback || [];
    const testFeedbackItem = updatedFeedbackList.find(f => f.insightId === testInsightId);
    
    if (!testFeedbackItem) {
      throw new Error('Feedback not returned in updated analysis fetch.');
    }
    console.log('✔ Feedback successfully integrated into analyze output:', testFeedbackItem.insightId);
    console.log('✔ Routine Score (re-fetched):', reAnalyzeData.analysis.routineScore);
    console.log('✔ Confidence Score (re-fetched):', reAnalyzeData.analysis.confidenceScore);

    console.log('\n==================================================');
    console.log('✔ ALL CAMPUS FLOW ROUTINE INTELLIGENCE TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================');

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
};

runTests();
