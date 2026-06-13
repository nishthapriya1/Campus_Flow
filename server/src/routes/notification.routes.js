import express from 'express';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Apply JWT and Student Role checks to all notification routes
router.use(verifyJWT);
router.use(requireRole('student'));

// GET /api/notifications
// Retrieves notifications for the student, sorted by newest first, paginated.
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = { userId: req.user.userId };

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ ...query, read: false });

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      notifications,
      total,
      unreadCount,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/unread-count
// Returns the count of unread notifications.
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.userId,
      read: false,
    });
    return res.status(200).json({ count });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/read-all
// Marks all unread notifications for the user as read.
router.patch('/read-all', async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return res.status(200).json({ updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/notifications/:id/read
// Marks a single notification as read.
router.patch('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check ownership
    if (notification.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    return res.status(200).json(notification);
  } catch (error) {
    next(error);
  }
});

export default router;
