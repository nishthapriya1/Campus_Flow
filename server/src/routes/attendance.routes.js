import express from 'express';
import Joi from 'joi';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import Attendance from '../models/Attendance.js';
import Notification from '../models/Notification.js';
import { publishNotification } from '../services/sns.service.js';

const router = express.Router();

const getConsecutiveClassesNeeded = (attended, conducted) => {
  const currentPct = conducted === 0 ? 100 : (attended / conducted) * 100;
  if (currentPct >= 75) return 0;
  return Math.max(0, Math.ceil(3 * conducted - 4 * attended));
};

const checkAttendanceAlerts = async (userId, subject) => {
  const conducted = subject.conducted;
  const attended = subject.attended;
  const pct = conducted === 0 ? 100 : (attended / conducted) * 100;

  let currentStatus = 'safe';
  if (pct >= 65 && pct < 75) {
    currentStatus = 'warning';
  } else if (pct < 65) {
    currentStatus = 'critical';
  }

  if (currentStatus === subject.lastNotifiedStatus) {
    return;
  }

  // Update lastNotifiedStatus
  subject.lastNotifiedStatus = currentStatus;
  await Attendance.updateOne(
    { _id: subject._id },
    { $set: { lastNotifiedStatus: currentStatus } }
  );

  // Title max length is 60. Cleanly handle subjectName padding.
  let titleSubject = subject.subjectName;
  if (titleSubject.length > 30) {
    titleSubject = titleSubject.substring(0, 27) + '...';
  }

  try {
    if (currentStatus === 'warning') {
      const title = `Attendance Warning: ${titleSubject} (${subject.subjectCode})`;
      const shortMessage = `Your attendance in ${subject.subjectName} is ${pct.toFixed(1)}%, falling below the 75% requirement.`;
      const detailedReason = `Your current attendance in ${subject.subjectName} is ${pct.toFixed(1)}% (${attended}/${conducted} classes). Students must maintain a minimum of 75% attendance.`;
      
      const needed = getConsecutiveClassesNeeded(attended, conducted);
      const recommendedAction = `Ensure you attend upcoming classes. You need to attend ${needed} more consecutive classes to reach 75%.`;

      const notification = await Notification.create({
        userId,
        alertType: 'attendance_warning',
        severity: 'high',
        title: title.substring(0, 60),
        shortMessage,
        detailedReason,
        recommendedAction,
        deadline: null
      });

      // Publish notification
      await publishNotification({
        userId: userId.toString(),
        alertType: 'attendance_warning',
        severity: 'high',
        title: notification.title,
        shortMessage: notification.shortMessage,
        detailedReason: notification.detailedReason,
        recommendedAction: notification.recommendedAction,
        notificationId: notification._id.toString()
      });
    } else if (currentStatus === 'critical') {
      const title = `Attendance Critical: ${titleSubject} (${subject.subjectCode})`;
      const shortMessage = `Your attendance in ${subject.subjectName} is critically low at ${pct.toFixed(1)}%.`;
      const detailedReason = `Your current attendance in ${subject.subjectName} has dropped to ${pct.toFixed(1)}% (${attended}/${conducted} classes). This is below the critical threshold of 65%.`;
      
      const needed = getConsecutiveClassesNeeded(attended, conducted);
      const recommendedAction = `Attend consecutive classes immediately to restore status. You must attend ${needed} consecutive classes.`;

      const notification = await Notification.create({
        userId,
        alertType: 'attendance_critical',
        severity: 'critical',
        title: title.substring(0, 60),
        shortMessage,
        detailedReason,
        recommendedAction,
        deadline: null
      });

      // Publish notification
      await publishNotification({
        userId: userId.toString(),
        alertType: 'attendance_critical',
        severity: 'critical',
        title: notification.title,
        shortMessage: notification.shortMessage,
        detailedReason: notification.detailedReason,
        recommendedAction: notification.recommendedAction,
        notificationId: notification._id.toString()
      });
    }
  } catch (error) {
    console.error('Failed to trigger attendance notification logic:', error.message);
  }
};

// Helper function to pre-populate logs list based on conducted/attended counters
const prePopulateLogs = (conducted, attended) => {
  const logs = [];
  const today = new Date();
  for (let i = 0; i < conducted; i++) {
    const logDate = new Date(today);
    // Stagger dates in the past
    logDate.setDate(today.getDate() - i);
    logs.push({
      date: logDate,
      status: i < attended ? 'present' : 'absent'
    });
  }
  return logs;
};

// Apply JWT and Student Role checks to all attendance routes
router.use(verifyJWT);
router.use(requireRole('student'));

// Validation Schemas
const subjectSchema = Joi.object({
  subjectName: Joi.string().trim().required().messages({
    'any.required': 'Subject name is required',
    'string.empty': 'Subject name cannot be empty'
  }),
  subjectCode: Joi.string().trim().uppercase().required().messages({
    'any.required': 'Subject code is required',
    'string.empty': 'Subject code cannot be empty'
  }),
  type: Joi.string().valid('Theory', 'Lab').required().messages({
    'any.required': 'Subject type is required',
    'any.only': 'Subject type must be either Theory or Lab'
  }),
  conducted: Joi.number().integer().min(0).default(0),
  attended: Joi.number().integer().min(0).max(Joi.ref('conducted')).default(0).messages({
    'number.max': 'Classes attended cannot be greater than classes conducted'
  })
});

// GET /api/attendance
router.get('/', async (req, res, next) => {
  try {
    const records = await Attendance.find({ userId: req.user.userId }).sort({ subjectName: 1 });
    return res.status(200).json(records);
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/:id
router.get('/:id', async (req, res, next) => {
  try {
    const subject = await Attendance.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    if (subject.userId.toString() !== req.user.userId) return res.status(403).json({ error: 'Access denied' });
    return res.status(200).json(subject);
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = subjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { subjectName, subjectCode, type, conducted, attended } = value;

    // Check for duplicate subject code for the user
    const duplicate = await Attendance.findOne({ userId: req.user.userId, subjectCode });
    if (duplicate) {
      return res.status(409).json({ error: `A subject with code ${subjectCode} already exists.` });
    }

    const initialLogs = prePopulateLogs(conducted, attended);

    const newSubject = new Attendance({
      userId: req.user.userId,
      subjectName,
      subjectCode,
      type,
      logs: initialLogs
    });

    // Mongoose pre-save hook will automatically populate conducted and attended counts based on initialLogs
    await newSubject.save();

    // Check and trigger notifications if needed
    await checkAttendanceAlerts(req.user.userId, newSubject);

    return res.status(201).json(newSubject);
  } catch (error) {
    next(error);
  }
});

// PUT /api/attendance/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = subjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { subjectName, subjectCode, type, conducted, attended } = value;

    const subject = await Attendance.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (subject.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check duplicate code if subjectCode is being changed
    if (subjectCode !== subject.subjectCode) {
      const duplicate = await Attendance.findOne({ userId: req.user.userId, subjectCode });
      if (duplicate) {
        return res.status(409).json({ error: `A subject with code ${subjectCode} already exists.` });
      }
    }

    subject.subjectName = subjectName;
    subject.subjectCode = subjectCode;
    subject.type = type;

    // If conducted or attended counts explicitly modified in forms, regenerate logs array
    const currentConducted = subject.logs.length;
    const currentAttended = subject.logs.filter(l => l.status === 'present').length;
    if (Number(conducted) !== currentConducted || Number(attended) !== currentAttended) {
      subject.logs = prePopulateLogs(conducted, attended);
    }

    await subject.save();

    // Trigger alerts
    await checkAttendanceAlerts(req.user.userId, subject);

    return res.status(200).json(subject);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/attendance/:id/log (Present / Absent quick logs)
router.patch('/:id/log', async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!action || !['present', 'absent'].includes(action)) {
      return res.status(400).json({ error: "Action is required and must be either 'present' or 'absent'" });
    }

    const subject = await Attendance.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (subject.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Push new log entry for today
    subject.logs.push({
      date: new Date(),
      status: action === 'present' ? 'present' : 'absent'
    });

    await subject.save();

    // Trigger alerts
    await checkAttendanceAlerts(req.user.userId, subject);

    return res.status(200).json(subject);
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/:id/logs (Manually log past classes)
router.post('/:id/logs', async (req, res, next) => {
  try {
    const { date, status } = req.body;
    if (!date || !status || !['present', 'absent'].includes(status)) {
      return res.status(400).json({ error: "Date and status ('present' or 'absent') are required" });
    }

    const subject = await Attendance.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (subject.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    subject.logs.push({
      date: new Date(date),
      status
    });

    // Sort logs by date descending to keep them ordered
    subject.logs.sort((a, b) => new Date(b.date) - new Date(a.date));

    await subject.save();

    // Trigger alerts
    await checkAttendanceAlerts(req.user.userId, subject);

    return res.status(201).json(subject);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/attendance/:id/logs/:logId (Toggle specific log status)
router.patch('/:id/logs/:logId', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !['present', 'absent'].includes(status)) {
      return res.status(400).json({ error: "Status ('present' or 'absent') is required" });
    }

    const subject = await Attendance.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (subject.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logEntry = subject.logs.id(req.params.logId);
    if (!logEntry) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    logEntry.status = status;
    await subject.save();

    // Trigger alerts
    await checkAttendanceAlerts(req.user.userId, subject);

    return res.status(200).json(subject);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/attendance/:id/logs/:logId (Delete specific log entry)
router.delete('/:id/logs/:logId', async (req, res, next) => {
  try {
    const subject = await Attendance.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (subject.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logEntry = subject.logs.id(req.params.logId);
    if (!logEntry) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    subject.logs.pull(req.params.logId);
    await subject.save();

    // Trigger alerts
    await checkAttendanceAlerts(req.user.userId, subject);

    return res.status(200).json(subject);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/attendance/:id (Delete full course)
router.delete('/:id', async (req, res, next) => {
  try {
    const subject = await Attendance.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (subject.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Clean up notifications for this subject
    await Notification.deleteMany({
      userId: req.user.userId,
      alertType: { $in: ['attendance_warning', 'attendance_critical'] },
      title: { $regex: subject.subjectCode, $options: 'i' }
    });

    await Attendance.deleteOne({ _id: req.params.id });

    return res.status(200).json({ message: 'Subject deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
