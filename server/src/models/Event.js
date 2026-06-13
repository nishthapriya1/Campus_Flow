import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['exam', 'assignment', 'class', 'extracurricular'],
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      required: true,
    },
    sourceNoticeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notice',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Define performance indexes
eventSchema.index({ userId: 1, startTime: 1 });
eventSchema.index({ userId: 1, type: 1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;
