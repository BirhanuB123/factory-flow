const mongoose = require('mongoose');

const AttendanceCorrectionRequestSchema = new mongoose.Schema(
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
    attendanceDate: {
      type: Date,
      required: true,
      index: true,
    },
    requestedStatus: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'On Leave'],
      default: 'Present',
      required: true,
    },
    requestedCheckIn: { type: String, default: '' },
    requestedCheckOut: { type: String, default: '' },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    reviewNote: { type: String, default: '' },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AttendanceCorrectionRequestSchema.index({ tenantId: 1, employee: 1, attendanceDate: -1 });

module.exports = mongoose.model('AttendanceCorrectionRequest', AttendanceCorrectionRequestSchema);
