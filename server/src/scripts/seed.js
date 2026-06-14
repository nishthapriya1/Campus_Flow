import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import StudyPlan from '../models/StudyPlan.js';
import Attendance from '../models/Attendance.js';
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

    // 3. Clear existing events, study plans, and attendance for student to ensure idempotency
    await Event.deleteMany({ userId: student._id });
    await StudyPlan.deleteMany({ userId: student._id });
    await Attendance.deleteMany({ userId: student._id });
    console.log('Cleared existing events, study plans, and attendance for seeding.');

    // 4. Seed 5 events for the student
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

    // 5. Seed active study plan
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

    // 6. Seed Attendance subjects with daily logs history
    const makeLogs = (conducted, attended) => {
      const logs = [];
      const today = new Date();
      for (let i = 0; i < conducted; i++) {
        const logDate = new Date(today);
        logDate.setDate(today.getDate() - i);
        logs.push({
          date: logDate,
          status: i < attended ? 'present' : 'absent'
        });
      }
      return logs;
    };

    const subjects = [
      {
        userId: student._id,
        subjectName: 'Mathematics',
        subjectCode: 'MATH101',
        type: 'Theory',
        logs: makeLogs(40, 32),
      },
      {
        userId: student._id,
        subjectName: 'Physics Lab',
        subjectCode: 'PHYS102',
        type: 'Lab',
        logs: makeLogs(20, 14),
      },
      {
        userId: student._id,
        subjectName: 'Chemistry',
        subjectCode: 'CHEM103',
        type: 'Theory',
        logs: makeLogs(30, 18),
      },
      {
        userId: student._id,
        subjectName: 'Computer Science',
        subjectCode: 'CS104',
        type: 'Theory',
        logs: makeLogs(25, 24),
      },
    ];

    for (const sub of subjects) {
      const newSub = new Attendance(sub);
      await newSub.save();
    }
    console.log('Seeded 4 Attendance records with logs history.');

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
