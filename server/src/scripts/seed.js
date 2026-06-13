import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Notice from '../models/Notice.js';
import Event from '../models/Event.js';
import StudyPlan from '../models/StudyPlan.js';
import Notification from '../models/Notification.js';
import path from 'path';
import { fileURLToPath } from 'url';

export const seedDatabase = async () => {
  try {
    console.log('Seeding process started...');

    const adminEmail = 'admin@campusflow.com';
    const studentEmail = 'student@campusflow.com';

    // 1. Create/Upsert Admin
    const saltRounds = 12;
    const adminPasswordHash = await bcrypt.hash('admin123', saltRounds);
    const admin = await User.findOneAndUpdate(
      { email: adminEmail },
      {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: 'administrator',
        name: 'Dr. Mehta (Admin)',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('Pre-seeded Admin account upserted.');

    // 2. Create/Upsert Student
    const studentPasswordHash = await bcrypt.hash('student123', saltRounds);
    const student = await User.findOneAndUpdate(
      { email: studentEmail },
      {
        email: studentEmail,
        passwordHash: studentPasswordHash,
        role: 'student',
        name: 'Arjun (Student)',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('Pre-seeded Student account upserted.');

    // 3. Clear existing notices, events, and study plans for student and admin to ensure idempotency
    await Notice.deleteMany({ uploadedBy: admin._id });
    await Event.deleteMany({ userId: student._id });
    await StudyPlan.deleteMany({ userId: student._id });
    await Notification.deleteMany({ userId: student._id });
    console.log('Cleared existing notices, events, study plans, and notifications for seeding.');

    // 4. Seed 3 notices
    const notice1 = new Notice({
      uploadedBy: admin._id,
      fileName: 'Semester_Registration_Notice.txt',
      s3Key: 'notices/seed_semester_reg.txt',
      mimeType: 'text/plain',
      sizeBytes: 312,
      status: 'summarized',
      summary: 'All students must complete their semester registration before the deadline on June 20th. Make sure to clear all outstanding library dues.',
      summaryLang: 'en',
      title: 'Semester Registration',
      urgency: 'high',
      category: 'academic',
      uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    });
    await notice1.save();

    const notice2 = new Notice({
      uploadedBy: admin._id,
      fileName: 'Capstone_Project_Guidelines.pdf',
      s3Key: 'notices/seed_capstone_guide.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 154320,
      status: 'summarized',
      summary: 'Final year CS and B.Tech students must submit their capstone source code and final reports on or before June 28th. Submissions close at 17:00.',
      summaryLang: 'en',
      title: 'Capstone Project Guidelines',
      urgency: 'critical',
      category: 'academic',
      uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    });
    await notice2.save();

    const notice3 = new Notice({
      uploadedBy: admin._id,
      fileName: 'Sports_Fest_Registration.txt',
      s3Key: 'notices/seed_sports_fest.txt',
      mimeType: 'text/plain',
      sizeBytes: 180,
      status: 'summarized',
      summary: 'Registrations are open for the annual track-and-field and basketball sports tournament taking place from June 24th to June 26th.',
      summaryLang: 'en',
      title: 'Sports Fest Registration',
      urgency: 'low',
      category: 'event',
      uploadedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    });
    await notice3.save();

    const notice4 = new Notice({
      uploadedBy: admin._id,
      fileName: 'Google_Summer_Placement_Drive.pdf',
      s3Key: 'notices/seed_google_placement.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 245000,
      status: 'summarized',
      summary: 'Google is hosting a placement recruitment drive for software engineering interns. Apply online by June 25th.',
      summaryLang: 'en',
      title: 'Google Summer Placement Drive',
      urgency: 'critical',
      category: 'placement',
      uploadedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    });
    await notice4.save();
    console.log('Seeded 4 demo notices.');

    // 5. Seed 5 events for the student
    const today = new Date();
    
    // Event 1: Exam (5 days away)
    const exam1Start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 10, 0);
    const exam1End = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5, 12, 0);
    const event1 = new Event({
      userId: student._id,
      title: 'Chemistry Lab Final Exam',
      type: 'exam',
      startTime: exam1Start,
      endTime: exam1End,
      isBlocked: true,
    });
    await event1.save();

    // Event 2: Exam (6 days away)
    const exam2Start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 9, 0);
    const exam2End = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6, 12, 0);
    const event2 = new Event({
      userId: student._id,
      title: 'Mathematics Term Examination',
      type: 'exam',
      startTime: exam2Start,
      endTime: exam2End,
      isBlocked: true,
    });
    await event2.save();

    // Event 3: Assignment (Tomorrow)
    const assignStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 14, 0);
    const assignEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 15, 0);
    const event3 = new Event({
      userId: student._id,
      title: 'Physics Lab Workbook Submission',
      type: 'assignment',
      startTime: assignStart,
      endTime: assignEnd,
      isBlocked: false,
    });
    await event3.save();

    // Event 4: Class (Today)
    const classStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0);
    const classEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30);
    const event4 = new Event({
      userId: student._id,
      title: 'Data Structures Lecture',
      type: 'class',
      startTime: classStart,
      endTime: classEnd,
      isBlocked: false,
    });
    await event4.save();

    // Event 5: Extracurricular (Today)
    const extraStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0);
    const extraEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0);
    const event5 = new Event({
      userId: student._id,
      title: 'Music Club Jam Session',
      type: 'extracurricular',
      startTime: extraStart,
      endTime: extraEnd,
      isBlocked: false,
    });
    await event5.save();

    // Event 6: Exam (50 hours away, inside 72h window) - Task 90
    const exam72hStart = new Date(today.getTime() + 50 * 60 * 60 * 1000);
    const exam72hEnd = new Date(today.getTime() + 52 * 60 * 60 * 1000);
    const event6 = new Event({
      userId: student._id,
      title: 'Intro to Programming Exam',
      type: 'exam',
      startTime: exam72hStart,
      endTime: exam72hEnd,
      isBlocked: true,
    });
    await event6.save();
    console.log('Seeded 6 demo events.');

    // 6. Seed active study plan
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const studyPlan = new StudyPlan({
      userId: student._id,
      status: 'active',
      preferences: {
        subjects: ['Mathematics', 'Chemistry'],
        examDates: [exam2Start, exam1Start],
        dailyHours: 4,
      },
      sessions: [
        {
          subject: 'Chemistry',
          date: tomorrow,
          startTime: '18:00',
          endTime: '20:00',
          durationMins: 120,
        },
        {
          subject: 'Mathematics',
          date: tomorrow,
          startTime: '08:00',
          endTime: '10:00',
          durationMins: 120,
        },
      ],
      generatedAt: new Date(),
    });
    await studyPlan.save();
    console.log('Seeded 1 active study plan.');

    // 7. Seed sample Notification documents (Task 55)
    const notification1 = new Notification({
      userId: student._id,
      alertType: 'deadline_72h',
      severity: 'critical',
      title: 'Math Exam Deadline Approaching',
      shortMessage: 'Your Mathematics Term Exam starts in 72 hours.',
      detailedReason: 'An upcoming exam was detected with no study sessions scheduled in the preceding 48 hours.',
      recommendedAction: 'Allocate at least two study blocks for Mathematics in your Study Plan.',
      deadline: exam2Start,
      read: false,
    });
    await notification1.save();

    const notification2 = new Notification({
      userId: student._id,
      alertType: 'reminder_24h',
      severity: 'high',
      title: 'Chemistry Lab Exam 24h Reminder',
      shortMessage: 'Chemistry Lab Final Exam is tomorrow at 10:00.',
      detailedReason: 'Automatic 24-hour reminder generated for your Chemistry Lab Final Exam.',
      recommendedAction: 'Verify you have all lab journals and materials ready.',
      deadline: exam1Start,
      read: false,
    });
    await notification2.save();

    const notification3 = new Notification({
      userId: student._id,
      alertType: 'reminder_1h',
      severity: 'medium',
      title: 'Physics Assignment Submission',
      shortMessage: 'Physics Lab Workbook Submission is in 1 hour.',
      detailedReason: 'Automatic 1-hour reminder generated for Physics Lab Workbook Submission.',
      recommendedAction: 'Submit your workbook at the registrar desk.',
      deadline: assignStart,
      read: true,
      readAt: new Date(Date.now() - 30 * 60 * 1000), // read 30 mins ago
    });
    await notification3.save();

    const notification4 = new Notification({
      userId: student._id,
      alertType: 'guardian_risk',
      severity: 'high',
      title: 'Attendance Risk: Physics Class',
      shortMessage: 'Your Physics attendance has dropped below 75%.',
      detailedReason: 'Attendance projection shows 72% attendance due to recent absences.',
      recommendedAction: 'Attend all remaining classes this week.',
      deadline: null,
      read: false,
    });
    await notification4.save();

    const notification5 = new Notification({
      userId: student._id,
      alertType: 'guardian_opportunity',
      severity: 'low',
      title: 'Placement Opportunity: Google Recruitment',
      shortMessage: 'Google Placement recruitment drive registration is open.',
      detailedReason: 'New placement recruitment drive has been announced for software engineering interns.',
      recommendedAction: 'Register on the placement portal.',
      deadline: null,
      read: false,
    });
    await notification5.save();

    console.log('Seeded 5 Notification documents.');

    console.log('Database seeding successfully finished.');
  } catch (error) {
    console.error('Seeding failure:', error.message);
  }
};

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  (async () => {
    await connectDB();
    await seedDatabase();
    await disconnectDB();
    process.exit(0);
  })();
}
