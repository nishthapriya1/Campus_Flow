import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './src/models/User.js';
import Attendance from './src/models/Attendance.js';
import Notification from './src/models/Notification.js';

dotenv.config();

const API_URL = 'http://localhost:4000/api';

const runAttendanceTests = async () => {
  console.log('==================================================');
  console.log('STARTING CAMPUS FLOW ATTENDANCE MODULE INTEGRATION TESTS');
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

    // Clear any prior test data
    const TEST_CODE = 'TEST999';
    await Attendance.deleteMany({ userId: studentUser._id, subjectCode: TEST_CODE });
    await Notification.deleteMany({ userId: studentUser._id, title: { $regex: TEST_CODE } });
    console.log('✔ Cleared prior test data.');

    // 2. Fetch Initial List
    console.log('\nTest 2: GET /api/attendance...');
    const getRes = await fetch(`${API_URL}/attendance`, { headers });
    if (!getRes.ok) throw new Error(`GET /api/attendance failed with status ${getRes.status}`);
    const initialSubjects = await getRes.json();
    console.log(`✔ GET /api/attendance returned ${initialSubjects.length} subjects.`);

    // 3. Create Subject (SAFE zone: 8 / 10 = 80%)
    console.log('\nTest 3: POST /api/attendance (Create Subject with logs pre-population)...');
    const postRes = await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subjectName: 'Test Automation Course',
        subjectCode: TEST_CODE,
        type: 'Theory',
        conducted: 10,
        attended: 8,
      }),
    });

    if (!postRes.ok) {
      const errData = await postRes.json();
      throw new Error(`POST /api/attendance failed: ${errData.error}`);
    }

    let subject = await postRes.json();
    console.log(`✔ Subject created successfully. ID: ${subject._id}`);
    
    // Verify logs were pre-populated
    if (!subject.logs || subject.logs.length !== 10) {
      throw new Error(`Expected 10 logs, found: ${subject.logs?.length}`);
    }
    const presents = subject.logs.filter(l => l.status === 'present').length;
    if (presents !== 8) {
      throw new Error(`Expected 8 present logs, found: ${presents}`);
    }
    console.log('✔ Checked: 10 daily logs pre-populated (8 present, 2 absent) successfully.');

    // 4. Test Duplicate Prevention
    console.log('\nTest 4: POST /api/attendance duplicate check...');
    const dupRes = await fetch(`${API_URL}/attendance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subjectName: 'Duplicate Course',
        subjectCode: TEST_CODE,
        type: 'Theory',
        conducted: 5,
        attended: 4,
      }),
    });
    if (dupRes.status !== 409) {
      throw new Error(`Expected status 409 for duplicate, got ${dupRes.status}`);
    }
    console.log('✔ Success: Duplicate subject code rejected with 409 conflict.');

    // 5. Log Absent class (Conducted becomes 11, Attended remains 8: 8/11 = 72.7% - WARNING)
    console.log('\nTest 5: Log Absent (drop to 72.7% - WARNING)...');
    const absentRes1 = await fetch(`${API_URL}/attendance/${subject._id}/log`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action: 'absent' }),
    });

    if (!absentRes1.ok) throw new Error('Failed to log absent class');
    subject = await absentRes1.json();
    console.log(`✔ Absent logged. New count: ${subject.attended}/${subject.conducted}, logs length: ${subject.logs.length}`);

    // Wait a brief moment to let async notifications logic proceed
    await new Promise(r => setTimeout(r, 200));

    // Verify warning notification was created
    const warnings = await Notification.find({
      userId: studentUser._id,
      alertType: 'attendance_warning',
      title: { $regex: TEST_CODE },
      read: false
    });
    if (warnings.length !== 1) {
      throw new Error(`Expected exactly 1 unread warning notification, found ${warnings.length}`);
    }
    console.log(`✔ Warning notification triggered successfully: "${warnings[0].title}"`);

    // 6. Test manual historical logging (POST /api/attendance/:id/logs)
    console.log('\nTest 6: Manually log past Present class...');
    const manualDate = new Date();
    manualDate.setDate(manualDate.getDate() - 15); // 15 days ago
    const manualRes = await fetch(`${API_URL}/attendance/${subject._id}/logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        date: manualDate,
        status: 'present'
      })
    });
    if (!manualRes.ok) {
      const err = await manualRes.json();
      throw new Error(`Failed to add manual log: ${err.error}`);
    }
    subject = await manualRes.json();
    console.log(`✔ Manual log added. New counts: ${subject.attended}/${subject.conducted} (Logs length: ${subject.logs.length})`);
    if (subject.conducted !== 12 || subject.attended !== 9) {
      throw new Error(`Expected counts to be 9/12, got ${subject.attended}/${subject.conducted}`);
    }

    // 7. Test Toggling log status (PATCH /api/attendance/:id/logs/:logId)
    console.log('\nTest 7: Toggle status of manual log entry to Absent...');
    const targetLog = subject.logs.find(l => new Date(l.date).toDateString() === manualDate.toDateString());
    if (!targetLog) throw new Error('Target log entry not found in list');

    const toggleRes = await fetch(`${API_URL}/attendance/${subject._id}/logs/${targetLog._id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'absent' })
    });
    if (!toggleRes.ok) throw new Error('Failed to toggle log status');
    subject = await toggleRes.json();
    console.log(`✔ Log toggled. New counts: ${subject.attended}/${subject.conducted}`);
    if (subject.attended !== 8 || subject.conducted !== 12) {
      throw new Error(`Expected counts to revert to 8/12, got ${subject.attended}/${subject.conducted}`);
    }

    // 8. Test Deleting log entry (DELETE /api/attendance/:id/logs/:logId)
    console.log('\nTest 8: Delete log entry...');
    const deleteLogRes = await fetch(`${API_URL}/attendance/${subject._id}/logs/${targetLog._id}`, {
      method: 'DELETE',
      headers
    });
    if (!deleteLogRes.ok) throw new Error('Failed to delete log entry');
    subject = await deleteLogRes.json();
    console.log(`✔ Log deleted. New counts: ${subject.attended}/${subject.conducted}`);
    if (subject.conducted !== 11 || subject.attended !== 8) {
      throw new Error(`Expected counts to be 8/11, got ${subject.attended}/${subject.conducted}`);
    }

    // 9. Drop to CRITICAL status (<65%) and check notifications
    console.log('\nTest 9: Log Absent multiple times to reach critical (<65%)...');
    // Current is 8/11 = 72.7%.
    // Log 2 more absents -> 8/13 = 61.5%.
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${API_URL}/attendance/${subject._id}/log`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'absent' })
      });
      if (!res.ok) throw new Error('Failed to log absent class');
    }
    
    await new Promise(r => setTimeout(r, 200));

    const warningsAfterCritical = await Notification.find({
      userId: studentUser._id,
      alertType: 'attendance_warning',
      title: { $regex: TEST_CODE },
      read: false
    });
    const criticals = await Notification.find({
      userId: studentUser._id,
      alertType: 'attendance_critical',
      title: { $regex: TEST_CODE },
      read: false
    });

    if (warningsAfterCritical.length === 0) {
      throw new Error(`Expected warning notifications to remain unread, found ${warningsAfterCritical.length}`);
    }
    if (criticals.length !== 1) {
      throw new Error(`Expected exactly 1 critical notification, found ${criticals.length}`);
    }
    console.log(`✔ Success: Warning notification remained unread and critical alert triggered successfully.`);

    // 10. Clean up and delete subject
    console.log('\nTest 10: DELETE /api/attendance/:id (Clean up subject)...');
    const delRes = await fetch(`${API_URL}/attendance/${subject._id}`, {
      method: 'DELETE',
      headers,
    });
    if (!delRes.ok) throw new Error('DELETE request failed');
    
    const dbCheck = await Attendance.findById(subject._id);
    if (dbCheck) throw new Error('Attendance document was not deleted from DB.');

    console.log('✔ Subject deleted and notifications cleaned up successfully.');

    console.log('\n==================================================');
    console.log('ALL CAMPUS FLOW ATTENDANCE TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ FAIL: Attendance E2E test suite encountered an error:', error.message);
    process.exit(1);
  }
};

runAttendanceTests();
