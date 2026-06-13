import express from 'express';
import multer from 'multer';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { uploadFile, getPresignedUrl } from '../services/s3.service.js';
import { runSummarization } from '../services/summarize.service.js';
import Notice from '../models/Notice.js';

const router = express.Router();

// Multer memory storage configuration with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
];

// POST /api/notices (Admin upload)
// Handles parsing of file uploads, validates size and duplicates, saves metadata, and triggers async summarizer.
router.post(
  '/',
  verifyJWT,
  requireRole('administrator'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Please select a notice file.' });
      }

      const { originalname, mimetype, buffer, size } = req.file;

      // 1. Validate file size (already capped by multer, but let's check explicitly)
      if (size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'File exceeds the 10 MB limit' });
      }

      // 2. Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
        return res.status(400).json({
          error: `File type ${mimetype} is not supported. Accepted types: PDF, PNG, JPG, TXT`,
        });
      }

      // 3. Validate name uniqueness among active (non-archived) notices
      const existingNotice = await Notice.findOne({
        fileName: originalname,
        status: { $ne: 'archived' },
      });

      if (existingNotice) {
        return res.status(400).json({
          error: `A notice with the file name "${originalname}" already exists.`,
        });
      }

      // 4. Upload file to S3 (or mock local folder)
      const s3Key = await uploadFile(buffer, mimetype, originalname);

      // 5. Create Notice database record
      const notice = new Notice({
        uploadedBy: req.user.userId,
        fileName: originalname,
        s3Key,
        mimeType: mimetype,
        sizeBytes: size,
        status: 'uploaded',
      });

      await notice.save();

      // 6. Return response immediately (within 5 seconds)
      res.status(201).json({
        noticeId: notice._id,
        fileName: notice.fileName,
        status: notice.status,
      });

      // 7. Fire AI notice summarization pipeline asynchronously
      // Since it runs in the background, we do not await it here.
      runSummarization(notice._id).catch((err) => {
        console.error(`Async summarization pipeline failure for notice ${notice._id}:`, err);
      });

    } catch (error) {
      next(error);
    }
  }
);

// GET /api/notices (Student / Admin feed)
// Fetches active notices sorted by urgency order then by uploadedAt descending, with pagination support.
router.get('/', verifyJWT, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = { status: { $ne: 'archived' } };

    const total = await Notice.countDocuments(query);
    const notices = await Notice.aggregate([
      { $match: query },
      {
        $addFields: {
          urgencyOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$urgency', 'critical'] }, then: 5 },
                { case: { $eq: ['$urgency', 'high'] }, then: 4 },
                { case: { $eq: ['$urgency', 'medium'] }, then: 3 },
                { case: { $eq: ['$urgency', 'low'] }, then: 2 },
                { case: { $eq: ['$urgency', 'unknown'] }, then: 1 },
              ],
              default: 0,
            },
          },
        },
      },
      { $sort: { urgencyOrder: -1, uploadedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          fileName: 1,
          title: 1,
          summary: 1,
          urgency: 1,
          category: 1,
          status: 1,
          uploadedAt: 1,
          extractedDate: 1,
        },
      },
    ]);

    return res.status(200).json({
      notices,
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notices/:id (Detail view)
// Fetches single notice and generates a 15-minute S3 pre-signed URL.
router.get('/:id', verifyJWT, async (req, res, next) => {
  try {
    const { id } = req.params;
    const notice = await Notice.findById(id);

    if (!notice) {
      return res.status(404).json({ error: 'Notice not found' });
    }

    // Generate S3 pre-signed read URL (expires in 15 mins)
    const fileUrl = await getPresignedUrl(notice.s3Key);

    return res.status(200).json({
      _id: notice._id,
      fileName: notice.fileName,
      summary: notice.summary,
      summaryLang: notice.summaryLang,
      status: notice.status,
      uploadedAt: notice.uploadedAt,
      extractedDate: notice.extractedDate,
      fileUrl,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
