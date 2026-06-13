import cron from 'node-cron';
import Event from '../models/Event.js';
import Reminder from '../models/Reminder.js';
import Notification from '../models/Notification.js';
import { publishNotification } from './sns.service.js';

/**
 * Pre-schedules reminders when an event is created or updated.
 * Creates only reminder documents for trigger windows still in the future.
 * @param {object} event - Mongoose Event document
 */
export const scheduleRemindersForEvent = async (event) => {
  if (event.type !== 'exam' && event.type !== 'assignment') return;

  const now = new Date();
  const startTime = new Date(event.startTime);

  // 1. Calculate 24h trigger time
  const scheduled24h = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
  if (scheduled24h > now) {
    try {
      await Reminder.updateOne(
        { eventId: event._id, triggerType: '24h' },
        {
          $setOnInsert: {
            userId: event.userId,
            eventId: event._id,
            triggerType: '24h',
            scheduledAt: scheduled24h,
            firedAt: null,
            dismissed: false,
          },
        },
        { upsert: true }
      );
      console.log(`Pre-scheduled 24h reminder for event: ${event.title} at ${scheduled24h.toISOString()}`);
    } catch (err) {
      console.error(`Failed to pre-schedule 24h reminder for event ${event._id}:`, err.message);
    }
  } else {
    console.log(`Skipped pre-scheduling 24h reminder for event "${event.title}" (less than 24h remaining).`);
  }

  // 2. Calculate 1h trigger time
  const scheduled1h = new Date(startTime.getTime() - 1 * 60 * 60 * 1000);
  if (scheduled1h > now) {
    try {
      await Reminder.updateOne(
        { eventId: event._id, triggerType: '1h' },
        {
          $setOnInsert: {
            userId: event.userId,
            eventId: event._id,
            triggerType: '1h',
            scheduledAt: scheduled1h,
            firedAt: null,
            dismissed: false,
          },
        },
        { upsert: true }
      );
      console.log(`Pre-scheduled 1h reminder for event: ${event.title} at ${scheduled1h.toISOString()}`);
    } catch (err) {
      console.error(`Failed to pre-schedule 1h reminder for event ${event._id}:`, err.message);
    }
  } else {
    console.log(`Skipped pre-scheduling 1h reminder for event "${event.title}" (less than 1h remaining).`);
  }
};

/**
 * Helper to persist and publish a reminder deadline notification to SNS.
 * @param {object} event - Mongoose Event document
 * @param {string} triggerType - "24h" | "1h"
 */
const fireReminderNotification = async (event, triggerType) => {
  try {
    const is24h = triggerType === '24h';
    const severity = is24h ? 'high' : 'critical';
    const alertType = is24h ? 'reminder_24h' : 'reminder_1h';
    const timeWord = is24h ? '24 hours' : '1 hour';
    const title = is24h ? '24h Deadline Reminder' : '1h Deadline Reminder';

    // Deduplication check: do not create duplicate notifications for same event and window
    const duplicate = await Notification.findOne({
      userId: event.userId,
      alertType,
      deadline: event.startTime,
    });
    if (duplicate) {
      console.log(`Notification duplicate guard: Skipping duplicate reminder notification for event "${event.title}"`);
      return;
    }

    const payload = {
      userId: event.userId.toString(),
      alertType,
      severity,
      title,
      shortMessage: `The ${event.type} "${event.title}" starts in ${timeWord}.`,
      detailedReason: `You have an upcoming ${event.type} event "${event.title}" scheduled for ${event.startTime.toISOString()}.`,
      recommendedAction: `Ensure your preparation is ready and verify details.`,
      deadline: event.startTime.toISOString(),
    };

    // Create Notification document (persisted regardless of push delivery)
    const notification = await Notification.create({
      userId: event.userId,
      alertType: payload.alertType,
      severity: payload.severity,
      title: payload.title,
      shortMessage: payload.shortMessage,
      detailedReason: payload.detailedReason,
      recommendedAction: payload.recommendedAction,
      deadline: event.startTime,
    });

    payload.notificationId = notification._id.toString();

    // Publish to SNS
    const messageId = await publishNotification(payload);
    if (messageId) {
      notification.snsMessageId = messageId;
      await notification.save();
    }
  } catch (error) {
    console.error(`Error firing reminder notification for event ${event._id}:`, error.message);
  }
};

/**
 * Starts the active cron job to query for events that enter the 24h and 1h alert windows.
 */
export const startScheduler = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // 24h trigger window (+- 1 minute to prevent skipping)
      const target24hMin = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 60 * 1000);
      const target24hMax = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 60 * 1000);

      // 1h trigger window (+- 1 minute to prevent skipping)
      const target1hMin = new Date(now.getTime() + 1 * 60 * 60 * 1000 - 60 * 1000);
      const target1hMax = new Date(now.getTime() + 1 * 60 * 60 * 1000 + 60 * 1000);

      // 1. Process 24h window
      const events24h = await Event.find({
        type: { $in: ['exam', 'assignment'] },
        startTime: { $gte: target24hMin, $lte: target24hMax },
      });

      for (const event of events24h) {
        const scheduledAt = new Date(event.startTime.getTime() - 24 * 60 * 60 * 1000);
        
        // Skip if already marked as fired
        const existingReminder = await Reminder.findOne({ eventId: event._id, triggerType: '24h' });
        if (existingReminder && existingReminder.firedAt) {
          continue;
        }

        await Reminder.updateOne(
          { eventId: event._id, triggerType: '24h' },
          {
            $set: { firedAt: now },
            $setOnInsert: {
              userId: event.userId,
              eventId: event._id,
              triggerType: '24h',
              scheduledAt,
              dismissed: false,
            },
          },
          { upsert: true }
        );

        await fireReminderNotification(event, '24h');
      }

      // 2. Process 1h window
      const events1h = await Event.find({
        type: { $in: ['exam', 'assignment'] },
        startTime: { $gte: target1hMin, $lte: target1hMax },
      });

      for (const event of events1h) {
        const scheduledAt = new Date(event.startTime.getTime() - 1 * 60 * 60 * 1000);
        
        // Skip if already marked as fired
        const existingReminder = await Reminder.findOne({ eventId: event._id, triggerType: '1h' });
        if (existingReminder && existingReminder.firedAt) {
          continue;
        }

        await Reminder.updateOne(
          { eventId: event._id, triggerType: '1h' },
          {
            $set: { firedAt: now },
            $setOnInsert: {
              userId: event.userId,
              eventId: event._id,
              triggerType: '1h',
              scheduledAt,
              dismissed: false,
            },
          },
          { upsert: true }
        );

        await fireReminderNotification(event, '1h');
      }
    } catch (error) {
      console.error('Reminder Scheduler cron error:', error.message);
    }
  });

  console.log('Reminder Scheduler service active (node-cron registered).');
};

/**
 * Starts the 15-minute cron job to scan for events scheduled in the next 72 hours
 * and generate push alerts for them (Task 85).
 */
export const startDeadlineScheduler = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      await runDeadlineCheck();
    } catch (error) {
      console.error('72h Deadline Scheduler cron error:', error.message);
    }
  });
  console.log('72h Deadline Scheduler service active (node-cron registered).');
};

/**
 * Scans events in the next 72h window and fires notifications.
 * Extracted helper to run synchronously in E2E tests (Task 88).
 */
export const runDeadlineCheck = async () => {
  const now = new Date();
  const targetMin = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1h in the future
  const targetMax = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72h in the future

  const events72h = await Event.find({
    type: { $in: ['exam', 'assignment'] },
    startTime: { $gte: targetMin, $lte: targetMax },
  });

  for (const event of events72h) {
    try {
      // Check if a Notification already exists with:
      // userId, alertType: "deadline_72h", and deadline within 1 minute of event.startTime
      const marginMs = 60 * 1000;
      const targetTime = event.startTime;
      const notifMin = new Date(targetTime.getTime() - marginMs);
      const notifMax = new Date(targetTime.getTime() + marginMs);

      const duplicate = await Notification.findOne({
        userId: event.userId,
        alertType: 'deadline_72h',
        deadline: { $gte: notifMin, $lte: notifMax },
      });

      if (duplicate) {
        continue; // duplicate guard
      }

      // Create Notification document
      const notification = await Notification.create({
        userId: event.userId,
        alertType: 'deadline_72h',
        severity: 'critical',
        title: '72h Deadline Alert',
        shortMessage: `The ${event.type} "${event.title}" starts within 72 hours.`,
        detailedReason: `You have an upcoming ${event.type} event "${event.title}" scheduled for ${event.startTime.toISOString()}.`,
        recommendedAction: `Ensure your preparation is ready and verify details.`,
        deadline: event.startTime,
      });

      const payload = {
        userId: event.userId.toString(),
        alertType: 'deadline_72h',
        severity: 'critical',
        title: notification.title,
        shortMessage: notification.shortMessage,
        detailedReason: notification.detailedReason,
        recommendedAction: notification.recommendedAction,
        deadline: event.startTime.toISOString(),
        notificationId: notification._id.toString(),
      };

      const messageId = await publishNotification(payload);
      if (messageId) {
        notification.snsMessageId = messageId;
        await notification.save();
      }
    } catch (err) {
      console.error(`Error processing 72h alert for event ${event._id}:`, err.message);
    }
  }
};

