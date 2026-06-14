import mongoose from 'mongoose';

const cachedAnalysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    analysisType: {
      type: String, // 'life_companion_dashboard' or 'scheduling_analysis'
      required: true,
    },
    inputHash: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique entries per user per analysis type
cachedAnalysisSchema.index({ userId: 1, analysisType: 1 }, { unique: true });

const CachedAnalysis = mongoose.model('CachedAnalysis', cachedAnalysisSchema);

export default CachedAnalysis;
