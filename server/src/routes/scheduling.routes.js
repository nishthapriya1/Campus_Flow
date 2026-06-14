import express from 'express';
import Joi from 'joi';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import SchedulingPreferences from '../models/SchedulingPreferences.js';
import Event from '../models/Event.js';
import Attendance from '../models/Attendance.js';
import StudyPlan from '../models/StudyPlan.js';
import Notice from '../models/Notice.js';
import { runSchedulingAnalysis, optimizeSchedule } from '../services/bedrock.service.js';
import CachedAnalysis from '../models/CachedAnalysis.js';
import { computeHash } from '../utils/hash.js';

const router = express.Router();

// Apply JWT authentication and role checks to all routes
router.use(verifyJWT);
router.use(requireRole('student'));

// Validation schema for preferences
const preferencesSchema = Joi.object({
  sleepStart: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('23:00').messages({
    'string.pattern.base': 'Sleep start must be in HH:mm format'
  }),
  sleepEnd: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('07:00').messages({
    'string.pattern.base': 'Sleep end must be in HH:mm format'
  }),
  preferredStudyHours: Joi.string().valid('morning', 'afternoon', 'evening', 'night').default('evening'),
  breakfastTime: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('08:00'),
  lunchTime: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('13:00'),
  dinnerTime: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default('20:00'),
  travelTimeMins: Joi.number().integer().min(0).max(480).default(30),
  productivityPreference: Joi.string().allow('').default('Balanced workload'),
  personalCommitments: Joi.array().items(Joi.string()).default([])
});

// GET /api/scheduling/preferences
router.get('/preferences', async (req, res, next) => {
  try {
    let pref = await SchedulingPreferences.findOne({ userId: req.user.userId });
    if (!pref) {
      // Create defaults
      pref = new SchedulingPreferences({ userId: req.user.userId });
      await pref.save();
    }
    return res.status(200).json(pref);
  } catch (error) {
    next(error);
  }
});

// POST /api/scheduling/preferences
router.post('/preferences', async (req, res, next) => {
  try {
    const { error, value } = preferencesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const pref = await SchedulingPreferences.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: value },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json(pref);
  } catch (error) {
    next(error);
  }
});

// GET /api/scheduling/analyze
router.get('/analyze', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + 7);

    // Parallelize Mongoose queries
    const [preferences, events, studyPlan, attendance, notices] = await Promise.all([
      SchedulingPreferences.findOne({ userId }).then(async p => {
        if (!p) {
          const newP = new SchedulingPreferences({ userId });
          await newP.save();
          return newP;
        }
        return p;
      }),
      Event.find({ userId, startTime: { $gte: now, $lte: future } }).sort({ startTime: 1 }),
      StudyPlan.findOne({ userId, status: 'active' }).sort({ createdAt: -1 }),
      Attendance.find({ userId }).sort({ subjectName: 1 }),
      Notice.find().sort({ uploadedAt: -1 }).limit(10)
    ]);

    // Check cache
    const hashInput = {
      userId,
      preferences,
      events,
      studyPlan,
      attendance,
      notices,
      date: now.toISOString().split('T')[0]
    };
    const inputHash = computeHash(hashInput);

    const cached = await CachedAnalysis.findOne({ userId, analysisType: 'scheduling_analysis' });
    if (cached && cached.inputHash === inputHash) {
      console.log(`[CACHE HIT] Returning cached scheduling analysis for user ${userId}`);
      return res.status(200).json(cached.payload);
    }
    console.log(`[CACHE MISS] Running Bedrock scheduling analysis for user ${userId}...`);

    // Run analysis
    const analysis = await runSchedulingAnalysis({
      events,
      attendance,
      studyPlan,
      notices,
      preferences,
      currentDateTime: now
    });

    const payload = {
      analysis,
      preferences
    };

    // Save to Cache
    await CachedAnalysis.findOneAndUpdate(
      { userId, analysisType: 'scheduling_analysis' },
      { inputHash, payload },
      { upsert: true, new: true }
    );

    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});

// POST /api/scheduling/optimize
router.post('/optimize', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Fetch preferences or use defaults
    let preferences = await SchedulingPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new SchedulingPreferences({ userId });
      await preferences.save();
    }

    // Fetch events (upcoming 7 days)
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + 7);
    const events = await Event.find({
      userId,
      startTime: { $gte: now, $lte: future }
    });

    // Fetch active study plan
    const studyPlan = await StudyPlan.findOne({ userId, status: 'active' }).sort({ createdAt: -1 });

    // Fetch attendance records
    const attendance = await Attendance.find({ userId });

    // Run optimize schedule (this mutates database events)
    const optimizationResult = await optimizeSchedule({
      userId,
      events,
      attendance,
      studyPlan,
      preferences
    });

    // Fetch refreshed events after updates/creations
    const updatedEvents = await Event.find({
      userId,
      startTime: { $gte: now, $lte: future }
    }).sort({ startTime: 1 });

    // Fetch recent notices
    const notices = await Notice.find().sort({ uploadedAt: -1 }).limit(10);

    // Re-run analysis with updated state
    const analysis = await runSchedulingAnalysis({
      events: updatedEvents,
      attendance,
      studyPlan,
      notices,
      preferences,
      currentDateTime: now
    });

    // Inject optimization changes into analysis changes made
    if (optimizationResult.changes && optimizationResult.changes.length > 0) {
      analysis.scheduleChangesMade = [
        ...optimizationResult.changes,
        ...(analysis.scheduleChangesMade || []).filter(c => !c.includes("No schedule updates needed"))
      ];
    }

    // Save newly optimized analysis to Cache for scheduling_analysis
    const hashInput = {
      userId,
      preferences,
      events: updatedEvents,
      studyPlan,
      attendance,
      notices,
      date: now.toISOString().split('T')[0]
    };
    const inputHash = computeHash(hashInput);
    const cachedPayload = {
      analysis,
      preferences
    };
    await CachedAnalysis.findOneAndUpdate(
      { userId, analysisType: 'scheduling_analysis' },
      { inputHash, payload: cachedPayload },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      analysis,
      preferences,
      changesMade: optimizationResult.changes
    });
  } catch (error) {
    next(error);
  }
});

export default router;
