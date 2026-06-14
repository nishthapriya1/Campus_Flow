import mongoose from 'mongoose';

const wellnessLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mood: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    sleepHours: {
      type: Number,
      required: true,
      min: 0,
      max: 24,
    },
    stressLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    exerciseMins: {
      type: Number,
      required: true,
      min: 0,
      max: 1440,
    },
  },
  {
    timestamps: true,
  }
);

// Performance index for fetching user history chronologically
wellnessLogSchema.index({ userId: 1, createdAt: -1 });

const WellnessLog = mongoose.model('WellnessLog', wellnessLogSchema);

export default WellnessLog;
