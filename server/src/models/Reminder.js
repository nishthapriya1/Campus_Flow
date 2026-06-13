import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    triggerType: {
      type: String,
      enum: ['24h', '1h'],
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    firedAt: {
      type: Date,
      default: null,
    },
    dismissed: {
      type: Boolean,
      default: false,
      required: true,
    },
    dismissedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Define compound unique index to prevent duplicate reminders per event/type (Property 1: Reminder Idempotency)
reminderSchema.index({ eventId: 1, triggerType: 1 }, { unique: true });

// Define indexes for fast querying by scheduler and dashboard polling
reminderSchema.index({ userId: 1, dismissed: 1 });
reminderSchema.index({ scheduledAt: 1, firedAt: 1 });

const Reminder = mongoose.model('Reminder', reminderSchema);

export default Reminder;
