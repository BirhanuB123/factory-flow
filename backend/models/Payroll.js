const mongoose = require('mongoose');

const payrollSchema = mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Employee'
  },
  month: {
    type: String, // e.g., '2026-03'
    required: true
  },
  basicSalary: {
    type: Number,
    required: true
  },
  bonuses: {
    type: Number,
    default: 0
  },
  deductions: {
    type: Number,
    default: 0
  },
  netSalary: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['Paid', 'Pending', 'Processing'],
    default: 'Pending'
  },
  paymentDate: {
    type: Date
  }
}, {
  timestamps: true
});

const Payroll = mongoose.model('Payroll', payrollSchema);

module.exports = Payroll;
