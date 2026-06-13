import express from 'express';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import Reminder from '../models/Reminder.js';

const router = express.Router();

// Apply verifyJWT and requireRole to all routes
router.use(verifyJWT);
router.use(requireRole('student'));

// GET /api/reminders/pending
// Returns active reminders whose scheduledAt time has elapsed, including populated Event details.
router.get('/pending', async (req, res, next) => {
  try {
    const now = new Date();
    const reminders = await Reminder.find({
      userId: req.user.userId,
      dismissed: false,
      scheduledAt: { $lte: now },
    })
      .populate({
        path: 'eventId',
        select: 'title type startTime',
      })
      .sort({ scheduledAt: 1 });

    // Filter out reminders where the associated event was deleted (precautionary)
    const validReminders = reminders.filter((r) => r.eventId !== null);

    return res.status(200).json(validReminders);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/reminders/:id/dismiss
// Dismisses a reminder, preventing it from appearing in subsequent dashboard requests.
router.patch('/:id/dismiss', async (req, res, next) => {
  try {
    const { id } = req.params;
    const reminder = await Reminder.findById(id);

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Ownership check
    if (reminder.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    reminder.dismissed = true;
    reminder.dismissedAt = new Date();
    await reminder.save();

    return res.status(200).json(reminder);
  } catch (error) {
    next(error);
  }
});

export default router;
