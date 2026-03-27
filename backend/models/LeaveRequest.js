const mongoose = require('mongoose');

const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other'];
const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

const LeaveRequestSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    leaveType: {
      type: String,
      enum: LEAVE_TYPES,
      required: true,
      default: 'annual',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    days: {
      type: Number,
      required: true,
      min: 0.5,
    },
    status: {
      type: String,
      enum: LEAVE_STATUSES,
      default: 'pending',
      index: true,
    },
    reason: { type: String, default: '' },
    reviewNote: { type: String, default: '' },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
  },
  { timestamps: true }
);

LeaveRequestSchema.index({ tenantId: 1, employee: 1, startDate: -1 });

module.exports = mongoose.model('LeaveRequest', LeaveRequestSchema);
module.exports.LEAVE_TYPES = LEAVE_TYPES;
module.exports.LEAVE_STATUSES = LEAVE_STATUSES;
