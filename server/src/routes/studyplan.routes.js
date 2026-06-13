import express from 'express';
import Joi from 'joi';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import StudyPlan from '../models/StudyPlan.js';
import Event from '../models/Event.js';
import { generateStudyPlan } from '../services/bedrock.service.js';

const router = express.Router();

const studyPlanGenerateSchema = Joi.object({
  subjects: Joi.array()
    .items(Joi.string().trim().required())
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'Please specify at least 1 subject',
      'array.max': 'You can specify at most 10 subjects',
      'any.required': 'Subjects array is required',
    }),
  examDates: Joi.array()
    .items(
      Joi.date()
        .greater('now')
        .required()
        .messages({ 'date.greater': 'Exam dates must be in the future' })
    )
    .min(1)
    .max(10)
    .required()
    .messages({
      'array.min': 'Please specify at least 1 exam date',
      'array.max': 'You can specify at most 10 exam dates',
      'any.required': 'Exam dates array is required',
    }),
  dailyHours: Joi.number().min(0.5).max(16).required().messages({
    'number.min': 'Daily study hours must be at least 0.5 hours',
    'number.max': 'Daily study hours cannot exceed 16 hours',
    'any.required': 'Daily study hours is required',
  }),
}).custom((value, helpers) => {
  if (value.subjects.length !== value.examDates.length) {
    return helpers.message({ custom: 'Subjects and Exam Dates arrays must have the same length' });
  }
  return value;
});

// Apply verifyJWT and requireRole to all routes
router.use(verifyJWT);
router.use(requireRole('student'));

// POST /api/studyplans/generate
// Generates a new study plan via Bedrock, handles archiving existing plan, and respects 5-plan history limits.
router.post('/generate', async (req, res, next) => {
  try {
    const { error, value } = studyPlanGenerateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: error.details[0].message,
        fields: error.details.map((d) => d.path[0]),
      });
    }

    const { subjects, examDates, dailyHours } = value;

    // 1. Fetch user's blocked events (Task 45)
    const blockedEvents = await Event.find({
      userId: req.user.userId,
      isBlocked: true,
    });

    // Format blocked slots as required by study plan service: { date, startTime, endTime }
    const blockedSlots = blockedEvents.map((evt) => {
      const pad = (n) => (n < 10 ? '0' + n : n);
      const start = new Date(evt.startTime);
      const end = new Date(evt.endTime);
      
      const startTimeStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      const endTimeStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
      const dateStr = start.toISOString().split('T')[0];

      return {
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
      };
    });

    // 2. Call Bedrock with 15-second Promise.race timeout (Requirement 3.2, 3.8)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        const err = new Error('Study plan generation timed out (limit: 15s)');
        err.status = 504; // Gateway Timeout
        reject(err);
      }, 15000)
    );

    let sessions;
    try {
      sessions = await Promise.race([
        generateStudyPlan({ subjects, examDates, dailyHours, blockedSlots }),
        timeoutPromise,
      ]);
    } catch (apiError) {
      const statusCode = apiError.status || 503;
      return res.status(statusCode).json({
        error: apiError.message || 'AI service is temporarily unavailable. Please try again.',
      });
    }

    // 3. Process replacement and history cap rules (Property 4)
    // Find active plan to archive
    const activePlan = await StudyPlan.findOne({
      userId: req.user.userId,
      status: 'active',
    });

    if (activePlan) {
      // Get count of existing archived plans
      const archivedCount = await StudyPlan.countDocuments({
        userId: req.user.userId,
        status: 'archived',
      });

      // Maintain a maximum of 5 replaced/archived plans
      if (archivedCount >= 5) {
        const oldestArchived = await StudyPlan.findOne({
          userId: req.user.userId,
          status: 'archived',
        }).sort({ archivedAt: 1 }); // oldest first
        
        if (oldestArchived) {
          await StudyPlan.findByIdAndDelete(oldestArchived._id);
          console.log(`Deleted oldest archived study plan ${oldestArchived._id} to enforce the 5-plan cap.`);
        }
      }

      // Archive active plan
      activePlan.status = 'archived';
      activePlan.archivedAt = new Date();
      await activePlan.save();
    }

    // 4. Create and save new active study plan
    const newPlan = new StudyPlan({
      userId: req.user.userId,
      status: 'active',
      preferences: {
        subjects,
        examDates,
        dailyHours,
      },
      sessions,
    });

    await newPlan.save();

    return res.status(201).json({ studyPlan: newPlan });
  } catch (error) {
    next(error);
  }
});

// GET /api/studyplans/active
router.get('/active', async (req, res, next) => {
  try {
    const activePlan = await StudyPlan.findOne({
      userId: req.user.userId,
      status: 'active',
    });

    if (!activePlan) {
      return res.status(404).json({ error: 'No active study plan found' });
    }

    return res.status(200).json(activePlan);
  } catch (error) {
    next(error);
  }
});

// GET /api/studyplans/history
// Returns last 5 archived plans within 7 days, sorted by archivedAt descending.
router.get('/history', async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const archivedPlans = await StudyPlan.find({
      userId: req.user.userId,
      status: 'archived',
      archivedAt: { $gte: sevenDaysAgo },
    })
      .sort({ archivedAt: -1 })
      .limit(5);

    return res.status(200).json(archivedPlans);
  } catch (error) {
    next(error);
  }
});

export default router;
