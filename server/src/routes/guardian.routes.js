import express from 'express';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import Event from '../models/Event.js';
import StudyPlan from '../models/StudyPlan.js';
import Notice from '../models/Notice.js';
import { runGuardianAnalysis } from '../services/bedrock.service.js';
import Notification from '../models/Notification.js';
import { publishNotification } from '../services/sns.service.js';

const router = express.Router();

router.use(verifyJWT);
router.use(requireRole('student'));

// POST /api/guardian/analyze
router.post('/analyze', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch upcoming events for next 7 days
    const events = await Event.find({
      userId,
      startTime: { $gte: now, $lte: sevenDaysLater }
    }).sort({ startTime: 1 });

    // Fetch active study plan
    const studyPlan = await StudyPlan.findOne({
      userId,
      status: 'active'
    });

    // Fetch 5 most recent notices
    const notices = await Notice.find({
      status: { $ne: 'archived' }
    }).sort({ uploadedAt: -1 }).limit(5);

    // Bedrock call with 20-second Promise.race timeout (Requirement 10.3)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        const err = new Error('Guardian AI analysis timed out (limit: 20s)');
        err.status = 504;
        reject(err);
      }, 20000)
    );

    let report;
    try {
      report = await Promise.race([
        runGuardianAnalysis({ events, studyPlan, notices }),
        timeoutPromise
      ]);
    } catch (apiError) {
      const statusCode = apiError.status || 503;
      return res.status(statusCode).json({
        error: apiError.message || 'Guardian AI temporarily unavailable. Please try again.'
      });
    }

    // Process alerts to create Notifications and publish SNS
    if (report && Array.isArray(report.alerts)) {
      for (const alert of report.alerts) {
        try {
          let alertType = 'guardian_risk';
          let severity = alert.severity || 'medium';

          if (alert.alertType === 'placement_alert' || alert.alertType === 'opportunity' || alert.alertType === 'placement_opportunity') {
            alertType = 'guardian_opportunity';
            severity = 'low';
          }

          // Check for duplicate to prevent duplicate notifications
          const duplicate = await Notification.findOne({
            userId,
            alertType,
            title: alert.title
          });

          if (!duplicate) {
            let title = alert.title || 'Guardian AI Alert';
            if (title.length > 60) {
              title = title.substring(0, 57) + '...';
            }

            const shortMessage = alert.recommendedAction || title;

            const notification = await Notification.create({
              userId,
              alertType,
              severity,
              title,
              shortMessage,
              detailedReason: alert.detailedReason || 'Guardian AI has identified an update for you.',
              recommendedAction: alert.recommendedAction || 'Please review your student dashboard.',
              deadline: null
            });

            // For 'guardian_risk' alerts only, publish to SNS
            if (alertType === 'guardian_risk') {
              const payload = {
                userId: userId.toString(),
                alertType,
                severity,
                title: notification.title,
                shortMessage: notification.shortMessage,
                detailedReason: notification.detailedReason,
                recommendedAction: notification.recommendedAction,
                notificationId: notification._id.toString()
              };

              const messageId = await publishNotification(payload);
              if (messageId) {
                notification.snsMessageId = messageId;
                await notification.save();
              }
            }
          }
        } catch (alertErr) {
          console.error('Failed to process Guardian AI alert notification:', alertErr.message);
        }
      }
    }

    return res.status(200).json({ report });
  } catch (error) {
    next(error);
  }
});

export default router;
