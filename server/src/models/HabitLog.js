import mongoose from 'mongoose';

const habitLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD format
      required: true,
    },
    sleep: {
      type: Boolean,
      default: false,
    },
    waterIntake: {
      type: Boolean,
      default: false,
    },
    exercise: {
      type: Boolean,
      default: false,
    },
    meditation: {
      type: Boolean,
      default: false,
    },
    studyHours: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Guarantee unique daily entries per user
habitLogSchema.index({ userId: 1, date: 1 }, { unique: true });

const HabitLog = mongoose.model('HabitLog', habitLogSchema);

export default HabitLog;
