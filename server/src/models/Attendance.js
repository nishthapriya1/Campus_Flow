import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: true,
  },
});

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['Theory', 'Lab'],
      required: true,
    },
    conducted: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    attended: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    logs: [logSchema],
    lastNotifiedStatus: {
      type: String,
      enum: ['safe', 'warning', 'critical'],
      default: 'safe',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to keep counters in sync with logs array
attendanceSchema.pre('save', function () {
  this.conducted = this.logs.length;
  this.attended = this.logs.filter((log) => log.status === 'present').length;
});

// Compound index to ensure uniqueness of subject code per user
attendanceSchema.index({ userId: 1, subjectCode: 1 }, { unique: true });
// Performance index
attendanceSchema.index({ userId: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
