import mongoose from 'mongoose';

const focusStreakSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    completedDates: {
      type: [String], // Dates in YYYY-MM-DD local format
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const FocusStreak = mongoose.model('FocusStreak', focusStreakSchema);
export default FocusStreak;
