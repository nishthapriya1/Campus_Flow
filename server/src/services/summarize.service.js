import Notice from '../models/Notice.js';
import { getFile } from './s3.service.js';
import { extractText } from './textExtract.service.js';
import { analyzeNotice } from './bedrock.service.js';
import { extractDate } from '../utils/dateParser.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { publishNotification } from './sns.service.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the text extraction, date parsing, and summarization pipeline for a notice.
 * Implements a 3-retry loop with a 5-second delay for AI summarization.
 * @param {string} noticeId - Notice database ID
 */
export const runSummarization = async (noticeId) => {
  console.log(`Pipeline: Starting async pipeline for notice ${noticeId}`);
  
  let notice;
  try {
    notice = await Notice.findById(noticeId);
    if (!notice) {
      console.error(`Pipeline Error: Notice ${noticeId} not found in database.`);
      return;
    }

    // 1. Retrieve file buffer
    const buffer = await getFile(notice.s3Key);

    // 2. Extract text from buffer
    const text = await extractText(buffer, notice.mimeType);

    // 3. Extract date if present in text
    if (text) {
      const foundDate = extractDate(text);
      if (foundDate) {
        notice.extractedDate = foundDate;
        console.log(`Pipeline: Parsed date from notice: ${foundDate.toISOString().split('T')[0]}`);
      }
    }

    // 4. Analyze notice with Bedrock (retry loop: 1 initial attempt + 3 retries = 4 total attempts)
    let analysisResult = null;
    let attempts = 0;
    const maxAttempts = 4;
    let success = false;
    let partialSummary = null;

    while (attempts < maxAttempts && !success) {
      attempts++;
      try {
        console.log(`Pipeline: Notice analysis attempt ${attempts}/${maxAttempts}...`);
        analysisResult = await analyzeNotice(text);
        success = true;
      } catch (error) {
        console.warn(`Pipeline Warning: Attempt ${attempts} failed: ${error.message}`);
        if (error.partialSummary) {
          partialSummary = error.partialSummary;
        }
        if (attempts < maxAttempts) {
          console.log('Pipeline: Waiting 5 seconds before retry...');
          await delay(5000);
        }
      }
    }

    notice.retryCount = attempts - 1;

    if (success && analysisResult) {
      notice.title = analysisResult.title;
      notice.summary = analysisResult.summary;
      notice.urgency = analysisResult.urgency;
      notice.category = analysisResult.category;
      if (Array.isArray(analysisResult.deadlines)) {
        notice.deadlines = analysisResult.deadlines.map(d => new Date(d));
      }
      notice.actions = analysisResult.actions;
      notice.status = 'summarized';
      notice.summaryLang = 'en'; // Standard default
      console.log(`Pipeline: Notice analysis succeeded for notice ${noticeId}`);

      // Wire SNS publish for critical/high notices (Task 69)
      if (notice.urgency === 'critical' || notice.urgency === 'high') {
        try {
          const students = await User.find({ role: 'student' });
          const notifTitle = notice.title ? (notice.title.length > 60 ? notice.title.substring(0, 57) + '...' : notice.title) : 'Critical Notice Alert';
          const notifDeadline = notice.deadlines && notice.deadlines.length > 0 ? notice.deadlines[0] : null;
          
          for (const student of students) {
            // Deduplication guard
            const duplicate = await Notification.findOne({
              userId: student._id,
              alertType: 'notice_critical',
              title: notifTitle,
            });
            if (duplicate) {
              console.log(`Pipeline Info: Notification duplicate guard skipped notification for notice ${notice._id} and student ${student._id}`);
              continue;
            }

            const notification = await Notification.create({
              userId: student._id,
              alertType: 'notice_critical',
              severity: notice.urgency,
              title: notifTitle,
              shortMessage: `New critical notice: ${notice.title}`,
              detailedReason: notice.summary || 'A critical notice has been posted.',
              recommendedAction: notice.actions && notice.actions.length > 0
                ? `Please complete the following actions: ${notice.actions.join(', ')}`
                : 'Please review the notice details.',
              deadline: notifDeadline,
            });

            const payload = {
              userId: student._id.toString(),
              alertType: 'notice_critical',
              severity: notice.urgency,
              title: notification.title,
              shortMessage: notification.shortMessage,
              detailedReason: notification.detailedReason,
              recommendedAction: notification.recommendedAction,
              deadline: notification.deadline ? notification.deadline.toISOString() : null,
              notificationId: notification._id.toString(),
            };

            const messageId = await publishNotification(payload);
            if (messageId) {
              notification.snsMessageId = messageId;
              await notification.save();
            }
          }
        } catch (notifErr) {
          console.error(`Pipeline Error: Failed to generate critical notifications for notice ${notice._id}:`, notifErr.message);
        }
      }
    } else {
      notice.status = 'summary_failed';
      notice.urgency = 'unknown';
      notice.category = 'unknown';
      notice.summary = partialSummary || null;
      console.error(`Pipeline Error: Notice analysis failed after all attempts for notice ${noticeId}`);
    }

    await notice.save();
  } catch (error) {
    console.error(`Pipeline Fatal Error for notice ${noticeId}:`, error.message);
    if (notice) {
      notice.status = 'summary_failed';
      notice.urgency = 'unknown';
      notice.category = 'unknown';
      try {
        await notice.save();
      } catch (saveError) {
        console.error('Failed to save error status to notice:', saveError.message);
      }
    }
  }
};
