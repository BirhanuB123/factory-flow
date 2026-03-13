const mongoose = require('mongoose');

const attendanceSchema = mongoose.Schema({
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
  notes: {
    type: String
  }
}, {
  timestamps: true
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
