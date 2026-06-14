import mongoose from 'mongoose';

const monthlyBudgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: [1, 'Month must be between 1 and 12'],
      max: [12, 'Month must be between 1 and 12'],
    },
    year: {
      type: Number,
      required: true,
      min: [2000, 'Year must be after 2000'],
    },
    currency: {
      type: String,
      required: true,
      enum: ['INR', 'USD', 'EUR'],
      default: 'USD',
    },
    budgetAmount: {
      type: Number,
      required: true,
      min: [0, 'Budget amount cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate budgets for the same user in the same month and year
monthlyBudgetSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

const MonthlyBudget = mongoose.model('MonthlyBudget', monthlyBudgetSchema);

export default MonthlyBudget;
