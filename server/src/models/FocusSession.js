import mongoose from 'mongoose';

const focusSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    duration: {
      type: Number, // duration in minutes
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    rewardFruit: {
      type: String,
      enum: ['Apple', 'Orange', 'Mango', 'Strawberry', 'Grapes', 'Banana', null],
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

focusSessionSchema.index({ userId: 1, createdAt: -1 });

const FocusSession = mongoose.model('FocusSession', focusSessionSchema);
export default FocusSession;
