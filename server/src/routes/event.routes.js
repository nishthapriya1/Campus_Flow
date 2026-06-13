import express from 'express';
import Joi from 'joi';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import Event from '../models/Event.js';
import Reminder from '../models/Reminder.js';
import { scheduleRemindersForEvent } from '../services/reminder.scheduler.js';

const router = express.Router();

const eventSchema = Joi.object({
  title: Joi.string().max(100).required().messages({
    'string.max': 'Title cannot exceed 100 characters',
    'any.required': 'Title is required',
  }),
  type: Joi.string()
    .valid('exam', 'assignment', 'class', 'extracurricular')
    .required()
    .messages({
      'any.only': 'Event type must be exam, assignment, class, or extracurricular',
      'any.required': 'Event type is required',
    }),
  startTime: Joi.date().required().messages({
    'any.required': 'Start time is required',
  }),
  endTime: Joi.date().greater(Joi.ref('startTime')).required().messages({
    'date.greater': 'End time must be after the start time',
    'any.required': 'End time is required',
  }),
  isBlocked: Joi.boolean().default(false),
  sourceNoticeId: Joi.string().allow(null, '').optional(),
});

// Apply verifyJWT and requireRole to all routes
router.use(verifyJWT);
router.use(requireRole('student'));

// POST /api/events
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = eventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: error.details[0].message,
        fields: error.details.map((d) => d.path[0]),
      });
    }

    const event = new Event({
      userId: req.user.userId,
      title: value.title,
      type: value.type,
      startTime: value.startTime,
      endTime: value.endTime,
      isBlocked: value.isBlocked,
      sourceNoticeId: value.sourceNoticeId || null,
    });

    await event.save();

    // Wire to reminder scheduler immediately (Task 43)
    await scheduleRemindersForEvent(event);

    return res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

// GET /api/events
router.get('/', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { userId: req.user.userId };

    if (from || to) {
      filter.startTime = {};
      if (from) filter.startTime.$gte = new Date(from);
      if (to) filter.startTime.$lte = new Date(to);
    }

    const events = await Event.find(filter).sort({ startTime: 1 });
    return res.status(200).json(events);
  } catch (error) {
    next(error);
  }
});

// PUT /api/events/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = eventSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: error.details[0].message,
        fields: error.details.map((d) => d.path[0]),
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Ownership check
    if (event.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isTimeChanged =
      new Date(event.startTime).getTime() !== new Date(value.startTime).getTime();

    event.title = value.title;
    event.type = value.type;
    event.startTime = value.startTime;
    event.endTime = value.endTime;
    event.isBlocked = value.isBlocked;
    event.sourceNoticeId = value.sourceNoticeId || null;

    await event.save();

    // If deadline shifts, delete existing reminders and re-arm (Property 2: Dismissal Re-arm on Edit)
    if (isTimeChanged) {
      console.log(`Event time changed. Re-arming reminders for event: ${event.title}`);
      await Reminder.deleteMany({ eventId: event._id });
      await scheduleRemindersForEvent(event);
    }

    return res.status(200).json(event);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Ownership check
    if (event.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Cancel all pending reminders associated with this event (Requirement 6.7)
    await Reminder.deleteMany({ eventId: event._id });
    
    // Delete event
    await Event.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
