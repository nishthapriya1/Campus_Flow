import express from 'express';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import RoutineFeedback from '../models/RoutineFeedback.js';
import Event from '../models/Event.js';
import Attendance from '../models/Attendance.js';
import StudyPlan from '../models/StudyPlan.js';
import FocusSession from '../models/FocusSession.js';
import Notification from '../models/Notification.js';
import SchedulingPreferences from '../models/SchedulingPreferences.js';
import { runRoutineIntelligenceAnalysis } from '../services/bedrock.service.js';

const router = express.Router();

// Apply JWT authentication and student role check to all routine intelligence routes
router.use(verifyJWT);
router.use(requireRole('student'));

// GET /api/routine/analyze
// Collects student telemetry data and triggers Routine Intelligence analysis
router.get('/analyze', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // 1. Fetch user preferences or defaults
    let preferences = await SchedulingPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new SchedulingPreferences({ userId });
      await preferences.save();
    }

    // 2. Fetch events (e.g. past 14 days to future 14 days to identify trends/risks/habits)
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 14);
    const future = new Date();
    future.setDate(now.getDate() + 14);

    const events = await Event.find({
      userId,
      startTime: { $gte: past, $lte: future }
    }).sort({ startTime: 1 });

    // 3. Fetch active/recent study plans
    const studyPlan = await StudyPlan.findOne({ userId, status: 'active' }).sort({ createdAt: -1 });

    // 4. Fetch attendance records
    const attendance = await Attendance.find({ userId }).sort({ subjectName: 1 });

    // 5. Fetch focus sessions
    const focusSessions = await FocusSession.find({ userId }).sort({ createdAt: -1 });

    // 6. Fetch notification history
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);

    // 7. Fetch user routine feedback logs
    const feedback = await RoutineFeedback.find({ userId });

    // Run AI analysis
    const analysis = await runRoutineIntelligenceAnalysis({
      userId,
      events,
      attendance,
      studyPlan,
      focusSessions,
      notifications,
      feedback,
      preferences
    });

    return res.status(200).json({
      analysis,
      feedback
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/routine/feedback
// Submits helpful/unhelpful rating on dynamic recommendations
router.post('/feedback', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { insightId, isHelpful, comments } = req.body;

    if (!insightId || typeof isHelpful !== 'boolean') {
      return res.status(400).json({ error: 'insightId and isHelpful (boolean) are required' });
    }

    const feedback = await RoutineFeedback.findOneAndUpdate(
      { userId, insightId },
      { $set: { isHelpful, comments: comments || '' } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json(feedback);
  } catch (error) {
    next(error);
  }
});

export default router;
