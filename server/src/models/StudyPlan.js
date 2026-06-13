import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String, // format "HH:mm"
    required: true,
  },
  endTime: {
    type: String, // format "HH:mm"
    required: true,
  },
  durationMins: {
    type: Number,
    required: true,
  },
});

const studyPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      required: true,
    },
    preferences: {
      subjects: {
        type: [String],
        required: true,
        validate: [
          (arr) => arr.length >= 1 && arr.length <= 10,
          'Subjects array must contain between 1 and 10 items',
        ],
      },
      examDates: {
        type: [Date],
        required: true,
        validate: [
          (arr) => arr.length >= 1 && arr.length <= 10,
          'Exam dates array must contain between 1 and 10 items',
        ],
      },
      dailyHours: {
        type: Number,
        required: true,
        min: [0.5, 'Daily study hours must be at least 0.5'],
        max: [16, 'Daily study hours cannot exceed 16'],
      },
    },
    sessions: [sessionSchema],
    generatedAt: {
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

// Define performance index
studyPlanSchema.index({ userId: 1, status: 1 });

const StudyPlan = mongoose.model('StudyPlan', studyPlanSchema);

export default StudyPlan;
