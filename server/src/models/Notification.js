import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    alertType: {
      type: String,
      enum: [
        'reminder_24h',
        'reminder_1h',
        'guardian_risk',
        'guardian_opportunity',
        'notice_critical',
        'deadline_72h',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: [60, 'Title cannot exceed 60 characters'],
    },
    shortMessage: {
      type: String,
      required: true,
    },
    detailedReason: {
      type: String,
      required: true,
    },
    recommendedAction: {
      type: String,
      required: true,
    },
    deadline: {
      type: Date,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
      required: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    snsMessageId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Define performance indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
