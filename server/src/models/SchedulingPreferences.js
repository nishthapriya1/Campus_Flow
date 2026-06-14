import mongoose from 'mongoose';

const schedulingPreferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    sleepStart: {
      type: String, // HH:mm
      default: '23:00',
    },
    sleepEnd: {
      type: String, // HH:mm
      default: '07:00',
    },
    preferredStudyHours: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night'],
      default: 'evening',
    },
    breakfastTime: {
      type: String, // HH:mm
      default: '08:00',
    },
    lunchTime: {
      type: String, // HH:mm
      default: '13:00',
    },
    dinnerTime: {
      type: String, // HH:mm
      default: '20:00',
    },
    travelTimeMins: {
      type: Number,
      default: 30,
    },
    productivityPreference: {
      type: String,
      default: 'Balanced workload',
    },
    personalCommitments: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexing for performance
schedulingPreferencesSchema.index({ userId: 1 });

const SchedulingPreferences = mongoose.model('SchedulingPreferences', schedulingPreferencesSchema);

export default SchedulingPreferences;
