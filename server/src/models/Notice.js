import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'text/plain'],
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['uploaded', 'summarized', 'summary_failed', 'archived'],
      default: 'uploaded',
      required: true,
    },
    summary: {
      type: String,
      default: null,
    },
    summaryLang: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      default: null,
    },
    deadlines: {
      type: [Date],
      default: [],
    },
    actions: {
      type: [String],
      default: [],
    },
    urgency: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'unknown'],
      default: 'unknown',
      required: true,
    },
    category: {
      type: String,
      enum: ['academic', 'event', 'administrative', 'placement', 'unknown'],
      default: 'unknown',
      required: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    extractedDate: {
      type: Date,
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for duplicate check optimization, and sorting indexes
noticeSchema.index({ fileName: 1, status: 1 });
noticeSchema.index({ uploadedAt: -1 });
noticeSchema.index({ urgency: 1, uploadedAt: -1 });

const Notice = mongoose.model('Notice', noticeSchema);

export default Notice;
