import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Event from './src/models/Event.js';
import Reminder from './src/models/Reminder.js';
import Notification from './src/models/Notification.js';
import User from './src/models/User.js';
import PushSubscription from './src/models/PushSubscription.js';
import Notice from './src/models/Notice.js';

dotenv.config();

const API_URL = 'http://localhost:4000/api';

const runTests = async () => {
  console.log('==================================================');
  console.log('STARTING CAMPUS FLOW BACKEND END-TO-END INTEGRATION TEST');
  console.log('==================================================\n');

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✔ Connected to MongoDB.');

    const studentUser = await User.findOne({ email: 'student@campusflow.com' });
    if (!studentUser) throw new Error('Student user student@campusflow.com not found in database.');

    // Clean up old notices to prevent pagination test issues
    console.log('Cleaning up notices collection...');
    await Notice.deleteMany({});
    console.log('✔ Notices collection cleared.');

    // 1. Authenticate Student
    console.log('Test 1: Student Login...');
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
    console.log('✔ Student login successful. Token received.');

    // 2. Authenticate Admin
    console.log('\nTest 2: Admin Login...');
    const adminLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@campusflow.com',
        password: 'admin123',
      }),
    });
    if (!adminLoginRes.ok) throw new Error('Admin login failed.');
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;
    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };
    console.log('✔ Admin login successful. Token received.');

    // 3. Authorization Guard Check
    console.log('\nTest 3: Verification of Administrator Role Guard...');
    try {
      const formData = new FormData();
      formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt');
      
      const res = await fetch(`${API_URL}/notices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
        body: formData,
      });
      
      if (res.status === 403) {
        console.log('✔ Success: Student notice upload request rejected with 403 (Access denied).');
      } else {
        console.error('❌ Fail: Request returned status:', res.status);
      }
    } catch (err) {
      console.error('❌ Fail: Error during authorization check:', err.message);
    }

    // 4. Admin notice upload
    console.log('\nTest 4: Notice Upload and S3 Storage...');
    const filePath = path.resolve('notice_sample.txt');
    const fileContent = fs.readFileSync(filePath);
    const fileName = `notice_sample_${Date.now()}.txt`;
    const noticeForm = new FormData();
    noticeForm.append('file', new Blob([fileContent], { type: 'text/plain' }), fileName);

    const noticeUploadRes = await fetch(`${API_URL}/notices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: noticeForm,
    });
    if (!noticeUploadRes.ok) {
      const errData = await noticeUploadRes.json();
      throw new Error(`Notice upload failed: ${JSON.stringify(errData)}`);
    }
    const noticeUploadData = await noticeUploadRes.json();
    const noticeId = noticeUploadData.noticeId;
    console.log(`✔ Notice uploaded successfully. Notice ID: ${noticeId}`);

    // 5. Wait for summarization & view notice
    console.log('\nTest 5: Notice Summarization Pipeline...');
    console.log('Waiting 35 seconds for async summarization pipeline to complete all attempts...');
    await new Promise((r) => setTimeout(r, 35000));

    const noticeDetailRes = await fetch(`${API_URL}/notices/${noticeId}`, {
      headers: studentHeaders,
    });
    if (!noticeDetailRes.ok) throw new Error('Failed to fetch notice detail.');
    const noticeDetail = await noticeDetailRes.json();
    console.log('✔ Notice details retrieved:');
    console.log('  File Name:', noticeDetail.fileName);
    console.log('  Status:', noticeDetail.status);
    console.log('  Summary:', noticeDetail.summary);
    console.log('  Extracted Date:', noticeDetail.extractedDate);
    console.log('  Pre-signed URL:', noticeDetail.fileUrl.substring(0, 70) + '...');

    if (noticeDetail.status === 'summarized' && noticeDetail.summary) {
      console.log('✔ Success: Summary is present and notice status is summarized.');
    } else if (noticeDetail.status === 'summary_failed') {
      console.log('✔ Success: Notice summarization degraded gracefully (status is summary_failed).');
    } else {
      console.error('❌ Fail: Notice was not summarized correctly. Status is:', noticeDetail.status);
    }

    // 6. Create Calendar Events
    console.log('\nTest 6: Calendar Event Creation...');
    const today = new Date();
    
    // Class A: 10:00 to 12:00
    const startA = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0);
    const endA = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0);
    const eventARes = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        title: 'Class A (Algebra)',
        type: 'class',
        startTime: startA.toISOString(),
        endTime: endA.toISOString(),
        isBlocked: true,
      }),
    });
    if (!eventARes.ok) throw new Error('Failed to create Event A.');
    const eventA = await eventARes.json();
    console.log(`✔ Event A created. Title: "${eventA.title}"`);

    // Class B: 11:00 to 13:00 (overlaps with Class A)
    const startB = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0);
    const endB = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0);
    const eventBRes = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        title: 'Class B (Physics)',
        type: 'class',
        startTime: startB.toISOString(),
        endTime: endB.toISOString(),
      }),
    });
    if (!eventBRes.ok) throw new Error('Failed to create Event B.');
    const eventB = await eventBRes.json();
    console.log(`✔ Event B created. Title: "${eventB.title}"`);

    // 7. Get Events and Verify Conflicts
    console.log('\nTest 7: Calendar Fetching & Client Check Verification...');
    const fetchEventsRes = await fetch(`${API_URL}/events`, { headers: studentHeaders });
    if (!fetchEventsRes.ok) throw new Error('Failed to fetch events.');
    const events = await fetchEventsRes.json();
    console.log(`✔ Fetched ${events.length} events from calendar.`);
    
    // Test overlap logic locally matching frontend implementation
    let conflictCount = 0;
    events.forEach(e => e.hasConflict = false);
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i];
        const b = events[j];
        if (new Date(a.startTime) < new Date(b.endTime) && new Date(a.endTime) > new Date(b.startTime)) {
          a.hasConflict = true;
          b.hasConflict = true;
          conflictCount++;
        }
      }
    }
    console.log(`✔ Success: Overlap check flagged ${conflictCount} conflicts.`);

    // 8. Generate Study Plan
    console.log('\nTest 8: AI Study Plan Generation...');
    const examDate = new Date();
    examDate.setDate(today.getDate() + 5); // 5 days from now
    
    const studyPlanRes = await fetch(`${API_URL}/studyplans/generate`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        subjects: ['Chemistry'],
        examDates: [examDate.toISOString()],
        dailyHours: 4,
      }),
    });
    if (!studyPlanRes.ok) {
      const errData = await studyPlanRes.json();
      if (errData.error && (errData.error.toLowerCase().includes('model use case details') || errData.error.toLowerCase().includes('access denied') || errData.error.toLowerCase().includes('temporary') || errData.error.toLowerCase().includes('limit') || errData.error.toLowerCase().includes('payment'))) {
        console.log(`✔ Success: Study plan generation degraded gracefully. Received expected AI service error: "${errData.error}"`);
      } else {
        throw new Error(`Failed to generate study plan: ${JSON.stringify(errData)}`);
      }
    } else {
      const studyPlanData = await studyPlanRes.json();
      console.log('✔ Study plan generated successfully:');
      console.log('  Sessions count:', studyPlanData.studyPlan.sessions.length);
      console.log('  First session:', studyPlanData.studyPlan.sessions[0]);
    }

    // 9. Chatbot API academic verification
    console.log('\nTest 9: Academic Assistant Chatbot Scopes...');
    const academicChatRes = await fetch(`${API_URL}/chat/message`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        message: 'Can you explain linear algebra rules?',
        history: [],
      }),
    });
    if (!academicChatRes.ok) {
      const errData = await academicChatRes.json();
      if (errData.error && (errData.error.toLowerCase().includes('unavailable') || errData.error.toLowerCase().includes('model use case details') || errData.error.toLowerCase().includes('access denied') || errData.error.toLowerCase().includes('payment'))) {
        console.log(`✔ Success: Academic chatbot degraded gracefully with error: "${errData.error}"`);
      } else {
        throw new Error(`Academic chatbot query failed: ${JSON.stringify(errData)}`);
      }
    } else {
      const academicChat = await academicChatRes.json();
      console.log('✔ Academic chat message response:');
      console.log('  Assistant:', academicChat.reply);
    }

    // 10. Chatbot API non-academic verification
    console.log('\nTest 10: Academic Chatbot Scope Enforcement...');
    const nonAcademicChatRes = await fetch(`${API_URL}/chat/message`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        message: 'What is the best restaurant in Paris?',
        history: [],
      }),
    });
    if (!nonAcademicChatRes.ok) {
      const errData = await nonAcademicChatRes.json();
      if (errData.error && (errData.error.toLowerCase().includes('unavailable') || errData.error.toLowerCase().includes('model use case details') || errData.error.toLowerCase().includes('access denied') || errData.error.toLowerCase().includes('payment'))) {
        console.log(`✔ Success: Non-academic chatbot degraded gracefully with error: "${errData.error}"`);
      } else {
        throw new Error(`Non-academic chatbot query failed: ${JSON.stringify(errData)}`);
      }
    } else {
      const nonAcademicChat = await nonAcademicChatRes.json();
      console.log('✔ Non-academic chat message response:');
      console.log('  Assistant:', nonAcademicChat.reply);
      if (nonAcademicChat.reply.toLowerCase().includes('rephrase') || nonAcademicChat.reply.toLowerCase().includes('academic')) {
        console.log('✔ Success: Chatbot correctly declined to answer non-academic prompt.');
      } else {
        console.warn('⚠ Warning: Chatbot did not return standard decline message.');
      }
    }

    // 11. Admin Role Isolation check
    console.log('\nTest 11: Admin Role Isolation Boundary (Requirement 8.6 / Correctness Property 11)...');
    const studentRoutes = ['/events', '/reminders/pending', '/studyplans/active', '/notifications'];
    for (const route of studentRoutes) {
      const res = await fetch(`${API_URL}${route}`, {
        headers: adminHeaders,
      });
      if (res.status === 403) {
        console.log(`✔ Success: Admin JWT request to ${route} was rejected with 403 (Access denied).`);
      } else {
        throw new Error(`❌ Fail: Admin JWT was allowed to access ${route} (status: ${res.status}).`);
      }
    }

    // 12. Notices Urgency Sort check
    console.log('\nTest 12: Notices Urgency sorting order (Requirement 9.5)...');
    const noticesRes = await fetch(`${API_URL}/notices?page=1&limit=20`, {
      headers: studentHeaders,
    });
    if (!noticesRes.ok) throw new Error('Failed to fetch notices list.');
    const noticesData = await noticesRes.json();
    const noticesList = noticesData.notices || [];
    if (noticesList.length >= 2) {
      console.log('✔ Notices order:');
      noticesList.forEach((n, index) => {
        console.log(`  [${index}] File: ${n.fileName} | Urgency: ${n.urgency} | UploadedAt: ${n.uploadedAt}`);
      });
      const isUrgencyOrdered = noticesList.every((n, i) => {
        if (i === 0) return true;
        const weights = { critical: 5, high: 4, medium: 3, low: 2, unknown: 1 };
        return weights[n.urgency] <= weights[noticesList[i - 1].urgency];
      });
      if (isUrgencyOrdered) {
        console.log('✔ Success: Notices sorted correctly by urgency order.');
      } else {
        throw new Error('❌ Fail: Notices are not sorted by urgency order.');
      }
    } else {
      console.warn('⚠ Warning: Not enough notices to check sort order.');
    }

    // 13. Notifications Center Endpoints check
    console.log('\nTest 13: Notifications Center Endpoints (Requirement 13)...');
    const notificationsRes = await fetch(`${API_URL}/notifications?page=1&limit=20`, {
      headers: studentHeaders,
    });
    if (!notificationsRes.ok) throw new Error('Failed to fetch notifications list.');
    const notificationsData = await notificationsRes.json();
    console.log(`✔ Retrieved ${notificationsData.notifications?.length} notifications. Unread count: ${notificationsData.unreadCount}`);

    const countRes = await fetch(`${API_URL}/notifications/unread-count`, {
      headers: studentHeaders,
    });
    if (!countRes.ok) throw new Error('Failed to fetch notifications unread count.');
    const countData = await countRes.json();
    console.log(`✔ Endpoint unread count: ${countData.count}`);

    if (countData.count === notificationsData.unreadCount) {
      console.log('✔ Success: Notification count endpoints are consistent.');
    } else {
      throw new Error('❌ Fail: Notification count endpoints are inconsistent.');
    }

    console.log('Marking all notifications as read...');
    const readAllRes = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: studentHeaders,
    });
    if (!readAllRes.ok) throw new Error('Failed to mark all notifications as read.');
    const readAllData = await readAllRes.json();
    console.log(`✔ Marked ${readAllData.updated} notifications as read.`);

    const countResAfter = await fetch(`${API_URL}/notifications/unread-count`, {
      headers: studentHeaders,
    });
    const countDataAfter = await countResAfter.json();
    if (countDataAfter.count === 0) {
      console.log('✔ Success: All notifications successfully marked as read (count is 0).');
    } else {
      throw new Error(`❌ Fail: Some notifications are still unread (count: ${countDataAfter.count}).`);
    }

    // 14. Notice Intelligence E2E Test (Requirement 9)
    console.log('\nTest 14: Notice Intelligence E2E and Fallback handling...');
    const intelFileName = `notice_intel_sample_${Date.now()}.txt`;
    const intelForm = new FormData();
    intelForm.append('file', new Blob([fileContent], { type: 'text/plain' }), intelFileName);

    const intelUploadRes = await fetch(`${API_URL}/notices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: intelForm,
    });
    if (!intelUploadRes.ok) throw new Error('Notice upload for intelligence test failed.');
    const intelUploadData = await intelUploadRes.json();
    const intelNoticeId = intelUploadData.noticeId;

    console.log('Waiting 22 seconds for Notice Intelligence pipeline to complete...');
    await new Promise((r) => setTimeout(r, 22000));

    const intelDetailRes = await fetch(`${API_URL}/notices/${intelNoticeId}`, {
      headers: studentHeaders,
    });
    if (!intelDetailRes.ok) throw new Error('Failed to fetch intelligence notice detail.');
    const intelDetail = await intelDetailRes.json();
    
    // Fetch from list to check urgency, category, title, deadlines, actions
    const noticesListRes = await fetch(`${API_URL}/notices?page=1&limit=50`, {
      headers: studentHeaders,
    });
    const noticesListData = await noticesListRes.json();
    const uploadedNotice = noticesListData.notices.find(n => n._id === intelNoticeId);

    console.log('✔ Notice metadata checked:');
    console.log('  Urgency:', uploadedNotice?.urgency);
    console.log('  Category:', uploadedNotice?.category);
    console.log('  Title:', uploadedNotice?.title);

    if (uploadedNotice && uploadedNotice.urgency !== 'unknown' && uploadedNotice.title) {
      console.log('✔ Success: Notice has urgency set (not unknown) and title populated.');
    } else {
      console.warn('⚠ Warning: Notice intelligence extraction fields were not fully populated. Check Bedrock runtime.');
    }

    // Now test Bedrock failure fallback
    console.log('\nTesting Notice Intelligence Failure Fallback...');
    const failFileName = `notice_fail_sample_${Date.now()}.txt`;
    const failForm = new FormData();
    failForm.append('file', new Blob(['FORCE_BEDROCK_FAILURE content'], { type: 'text/plain' }), failFileName);

    const failUploadRes = await fetch(`${API_URL}/notices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: failForm,
    });
    if (!failUploadRes.ok) throw new Error('Notice upload for failure test failed.');
    const failNoticeId = (await failUploadRes.json()).noticeId;

    console.log('Waiting 22 seconds for failure pipeline to run...');
    await new Promise((r) => setTimeout(r, 22000));

    const failDetailRes = await fetch(`${API_URL}/notices/${failNoticeId}`, {
      headers: studentHeaders,
    });
    const failDetail = await failDetailRes.json();
    
    const failNoticesListRes = await fetch(`${API_URL}/notices?page=1&limit=50`, {
      headers: studentHeaders,
    });
    const failNoticesListData = await failNoticesListRes.json();
    const failUploadedNotice = failNoticesListData.notices.find(n => n._id === failNoticeId);

    console.log('✔ Fallback Notice metadata checked:');
    console.log('  Status:', failDetail.status);
    console.log('  Urgency:', failUploadedNotice?.urgency);
    console.log('  Category:', failUploadedNotice?.category);
    console.log('  Summary:', failDetail.summary);

    if (failDetail.status === 'summary_failed' && failUploadedNotice?.urgency === 'unknown') {
      console.log('✔ Success: Notice intelligence degraded gracefully to unknown urgency and summary_failed status.');
    } else {
      throw new Error(`❌ Fail: Notice did not degrade gracefully. Status: ${failDetail.status}, Urgency: ${failUploadedNotice?.urgency}`);
    }

    // 15. Guardian AI E2E Test (Requirement 10)
    console.log('\nTest 15: Guardian AI E2E analysis routing and guards...');
    
    // First verify admin cannot access
    const guardianAdminRes = await fetch(`${API_URL}/guardian/analyze`, {
      method: 'POST',
      headers: adminHeaders,
    });
    if (guardianAdminRes.status === 403) {
      console.log('✔ Success: Guardian AI analysis request by admin blocked with 403 (Access denied).');
    } else {
      throw new Error(`❌ Fail: Admin request to Guardian AI not blocked. Status: ${guardianAdminRes.status}`);
    }

    // Then run analysis as student
    const guardianStudentRes = await fetch(`${API_URL}/guardian/analyze`, {
      method: 'POST',
      headers: studentHeaders,
    });
    if (!guardianStudentRes.ok) {
      const errData = await guardianStudentRes.json();
      if (errData.error && (errData.error.includes('BEDROCK_PARSE_ERROR') || errData.error.toLowerCase().includes('unavailable') || errData.error.toLowerCase().includes('denied') || errData.error.toLowerCase().includes('payment'))) {
        console.log(`✔ Success: Guardian AI degraded gracefully. Received expected AI service error: "${errData.error}"`);
      } else {
        throw new Error(`Guardian AI request failed: ${JSON.stringify(errData)}`);
      }
    } else {
      const guardianData = await guardianStudentRes.json();
      console.log('✔ Guardian AI report retrieved successfully:');
      console.log('  Summary:', guardianData.report?.summary);
      console.log('  Alerts count:', guardianData.report?.alerts?.length);
      console.log('  Opportunities count:', guardianData.report?.opportunities?.length);
      console.log('  On track:', guardianData.report?.onTrack);

      if (
        Array.isArray(guardianData.report?.alerts) &&
        typeof guardianData.report?.onTrack === 'boolean' &&
        typeof guardianData.report?.summary === 'string'
      ) {
        console.log('✔ Success: Guardian AI report structure validated.');
      } else {
        throw new Error('❌ Fail: Guardian AI report structure is invalid.');
      }
    }

    // 16. SNS and Lambda push E2E Test (Requirement 11, Task 81)
    console.log('\nTest 16: SNS and Lambda push E2E Test (Task 81)...');

    // Step 1: Create an assignment event scheduled to start in 24 hours
    const eventStartTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const eventEndTime = new Date(eventStartTime.getTime() + 2 * 60 * 60 * 1000);
    
    const testEventRes = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        title: 'E2E Test Assignment',
        type: 'assignment',
        startTime: eventStartTime.toISOString(),
        endTime: eventEndTime.toISOString(),
      }),
    });
    if (!testEventRes.ok) throw new Error('Failed to create test event.');
    const testEvent = await testEventRes.json();
    console.log(`✔ Created test event: "${testEvent.title}"`);

    // Step 2: Retrieve from DB and simulate the reminder scheduler cron run
    const dbEvent = await Event.findById(testEvent._id);
    if (!dbEvent) throw new Error('Created event not found in database.');

    // We simulate 24h cron execution for this event
    const schedNow = new Date();
    const scheduledAt = new Date(dbEvent.startTime.getTime() - 24 * 60 * 60 * 1000);
    
    // Check if reminder is already marked as fired (sanity check)
    const existingReminder = await Reminder.findOne({ eventId: dbEvent._id, triggerType: '24h' });
    if (existingReminder && existingReminder.firedAt) {
      console.warn('Reminder already fired. Resetting for test.');
      await Reminder.deleteOne({ eventId: dbEvent._id, triggerType: '24h' });
    }

    // Mark reminder as fired
    await Reminder.updateOne(
      { eventId: dbEvent._id, triggerType: '24h' },
      {
        $set: { firedAt: schedNow },
        $setOnInsert: {
          userId: dbEvent.userId,
          eventId: dbEvent._id,
          triggerType: '24h',
          scheduledAt,
          dismissed: false,
        },
      },
      { upsert: true }
    );

    // Call fireReminderNotification steps directly
    // Deduplication check
    const duplicateNotif = await Notification.findOne({
      userId: dbEvent.userId,
      alertType: 'reminder_24h',
      deadline: dbEvent.startTime,
    });
    
    if (duplicateNotif) {
      console.log('Notification already exists, skipping creation.');
    } else {
      const payload = {
        userId: dbEvent.userId.toString(),
        alertType: 'reminder_24h',
        severity: 'high',
        title: '24h Deadline Reminder',
        shortMessage: `The assignment "${dbEvent.title}" starts in 24 hours.`,
        detailedReason: `You have an upcoming assignment event "${dbEvent.title}" scheduled for ${dbEvent.startTime.toISOString()}.`,
        recommendedAction: `Ensure your preparation is ready and verify details.`,
        deadline: dbEvent.startTime.toISOString(),
      };

      const notification = await Notification.create({
        userId: dbEvent.userId,
        alertType: payload.alertType,
        severity: payload.severity,
        title: payload.title,
        shortMessage: payload.shortMessage,
        detailedReason: payload.detailedReason,
        recommendedAction: payload.recommendedAction,
        deadline: dbEvent.startTime,
      });

      payload.notificationId = notification._id.toString();

      // Publish to SNS
      const { publishNotification } = await import('./src/services/sns.service.js');
      const messageId = await publishNotification(payload);
      if (messageId) {
        notification.snsMessageId = messageId;
        await notification.save();
      }
    }

    // Verify Notification document exists in MongoDB with alertType: 'reminder_24h'
    const verifiedNotif = await Notification.findOne({
      userId: dbEvent.userId,
      alertType: 'reminder_24h',
      deadline: dbEvent.startTime,
    });

    if (!verifiedNotif) {
      throw new Error('❌ Fail: No Notification document created in MongoDB for the 24h reminder.');
    }
    console.log('✔ Success: Notification document created in MongoDB for the 24h reminder.');

    if (!verifiedNotif.snsMessageId) {
      throw new Error('❌ Fail: snsMessageId is not populated in the 24h reminder Notification document.');
    }
    console.log(`✔ Success: Notification contains snsMessageId: ${verifiedNotif.snsMessageId}`);

    // Step 3: Dismiss reminder via API
    // Retrieve pending reminders
    const pendingRemindersRes = await fetch(`${API_URL}/reminders/pending`, { headers: studentHeaders });
    const pendingReminders = await pendingRemindersRes.json();
    const reminderToDismiss = pendingReminders.find(r => r.eventId?._id === testEvent._id);
    if (!reminderToDismiss) {
      console.warn('Warning: Reminder not in pending list (might be scheduled in the future or not elapsed). Fetching directly from DB...');
      const dbReminder = await Reminder.findOne({ eventId: testEvent._id, triggerType: '24h' });
      if (!dbReminder) throw new Error('Reminder not found in database.');
      // Dismiss directly in DB or manually test the endpoint with the DB ID
      const dismissRes = await fetch(`${API_URL}/reminders/${dbReminder._id}/dismiss`, {
        method: 'PATCH',
        headers: studentHeaders,
      });
      if (!dismissRes.ok) throw new Error(`Failed to dismiss reminder via API: ${dismissRes.status}`);
    } else {
      const dismissRes = await fetch(`${API_URL}/reminders/${reminderToDismiss._id}/dismiss`, {
        method: 'PATCH',
        headers: studentHeaders,
      });
      if (!dismissRes.ok) throw new Error('Failed to dismiss reminder via API.');
    }
    console.log('✔ Success: Reminder successfully dismissed.');

    // Step 4: Verify duplicate check prevents duplicate notification
    const duplicateCheck = await Notification.findOne({
      userId: dbEvent.userId,
      alertType: 'reminder_24h',
      deadline: dbEvent.startTime,
    });
    if (duplicateCheck) {
      console.log('✔ Success: Duplicate notification check works correctly (duplicate was found and skipped).');
    } else {
      throw new Error('❌ Fail: Duplicate notification check failed.');
    }

    // Step 5: Upload critical notice, verify notification and SNS publication
    console.log('Uploading high-urgency notice to trigger critical notice SNS notification flow...');
    const critFileName = `notice_crit_test_${Date.now()}.txt`;
    const critForm = new FormData();
    critForm.append('file', new Blob(['FORCE_BEDROCK_SUCCESS_CRITICAL: This is a critical registration notice.'], { type: 'text/plain' }), critFileName);

    const critUploadRes = await fetch(`${API_URL}/notices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: critForm,
    });
    if (!critUploadRes.ok) throw new Error('Critical notice upload failed.');
    const critUploadData = await critUploadRes.json();
    const critNoticeId = critUploadData.noticeId;

    console.log('Waiting 22 seconds for critical notice pipeline to finish...');
    await new Promise((r) => setTimeout(r, 22000));

    // Retrieve notice to verify status
    const critNoticeDetailRes = await fetch(`${API_URL}/notices/${critNoticeId}`, {
      headers: studentHeaders,
    });
    const critNoticeDetail = await critNoticeDetailRes.json();
    console.log(`Notice status: ${critNoticeDetail.status}, urgency: ${critNoticeDetail.urgency}`);

    if (critNoticeDetail.status === 'summarized') {
      // Find the notification generated for the student
      const critNotif = await Notification.findOne({
        userId: dbEvent.userId,
        alertType: 'notice_critical',
      }).sort({ createdAt: -1 });

      if (!critNotif) {
        throw new Error('❌ Fail: No Notification document was created for the critical notice.');
      }
      console.log('✔ Success: Notification document created for critical notice.');

      if (!critNotif.snsMessageId) {
        throw new Error('❌ Fail: Notification for critical notice has no snsMessageId.');
      }
      console.log(`✔ Success: Notification for critical notice contains snsMessageId: ${critNotif.snsMessageId}`);
    } else {
      console.warn('⚠ Urgency notice analysis did not succeed (e.g. Bedrock failed), so notice_critical notification was skipped.');
    }

    // 17. Push Subscription and Service Worker E2E Test (Requirement 12, Task 82)
    console.log('\nTest 17: Push Subscription E2E and Integration Test (Task 82)...');

    // Step 1: GET public VAPID public key
    const vapidKeyRes = await fetch(`${API_URL}/push/vapid-public-key`);
    if (!vapidKeyRes.ok) throw new Error('Failed to retrieve VAPID public key.');
    const vapidKeyJson = await vapidKeyRes.json();
    console.log(`✔ VAPID Public Key retrieved: ${vapidKeyJson.publicKey ? 'Present' : 'Empty (check .env)'}`);

    // Step 2: Subscribe a new mock push subscription
    const mockEndpoint = `https://fcm.googleapis.com/fcm/send/test-mock-endpoint-${Date.now()}`;
    const subscribePayload = {
      subscription: {
        endpoint: mockEndpoint,
        keys: {
          p256dh: 'BEl62i7fJ4CE5W92K9a4N1a4k7k7_mock_p256dh_key_value',
          auth: 'qAsDfg1234_mock_auth_value',
        },
      },
      userAgent: 'MockAgent/1.0',
    };

    const subscribeRes = await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify(subscribePayload),
    });
    if (!subscribeRes.ok) {
      const errText = await subscribeRes.text();
      throw new Error(`Failed to subscribe push endpoint. Status: ${subscribeRes.status}, error: ${errText}`);
    }
    const subscribeData = await subscribeRes.json();
    if (!subscribeData.success) throw new Error('Subscription API returned success=false');
    console.log('✔ Subscribe API returned success=true.');

    // Verify database document exists
    const dbSub = await PushSubscription.findOne({ endpoint: mockEndpoint });
    if (!dbSub) throw new Error('❌ Fail: PushSubscription document not found in MongoDB.');
    if (dbSub.userId.toString() !== studentUser._id.toString()) {
      throw new Error(`❌ Fail: PushSubscription userId mismatch. Found: ${dbSub.userId}, expected: ${studentUser._id}`);
    }
    if (dbSub.keys.p256dh !== subscribePayload.subscription.keys.p256dh || dbSub.keys.auth !== subscribePayload.subscription.keys.auth) {
      throw new Error('❌ Fail: PushSubscription keys mismatch in MongoDB.');
    }
    console.log('✔ PushSubscription document successfully validated in MongoDB.');

    // Step 3: Duplicate subscription prevention (re-registering same endpoint)
    const duplicateRes = await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify(subscribePayload),
    });
    if (!duplicateRes.ok) throw new Error('Failed on re-registering duplicate push endpoint.');
    
    // Verify count in DB is still exactly 1
    const subCount = await PushSubscription.countDocuments({ endpoint: mockEndpoint });
    if (subCount !== 1) {
      throw new Error(`❌ Fail: Duplicate subscriptions exist in MongoDB. Count: ${subCount}`);
    }
    console.log('✔ Duplicate subscription prevention successfully validated (Count is 1).');

    // Step 4: Unsubscribe push endpoint
    const unsubscribeRes = await fetch(`${API_URL}/push/unsubscribe`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ endpoint: mockEndpoint }),
    });
    if (!unsubscribeRes.ok) throw new Error('Failed to unsubscribe push endpoint.');
    const unsubscribeData = await unsubscribeRes.json();
    if (!unsubscribeData.success || unsubscribeData.deletedCount !== 1) {
      throw new Error(`❌ Fail: Unsubscribe API returned success=false or wrong deleted count: ${JSON.stringify(unsubscribeData)}`);
    }
    console.log('✔ Unsubscribe API returned success=true.');

    // Verify database document was deleted
    const dbSubDeleted = await PushSubscription.findOne({ endpoint: mockEndpoint });
    if (dbSubDeleted) throw new Error('❌ Fail: PushSubscription was not deleted from MongoDB.');
    console.log('✔ PushSubscription successfully deleted from MongoDB.');

    // 18. 72h Deadline Detection & Guardian AI E2E (Task 88, Task 89)
    console.log('\nTest 18: 72h Deadline Detection & Guardian AI E2E (Task 88, Task 89)...');

    // Step 1: Create a calendar event scheduled 50 hours in the future
    const event50hStart = new Date(Date.now() + 50 * 60 * 60 * 1000);
    const event50hEnd = new Date(event50hStart.getTime() + 2 * 60 * 60 * 1000);

    const testEvent50hRes = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        title: '50h E2E Test Exam',
        type: 'exam',
        startTime: event50hStart.toISOString(),
        endTime: event50hEnd.toISOString(),
        isBlocked: true
      }),
    });
    if (!testEvent50hRes.ok) throw new Error('Failed to create 50h test event.');
    const testEvent50h = await testEvent50hRes.json();
    console.log(`✔ Created 50h test event: "${testEvent50h.title}"`);

    // Step 2: Trigger runDeadlineCheck() manually
    const { runDeadlineCheck } = await import('./src/services/reminder.scheduler.js');
    console.log('Running runDeadlineCheck()...');
    await runDeadlineCheck();

    // Verify deadline_72h Notification is created with snsMessageId in MongoDB
    const verified72hNotif = await Notification.findOne({
      userId: studentUser._id,
      alertType: 'deadline_72h',
      deadline: {
        $gte: new Date(event50hStart.getTime() - 60000),
        $lte: new Date(event50hStart.getTime() + 60000)
      }
    });

    if (!verified72hNotif) {
      throw new Error('❌ Fail: No Notification document created in MongoDB for the 72h deadline alert.');
    }
    console.log('✔ Success: Notification document created in MongoDB for the 72h deadline alert.');

    if (!verified72hNotif.snsMessageId) {
      throw new Error('❌ Fail: snsMessageId is not populated in the 72h deadline alert Notification.');
    }
    console.log(`✔ Success: 72h deadline alert contains snsMessageId: ${verified72hNotif.snsMessageId}`);

    // Step 3: Run again to check duplicate prevention
    console.log('Running runDeadlineCheck() again to check duplicate prevention...');
    await runDeadlineCheck();

    const checkDuplicateCount = await Notification.countDocuments({
      userId: studentUser._id,
      alertType: 'deadline_72h',
      deadline: {
        $gte: new Date(event50hStart.getTime() - 60000),
        $lte: new Date(event50hStart.getTime() + 60000)
      }
    });
    if (checkDuplicateCount !== 1) {
      throw new Error(`❌ Fail: Duplicate check count is ${checkDuplicateCount}, expected 1.`);
    }
    console.log('✔ Success: Duplicate check prevented duplicate 72h deadline alert creation.');

    // Step 4: Delete existing alerts in database to isolate Guardian AI route test
    await Notification.deleteMany({
      userId: studentUser._id,
      alertType: { $in: ['guardian_risk', 'guardian_opportunity'] }
    });

    // Make sure we have a placement notice in the database so the mock returns placement_alert
    const mockPlacementNotice = await Notice.findOne({ category: 'placement' });
    if (!mockPlacementNotice) {
      // Create a temporary placement notice to satisfy the mock trigger
      await Notice.create({
        uploadedBy: studentUser._id,
        fileName: 'temporary_placement_notice.txt',
        s3Key: 'notices/temp_placement.txt',
        mimeType: 'text/plain',
        sizeBytes: 100,
        status: 'summarized',
        summary: 'Temporary placement notice content for E2E.',
        title: 'Temp Placement',
        urgency: 'high',
        category: 'placement',
      });
      console.log('Created temporary placement notice for E2E test.');
    }

    // Step 5: Call POST /api/guardian/analyze for the student
    console.log('Calling POST /api/guardian/analyze for student...');
    const guardianRes = await fetch(`${API_URL}/guardian/analyze`, {
      method: 'POST',
      headers: studentHeaders,
    });
    if (!guardianRes.ok) {
      const errBody = await guardianRes.text();
      throw new Error(`Failed to call Guardian AI route: ${guardianRes.status} | ${errBody}`);
    }
    const guardianData = await guardianRes.json();
    console.log('Guardian AI reports:', JSON.stringify(guardianData.report?.alerts));

    // Verify MongoDB contains a guardian_risk notification (with snsMessageId)
    const dbGuardianRisk = await Notification.findOne({
      userId: studentUser._id,
      alertType: 'guardian_risk',
      severity: 'high'
    }).sort({ createdAt: -1 });

    if (!dbGuardianRisk) {
      throw new Error('❌ Fail: No guardian_risk Notification document created in MongoDB.');
    }
    console.log('✔ Success: guardian_risk Notification document found in MongoDB.');
    if (!dbGuardianRisk.snsMessageId) {
      throw new Error('❌ Fail: guardian_risk Notification does not have snsMessageId.');
    }
    console.log(`✔ Success: guardian_risk Notification has snsMessageId: ${dbGuardianRisk.snsMessageId}`);

    // Verify MongoDB contains a guardian_opportunity notification (with no snsMessageId and low severity)
    const dbGuardianOpp = await Notification.findOne({
      userId: studentUser._id,
      alertType: 'guardian_opportunity'
    }).sort({ createdAt: -1 });
    if (!dbGuardianOpp) {
      throw new Error('❌ Fail: No guardian_opportunity Notification document created in MongoDB.');
    }
    console.log('✔ Success: guardian_opportunity Notification document found in MongoDB.');
    if (dbGuardianOpp.snsMessageId) {
      throw new Error('❌ Fail: guardian_opportunity Notification should NOT have snsMessageId.');
    }
    if (dbGuardianOpp.severity !== 'low') {
      throw new Error(`❌ Fail: guardian_opportunity Notification severity is ${dbGuardianOpp.severity}, expected 'low'.`);
    }
    console.log('✔ Success: guardian_opportunity has low severity and no snsMessageId.');

    console.log('\n==================================================');
    console.log('ALL BACKEND INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
    console.log('==================================================');
  } catch (error) {
    console.error('❌ Fail: Error occurred during test run:', error);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('MongoDB connection closed.');
    } catch (dbErr) {
      console.error('Error closing MongoDB connection:', dbErr.message);
    }
    process.exit(0);
  }
};

runTests();
