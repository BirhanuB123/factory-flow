const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Employee',
    },
    month: {
      type: String,
      required: true,
      trim: true,
    },
    basicSalary: { type: Number, required: true },
    bonuses: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['Paid', 'Pending', 'Processing'],
      default: 'Pending',
    },
    paymentDate: { type: Date },
    /** Ethiopia statutory payroll */
    transportAllowance: { type: Number, default: 0 },
    otherTaxableAllowances: { type: Number, default: 0 },
    overtimeNormalHours: { type: Number, default: 0 },
    overtimeRestHolidayHours: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    grossCash: { type: Number, default: 0 },
    pensionableBase: { type: Number, default: 0 },
    pensionEmployee: { type: Number, default: 0 },
    pensionEmployer: { type: Number, default: 0 },
    taxableIncomeForTax: { type: Number, default: 0 },
    incomeTax: { type: Number, default: 0 },
    otherDeductionsPayroll: { type: Number, default: 0 },
    employerMonthlyCost: { type: Number, default: 0 },
    tinNumberSnapshot: { type: String, default: '' },
    breakdown: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

payrollSchema.index({ employee: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
