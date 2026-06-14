import express from 'express';
import Joi from 'joi';
import { verifyJWT } from '../middleware/auth.js';
import FocusSession from '../models/FocusSession.js';
import FocusInventory from '../models/FocusInventory.js';
import FocusStreak from '../models/FocusStreak.js';
import Notification from '../models/Notification.js';

const router = express.Router();

const getTodayStr = () => {
  return new Date().toISOString().split('T')[0];
};

const getYesterdayStr = (todayStr) => {
  const date = new Date(todayStr + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split('T')[0];
};

const getCurrentWeekDates = () => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

  const monday = new Date(today);
  monday.setDate(today.getDate() + distanceToMonday);

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDates.push(date.toISOString().split('T')[0]);
  }
  return weekDates;
};

const startSessionSchema = Joi.object({
  duration: Joi.number().integer().min(1).max(480).required().messages({
    'number.base': 'Duration must be a number',
    'number.min': 'Duration must be at least 1 minute',
    'any.required': 'Duration is required',
  }),
});

// POST /api/focus/start
router.post('/start', verifyJWT, async (req, res, next) => {
  try {
    const { error, value } = startSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { duration } = value;
    const session = new FocusSession({
      userId: req.user.userId,
      duration,
      completed: false,
      startedAt: new Date(),
    });

    await session.save();
    return res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/focus/pause
router.post('/pause', verifyJWT, async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = await FocusSession.findOne({ _id: sessionId, userId: req.user.userId });
    if (!session) {
      return res.status(404).json({ error: 'Focus session not found' });
    }

    return res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

// POST /api/focus/resume
router.post('/resume', verifyJWT, async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = await FocusSession.findOne({ _id: sessionId, userId: req.user.userId });
    if (!session) {
      return res.status(404).json({ error: 'Focus session not found' });
    }

    return res.status(200).json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

// POST /api/focus/complete
router.post('/complete', verifyJWT, async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = await FocusSession.findOneAndUpdate(
      { _id: sessionId, userId: req.user.userId, completed: false },
      { $set: { completed: true, endedAt: new Date() } },
      { new: true }
    );

    if (!session) {
      return res.status(400).json({ error: 'Focus session not found or already completed' });
    }

    // Select reward fruit
    const fruits = ['Apple', 'Orange', 'Mango', 'Strawberry', 'Grapes', 'Banana'];
    const chosenFruit = fruits[Math.floor(Math.random() * fruits.length)];
    session.rewardFruit = chosenFruit;
    await session.save();

    // Update Inventory
    let inventory = await FocusInventory.findOne({ userId: req.user.userId });
    if (!inventory) {
      inventory = new FocusInventory({ userId: req.user.userId });
    }
    inventory.fruitCounts[chosenFruit] = (inventory.fruitCounts[chosenFruit] || 0) + 1;
    inventory.totalFruits += 1;
    // Tell mongoose the nested object has changed
    inventory.markModified('fruitCounts');
    await inventory.save();

    // Update Streak
    let streak = await FocusStreak.findOne({ userId: req.user.userId });
    if (!streak) {
      streak = new FocusStreak({ userId: req.user.userId });
    }

    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr(todayStr);

    let streakUpdated = false;
    let newStreak = streak.currentStreak;

    if (!streak.completedDates.includes(todayStr)) {
      streakUpdated = true;
      if (streak.completedDates.includes(yesterdayStr)) {
        streak.currentStreak += 1;
      } else {
        streak.currentStreak = 1;
      }
      streak.completedDates.push(todayStr);
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
      newStreak = streak.currentStreak;
      await streak.save();
    }

    // Create session complete notification
    await Notification.create({
      userId: req.user.userId,
      alertType: 'focus_complete',
      severity: 'low',
      title: 'Focus Session Completed!',
      shortMessage: '🎉 Great work! You earned a fruit.',
      detailedReason: `You successfully completed your ${session.duration}-minute focus session and earned a ${chosenFruit}.`,
      recommendedAction: 'Visit your Orchard to view your collected fruits and stats!',
    });

    // Create milestone notifications
    let milestoneAchieved = null;
    const milestones = [3, 7, 14, 30];
    if (streakUpdated && milestones.includes(newStreak)) {
      milestoneAchieved = newStreak;
      await Notification.create({
        userId: req.user.userId,
        alertType: 'focus_milestone',
        severity: 'medium',
        title: 'Streak Milestone Achieved!',
        shortMessage: `🔥 You hit a ${newStreak}-day focus streak!`,
        detailedReason: `Amazing! You have successfully completed at least one focus session each day for the past ${newStreak} days.`,
        recommendedAction: 'Keep up the fantastic momentum! Protect your streak by focusing again tomorrow.',
      });
    }

    return res.status(200).json({
      session,
      inventory,
      streak,
      earnedFruit: chosenFruit,
      milestoneAchieved,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/focus/stats
router.get('/stats', verifyJWT, async (req, res, next) => {
  try {
    const completedSessions = await FocusSession.find({ userId: req.user.userId, completed: true });
    const totalSessions = await FocusSession.countDocuments({ userId: req.user.userId });

    const totalMinutes = completedSessions.reduce((acc, curr) => acc + curr.duration, 0);
    const completionRate = totalSessions > 0 ? Math.round((completedSessions.length / totalSessions) * 100) : 0;

    const maxSession = await FocusSession.findOne({ userId: req.user.userId, completed: true }).sort({ duration: -1 });
    const longestSession = maxSession ? maxSession.duration : 0;

    const inventory = await FocusInventory.findOne({ userId: req.user.userId });
    const totalFruits = inventory ? inventory.totalFruits : 0;

    const streak = await FocusStreak.findOne({ userId: req.user.userId });
    const currentStreak = streak ? streak.currentStreak : 0;

    return res.status(200).json({
      totalSessions: completedSessions.length,
      totalMinutes,
      completionRate,
      longestSession,
      totalFruits,
      currentStreak,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/focus/inventory
router.get('/inventory', verifyJWT, async (req, res, next) => {
  try {
    let inventory = await FocusInventory.findOne({ userId: req.user.userId });
    if (!inventory) {
      inventory = {
        fruitCounts: { Apple: 0, Orange: 0, Mango: 0, Strawberry: 0, Grapes: 0, Banana: 0 },
        totalFruits: 0,
      };
    }
    return res.status(200).json(inventory);
  } catch (err) {
    next(err);
  }
});

// GET /api/focus/streak
router.get('/streak', verifyJWT, async (req, res, next) => {
  try {
    let streak = await FocusStreak.findOne({ userId: req.user.userId });
    if (!streak) {
      streak = {
        currentStreak: 0,
        longestStreak: 0,
        completedDates: [],
      };
    }

    const weekDates = getCurrentWeekDates();
    const daysLabel = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Find completed sessions inside this week
    const weeklySessions = await FocusSession.find({
      userId: req.user.userId,
      completed: true,
      startedAt: {
        $gte: new Date(weekDates[0] + 'T00:00:00.000Z'),
        $lte: new Date(weekDates[6] + 'T23:59:59.999Z'),
      },
    }).sort({ startedAt: 1 });

    const weeklyStreak = daysLabel.map((day, idx) => {
      const dateStr = weekDates[idx];
      const sessionToday = weeklySessions.find((s) => {
        const sDateStr = s.startedAt.toISOString().split('T')[0];
        return sDateStr === dateStr;
      });
      return {
        day,
        date: dateStr,
        fruit: sessionToday ? sessionToday.rewardFruit : null,
      };
    });

    return res.status(200).json({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      weeklyStreak,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
