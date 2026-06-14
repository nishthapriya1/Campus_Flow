import mongoose from 'mongoose';

const focusInventorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    fruitCounts: {
      Apple: { type: Number, default: 0 },
      Orange: { type: Number, default: 0 },
      Mango: { type: Number, default: 0 },
      Strawberry: { type: Number, default: 0 },
      Grapes: { type: Number, default: 0 },
      Banana: { type: Number, default: 0 },
    },
    totalFruits: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const FocusInventory = mongoose.model('FocusInventory', focusInventorySchema);
export default FocusInventory;
