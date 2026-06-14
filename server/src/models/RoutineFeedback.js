import mongoose from 'mongoose';

const routineFeedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    insightId: {
      type: String,
      required: true,
    },
    isHelpful: {
      type: Boolean,
      required: true,
    },
    comments: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Define performance indexes
routineFeedbackSchema.index({ userId: 1, insightId: 1 });

const RoutineFeedback = mongoose.model('RoutineFeedback', routineFeedbackSchema);

export default RoutineFeedback;
