const mongoose = require('mongoose');

const attendanceSchema = mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Employee'
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['Present', 'Absent', 'Late', 'On Leave'],
    default: 'Present'
  },
  checkIn: {
    type: String
  },
  checkOut: {
    type: String
  },
  workMinutes: {
    type: Number,
    default: 0,
    min: 0,
  },
  lateMinutes: {
    type: Number,
    default: 0,
    min: 0,
  },
  overtimeMinutes: {
    type: Number,
    default: 0,
    min: 0,
  },
  overtimeApprovalStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  },
  overtimeApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null,
  },
  overtimeApprovedAt: {
    type: Date,
    default: null,
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

attendanceSchema.index({ tenantId: 1, employee: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
